import { serve } from "@hono/node-server";
import { Hono } from "hono";
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

type SettingsMap = Record<string, unknown>;

const SETTINGS_CACHE_KEY = "neo:settings:all";
const defaultSettings: SettingsMap = {
  theme: "dark",
  rateLimitPerMinute: 600,
  maintenanceMode: false,
  welcomeMessage: "Welcome to Neo. Oracle is optional.",
};

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

app.get("/", (c) => c.redirect("/admin"));
app.get("/admin", (c) => c.html(adminUiHtml));

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
  const persisted = await readPersistedSettings();
  return c.json({ ...defaultSettings, ...persisted, instance: instanceId });
});

app.get("/api/settings/:key", async (c) => {
  const key = c.req.param("key");
  const persisted = await readPersistedSettings();
  const value = persisted[key] ?? defaultSettings[key];
  if (value === undefined) {
    return c.json({ error: "unknown setting key" }, 404);
  }
  return c.json({ key, value, instance: instanceId });
});

app.put("/api/settings/:key", async (c) => {
  const key = c.req.param("key");
  const body = await c.req.json<{ value?: unknown }>().catch(() => ({}));
  if (!Object.prototype.hasOwnProperty.call(defaultSettings, key)) {
    return c.json({ error: "unsupported setting key" }, 400);
  }
  if (!Object.prototype.hasOwnProperty.call(body, "value")) {
    return c.json({ error: "body.value required" }, 400);
  }
  await writeSetting(key, body.value);
  return c.json({ ok: true, key, value: body.value, instance: instanceId });
});

app.post("/api/settings/apply", async (c) => {
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
