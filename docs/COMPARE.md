## Neo vs Oracle — Use Cases

We're not just replacing Oracle — we're making it irrelevant for new work.

### Greenfield products / SaaS platforms

- **Neo**: Postgres + Prisma + Hono + Redis + OTEL, infra as code, deploy anywhere.
- **Oracle**: DB + middleware + EBS/PeopleSoft/Siebel-style stacks.
- **When Neo wins**: Fast iteration, self-serve schema changes, easy hiring (TypeScript/Postgres familiarity).

### High-traffic APIs that need cheap horizontal scale

- **Neo**: Stateless APIs, PgBouncer, Redis, OTEL; scale with `--scale api=N`.
- **Oracle**: RAC nodes, bigger boxes, expensive licenses.
- **When Neo wins**: Spiky or growing traffic where you want to scale out cheaply and observe p95/p99 in real time.

### Event-driven systems & background processing

- **Neo**: Postgres as system-of-record, Redis queues, language-native workers (Inngest/Temporal/BullMQ style).
- **Oracle**: PL/SQL packages, Advanced Queues, logic buried in the DB.
- **When Neo wins**: Versioned workflows in code, multi-language microservices, testable and reviewable logic.

### Analytics + product telemetry

- **Neo**: OpenTelemetry from API/DB into any OTLP backend (Grafana, Datadog, Tempo, etc.).
- **Oracle**: Exadata, AWR reports, DB-centric performance views.
- **When Neo wins**: You want system-wide traces/metrics/logs that are cloud/vendor agnostic.

### ERP-lite / line-of-business systems

- **Neo**: Composable services (orders, inventory, billing) built on Postgres + Prisma + workflows.
- **Oracle**: EBS/PeopleSoft/NetSuite monoliths and heavy customization projects.
- **When Neo wins**: You need just enough ERP, tightly tailored to your domain, without a suite and consultants.

### Multi-cloud & portability

- **Neo**: Cloud-agnostic components (Postgres, Redis, OTEL, Node) that run on AWS/GCP/Fly/Railway/on‑prem.
- **Oracle**: OCI gravity, license audits, complex contracts.
- **When Neo wins**: You care about negotiating power and being able to move workloads without rewrites.

### Small teams needing enterprise-grade behavior

- **Neo**: Docker locally, simple promotion to K8s/Fly/Railway; migrations and observability baked in.
- **Oracle**: Requires DBAs, architects, and process to keep the stack healthy.
- **When Neo wins**: 2–10 engineers owning everything from code to schema to traces without specialist roles.

