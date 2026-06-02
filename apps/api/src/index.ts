import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { Context } from "hono";
import { httpInstrumentationMiddleware } from "@hono/otel";
import Redis from "ioredis";
import pg from "pg";
import { otelSdk } from "./otel";
import { adminUiHtml } from "./admin-ui";

const { Pool } = pg;

const app = new Hono();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: 1,
  lazyConnect: true,
});

const instanceId =
  process.env.HOSTNAME ?? process.env.INSTANCE_ID ?? `local-${process.pid}`;
const isProduction = process.env.NODE_ENV === "production";
const adminToken = process.env.ADMIN_TOKEN?.trim() ?? "";
const corsOrigin = process.env.CORS_ORIGIN?.trim() ?? "";
const trustProxy = process.env.TRUST_PROXY === "true";

type SettingsMap = Record<string, unknown>;
type SettingKey = "theme" | "rateLimitPerMinute" | "maintenanceMode" | "welcomeMessage";

const SETTINGS_CACHE_KEY = "neo:settings:all";
const defaultSettings: SettingsMap = {
  theme: "dark",
  rateLimitPerMinute: 600,
  maintenanceMode: false,
  welcomeMessage: "Welcome to Neo. Oracle is optional.",
};

const allowedSettingKeys: SettingKey[] = [
  "theme",
  "rateLimitPerMinute",
  "maintenanceMode",
  "welcomeMessage",
];

function getClientIp(forwardedFor: string | undefined, remoteAddr: string): string {
  if (!trustProxy || !forwardedFor) return remoteAddr;
  return forwardedFor.split(",")[0]?.trim() || remoteAddr;
}

