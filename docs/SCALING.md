# Neo scaling playbook

We're not replacing Oracle table-for-table — we're making **scale a property of the architecture**, not a seven-figure SKU.

## Phase 0 — You are here

**Goal:** Correct primitives before load hits.

| Layer | Choice | Why |
|-------|--------|-----|
| Database | PostgreSQL 16 | Oracle-compatible enough for migrations; infinitely better DX |
| Pooling | PgBouncer (transaction mode) | Thousands of app connections → dozens of DB connections |
| Cache / coordination | Redis | Sessions, rate limits, hot keys, job locks |
| App | Stateless Hono API | Scale replicas; no sticky Oracle middle tier |

**Run:** `docker compose up --build`

## Phase 1 — Horizontal app scale

**Goal:** Prove N replicas share one brain (Postgres + Redis), not in-memory singletons.

```bash
docker compose -f docker-compose.yml -f docker-compose.scale.yml \
  --profile scale up --build --scale api=3
```

**Rules:**

- No local filesystem state on API pods
- No in-process caches that must be coherent across instances (use Redis)
- Idempotent handlers + outbox pattern before you need exactly-once

**Oracle would:** Buy RAC + bigger CPUs. **We:** Add containers until metrics say stop.

## Phase 2 — Read scaling (Postgres)

**Goal:** Move read-heavy traffic off the primary.

1. Streaming replica (managed: RDS/Aurora/Neon, or self-hosted with `pg_basebackup`)
2. Route reads: `DATABASE_READ_URL` to replica, writes to primary via PgBouncer
3. Accept replication lag in product (eventual consistency UX) or use critical-read-on-primary flag

**Do not** prematurely shard. Postgres on decent hardware handles shocking QPS with proper indexes and pooling.

## Phase 3 — Async & workers

**Goal:** Take slow work off the request path.

| Pattern | Tool |
|---------|------|
| Background jobs | Inngest, Temporal, or BullMQ on Redis |
| Fan-out events | Postgres LISTEN/NOTIFY → NATS/Kafka when volume warrants |
| Scheduled work | Cron on K8s or managed scheduler |

API stays thin; workers scale independently (`--scale worker=5`).

## Phase 4 — Production platform

| Concern | Modern default |
|---------|----------------|
| Orchestration | Kubernetes (EKS/GKE) or Fly.io/Railway for smaller teams |
| Autoscaling | HPA on CPU/latency + KEDA on queue depth |
| Observability | OpenTelemetry → Grafana/Datadog |
| Migrations | Prisma/Flyway in CI; expand-contract for zero-downtime |

## Metrics that matter

- p95/p99 API latency
- Postgres: `active_connections`, replication lag, buffer hit ratio
- Redis: memory, evictions, command latency
- Error budget burn — not "CPU on RAC node 3"

## What we deliberately skipped (for now)

- Multi-region active-active (hard; add when revenue justifies)
- Citus/Cockroach sharding (last resort)
- Custom connection pooler in app code (PgBouncer exists)

## Next build targets in this repo

1. `apps/worker` — queue consumer scaled separately from API
2. `docker-compose.replica.yml` — local read replica for dev
3. Prisma schema + migration pipeline
4. OpenTelemetry middleware on API

When you're ready, say which workload (API QPS, analytics, ERP transactions) and we'll prioritize the next phase.
