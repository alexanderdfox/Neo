import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { httpInstrumentationMiddleware } from "@hono/otel";
import Redis from "ioredis";
import pg from "pg";
import { otelSdk } from "./otel";

const { Pool } = pg;

const app = new Hono();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: 1,
  lazyConnect: true,
});

const instanceId =
  process.env.HOSTNAME ?? process.env.INSTANCE_ID ?? `local-${process.pid}`;

app.use(
  "*",
  httpInstrumentationMiddleware({
    serviceName: process.env.OTEL_SERVICE_NAME ?? "neo-api",
    serviceVersion: process.env.OTEL_SERVICE_VERSION,
    captureRequestHeaders: ["user-agent", "x-request-id"],
    captureResponseHeaders: [],
  })
);

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