async function rateLimit(c: Context, bucket: string) {
  const clientIp = getClientIp(c.req.header("x-forwarded-for"), "unknown");
  const key = `neo:ratelimit:${bucket}:${clientIp}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 60);
  }
  if (count > 120) {
    return c.json({ error: "rate limit exceeded" }, 429);
  }
  return null;
}

function validateSettingValue(key: SettingKey, value: unknown): string | null {
  switch (key) {
    case "theme":
      return value === "dark" || value === "light"
        ? null
        : "theme must be 'dark' or 'light'";
    case "rateLimitPerMinute":
      return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 100000
        ? null
        : "rateLimitPerMinute must be an integer between 1 and 100000";
    case "maintenanceMode":
      return typeof value === "boolean" ? null : "maintenanceMode must be boolean";
    case "welcomeMessage":
      return typeof value === "string" && value.length <= 500
        ? null
        : "welcomeMessage must be a string up to 500 chars";
    default:
      return "unsupported setting key";
  }
}

function isAdminAuthorized(authHeader: string | undefined): boolean {
  if (!adminToken) return !isProduction;
  if (!authHeader) return false;
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();
  return token.length > 0 && token === adminToken;
}

async function readPersistedSettings(): Promise<SettingsMap> {
  const cached = await redis.get(SETTINGS_CACHE_KEY);
  if (cached) {
    return JSON.parse(cached) as SettingsMap;
  }

  const { rows } = await pool.query<{ key: string; value: unknown }>(
    "SELECT key, value FROM app_settings"
  );
  const out: SettingsMap = {};
  for (const row of rows) {
    out[row.key] = row.value;
  }
  await redis.set(SETTINGS_CACHE_KEY, JSON.stringify(out), "EX", 60);
  return out;
}

async function writeSetting(key: string, value: unknown) {
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)]
  );
  await redis.del(SETTINGS_CACHE_KEY);
}

app.use(
  "*",
  httpInstrumentationMiddleware({
    serviceName: process.env.OTEL_SERVICE_NAME ?? "neo-api",
    serviceVersion: process.env.OTEL_SERVICE_VERSION,
    captureRequestHeaders: ["user-agent", "x-request-id"],
    captureResponseHeaders: [],
  })
);

app.use("*", async (c, next) => {
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("X-XSS-Protection", "0");
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
  );
  if (isProduction) {
    c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  await next();
});

app.use("*", async (c, next) => {
  if (!corsOrigin) {
    await next();
    return;
  }
  c.header("Access-Control-Allow-Origin", corsOrigin);
  c.header("Vary", "Origin");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  c.header("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  c.header("Access-Control-Max-Age", "600");
  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }
  await next();
});

app.get("/", (c) => c.redirect("/admin"));
app.get("/admin", (c) => {
  if (!isAdminAuthorized(c.req.header("authorization"))) {
    return c.json({ error: "unauthorized admin access" }, 401);
  }
  return c.html(adminUiHtml);
});

app.get("/health", (c) =>
  c.json({ ok: true, instance: instanceId, ts: new Date().toISOString() })
);

app.get("/ready", async (c) => {
  try {
    await pool.query("SELECT 1");
    await redis.ping();
    return c.json({ ready: true, instance: instanceId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "not ready";
    return c.json({ ready: false, error: message }, 503);
  }
});

// Prove horizontal scale: each replica increments a shared counter in Redis.
app.post("/scale/ping", async (c) => {
  const n = await redis.incr("neo:scale:pings");
  await pool.query(
    "INSERT INTO app_events (kind, payload) VALUES ($1, $2::jsonb)",
    ["scale.ping", JSON.stringify({ instance: instanceId, count: n })]
  );
  return c.json({ instance: instanceId, globalPingCount: n });
});

app.get("/scale/stats", async (c) => {
  const count = await redis.get("neo:scale:pings");
  const { rows } = await pool.query<{ n: string }>(
    "SELECT COUNT(*)::text AS n FROM app_events WHERE kind = 'scale.ping'"
  );
  return c.json({
    redisPingCount: count ? Number(count) : 0,
    postgresEventCount: Number(rows[0]?.n ?? 0),
  });
});

app.get("/api/settings", async (c) => {
  if (!isAdminAuthorized(c.req.header("authorization"))) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const persisted = await readPersistedSettings();
  return c.json({ ...defaultSettings, ...persisted, instance: instanceId });
});

app.get("/api/settings/:key", async (c) => {
  if (!isAdminAuthorized(c.req.header("authorization"))) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const key = c.req.param("key") as SettingKey;
  if (!allowedSettingKeys.includes(key)) {
    return c.json({ error: "unsupported setting key" }, 400);
  }
  const persisted = await readPersistedSettings();
  const value = persisted[key] ?? defaultSettings[key];
  if (value === undefined) {
    return c.json({ error: "unknown setting key" }, 404);
  }
  return c.json({ key, value, instance: instanceId });
});

app.put("/api/settings/:key", async (c) => {
  if (!isAdminAuthorized(c.req.header("authorization"))) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const limit = await rateLimit(c, "settings-write");
  if (limit) return limit;
  const key = c.req.param("key") as SettingKey;
  if (!allowedSettingKeys.includes(key)) {
    return c.json({ error: "unsupported setting key" }, 400);
  }
  const body = await c.req.json<{ value?: unknown }>().catch(() => ({}));
  if (!Object.prototype.hasOwnProperty.call(body, "value")) {
    return c.json({ error: "body.value required" }, 400);
  }
  const validationError = validateSettingValue(key, body.value);
  if (validationError) {
    return c.json({ error: validationError }, 400);
  }
  await writeSetting(key, body.value);
  return c.json({ ok: true, key, value: body.value, instance: instanceId });
});

app.post("/api/settings/apply", async (c) => {
  if (!isAdminAuthorized(c.req.header("authorization"))) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const limit = await rateLimit(c, "settings-apply");
  if (limit) return limit;
  const active = { ...defaultSettings, ...(await readPersistedSettings()) };
  await pool.query(
    "INSERT INTO app_events (kind, payload) VALUES ($1, $2::jsonb)",
    ["settings.applied", JSON.stringify({ instance: instanceId, active })]
  );
  return c.json({ ok: true, active, instance: instanceId });
});

const port = Number(process.env.PORT ?? 3000);

otelSdk
  .start()
  .then(() => {
    serve({ fetch: app.fetch, port }, () => {
      console.log(`neo api listening on :${port} (${instanceId})`);
    });
  })
  .catch((err) => {
    console.error("Failed to start OpenTelemetry SDK", err);
    serve({ fetch: app.fetch, port }, () => {
      console.log(`neo api listening on :${port} (${instanceId}) (no otel)`);
    });
  });

process.on("SIGTERM", async () => {
  await pool.end();
  redis.disconnect();
  await otelSdk.shutdown().catch(() => {});
  process.exit(0);
});
