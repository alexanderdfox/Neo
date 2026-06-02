# Neo

Modern, horizontally scalable core — the opposite of Oracle RAC theater: **stateless apps, pooled Postgres, Redis, scale out when load demands it.**

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

- API: http://localhost:3000/health
- Postgres (direct): `localhost:5432`
- PgBouncer: `localhost:6432`
- Redis: `localhost:6379`

## Migrations (Prisma)

Prisma owns the schema via `prisma/schema.prisma`:

```bash
cd apps/api
npx prisma generate
npx prisma migrate dev --name init
```

For CI / production, use:

```bash
npx prisma migrate deploy
```

## Scale the API (Phase 1)

```bash
docker compose -f docker-compose.yml -f docker-compose.scale.yml \
  --profile scale up --build --scale api=3
```

```bash
# Prove shared state across replicas
for i in $(seq 1 10); do curl -s -X POST http://localhost:3000/scale/ping; done
curl -s http://localhost:3000/scale/stats
```

See [docs/SCALING.md](docs/SCALING.md) for the full playbook (read replicas, workers, K8s).

## Oracle vs Neo (this repo)

| Oracle reflex | Neo |
|---------------|-----|
| RAC clusters | Stateless API replicas + connection pooling |
| Session state in DB | Redis for ephemeral / hot paths |
| Per-core licensing | Open source stack, scale on usage |
| DBA-gated changes | Migrations in app CI, `docker compose up` |
