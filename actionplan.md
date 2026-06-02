# Neo Action Plan: Make Oracle Irrelevant

This plan is focused on one outcome: deliver a modern platform that is simpler, faster, cheaper, and more useful than Oracle-style stacks.

## North Star

- **10x developer experience** over Oracle-era tooling.
- **50-80% lower total cost of ownership** vs typical Oracle deployments.
- **Faster time-to-value**: production features in weeks, not quarters.
- **Composable architecture** with no vendor lock-in.

## Competitive Positioning (Oracle vs Neo)

- Oracle sells integrated complexity; Neo ships integrated simplicity.
- Oracle optimizes for license expansion; Neo optimizes for customer outcomes.
- Oracle relies on proprietary gravity; Neo uses open standards (Postgres, OTEL, HTTP, SQL, Docker/K8s).

## Product Pillars

1. **Data Platform** (Postgres-first, HA, pooling, observability)
2. **Business Workflows** (ERP-lite modules: order, billing, approvals, reporting)
3. **Control Plane UX** (admin console, settings, audit, policy)
4. **Security & Compliance** (secure-by-default + automated checks)
5. **Migration Engine** (legacy Oracle-to-Neo acceleration)

## 12-Month Execution Roadmap

## Phase 1 (Weeks 1-6): Foundation That Scales

### Goals

- Stabilize core stack for production use.
- Make setup/operations radically easier than Oracle installs.

### Deliverables

- Production-ready API + web control plane.
- Postgres + PgBouncer + Redis baseline with backups and restore tests.
- OpenTelemetry traces/metrics wired to a default backend.
- CI gates: tests, security scans, dependency/license policy.

### Success Metrics

- One-command local boot in < 10 minutes.
- p95 API latency under agreed baseline at target load.
- Zero manual DBA steps for standard schema changes.

## Phase 2 (Weeks 7-12): Oracle Migration Wedge

### Goals

- Make migration from Oracle fast and low-risk.

### Deliverables

- Oracle inventory scanner:
  - schema objects
  - PL/SQL dependency graph
  - risky constructs report
- Data transfer tooling (direct + export/import) with resumable jobs.
- Compatibility cookbook:
  - Oracle SQL/PLSQL pattern -> Neo pattern
  - sequence/date/json/concurrency mapping
- Cutover runbook with rollback and validation checks.

### Success Metrics

- Migrate first reference workload with < 4h planned cutover.
- 99.9%+ record parity validation for migrated entities.

## Phase 3 (Weeks 13-24): ERP-Lite Modules That Win Deals

### Goals

- Replace high-friction Oracle suite use cases with focused modules.

### Deliverables

- Modules:
  - Accounts/ledger foundation
  - Order-to-cash
  - Basic procurement approvals
  - Operational reporting dashboard
- Workflow engine integration (Inngest/Temporal-style orchestration).
- Role-based access control, audit logs, and policy controls.
- API-first integration templates (Stripe, CRM, identity provider).

### Success Metrics

- 3 production customers running at least 2 modules each.
- 30-50% faster process completion vs customer legacy baseline.

## Phase 4 (Weeks 25-36): Enterprise Readiness Without Enterprise Bloat

### Goals

- Meet enterprise buyer expectations while keeping product lean.

### Deliverables

- SSO (SAML/OIDC), SCIM provisioning.
- Fine-grained permissions and tenant isolation hardening.
- Data retention, export, legal hold, and audit trails.
- Regional deployment options and disaster recovery drills.

### Success Metrics

- Pass security review and procurement in target enterprise accounts.
- Recovery time objective (RTO) and recovery point objective (RPO) met in drills.

## Phase 5 (Weeks 37-52): Platform Flywheel

### Goals

- Build compounding advantages Oracle cannot match.

### Deliverables

- Marketplace/integration SDK for partners.
- AI-assisted migration and workflow suggestions.
- Benchmark suite published publicly (cost, latency, migration speed).
- Customer success tooling for expansion based on usage signals.

### Success Metrics

- Measurable expansion revenue from existing customers.
- Public benchmark leadership in at least 2 core workloads.

## Technical Strategy

## Architecture Principles

- Stateless services, horizontally scalable.
- Postgres-first with explicit extensions only when justified.
- Event-driven workflows for long-running business processes.
- Strict API contracts and backward-compatible change discipline.
- Observability-first operations (logs, traces, metrics by default).

## Performance Strategy

- Define and track SLOs: latency, error rate, throughput.
- Use query plans, indexing strategy, and pooling before sharding.
- Separate OLTP from analytics paths as usage grows.
- Benchmark regularly with realistic customer scenarios.

## Cost Strategy

- Favor open-source/runtime portability.
- Measure cost per transaction and cost per tenant.
- Automate infra right-sizing and idle resource cleanup.

## Security Strategy

- Secure-by-default configs, not optional checklists.
- Continuous scanning: vulnerabilities, secrets, static analysis.
- Principle of least privilege across service and data access.
- Incident response playbooks with tested drills.

## Migration Strategy (Strangler, Not Big-Bang)

1. Identify one painful Oracle workflow with high business value.
2. Mirror data + dual-read validation.
3. Shift write path to Neo for selected bounded context.
4. Expand domain-by-domain until Oracle footprint collapses.
5. Keep rollback capability until each domain is stable.

## Product Experience Strategy

- Build admin UX for operators, not DB specialists.
- Every major feature includes:
  - API
  - UI
  - auditability
  - observability
  - docs
- Remove hidden complexity: no magic behavior, explicit controls.

## Go-To-Market Strategy

- Lead with migration pain + cost savings + speed.
- Target teams blocked by Oracle licensing and slow change cycles.
- Offer fixed-scope migration accelerators and success criteria.
- Publish transparent case studies with before/after metrics.

## KPI Dashboard (Must Track Weekly)

- Engineering:
  - deployment frequency
  - lead time for change
  - change failure rate
  - MTTR
- Product:
  - active tenants
  - workflow completion time
  - feature adoption per module
- Business:
  - migration cycle time
  - ACV and payback period
  - expansion revenue
- Reliability:
  - SLO attainment
  - incident count/severity
  - backup/restore success rate

## Risk Register

- **Scope creep** -> enforce phased scope and strict acceptance criteria.
- **Enterprise over-customization** -> productize patterns, avoid one-off forks.
- **Migration complexity** -> build tooling + playbooks early, reuse aggressively.
- **Performance regressions** -> benchmark in CI and pre-release gates.
- **Security incidents** -> harden defaults, run drills, formalize incident process.

## Immediate Next 14 Days

1. Define top 3 target Oracle replacement use cases.
2. Run a baseline benchmark and publish internal scorecard.
3. Implement migration inventory + parity validation tooling.
4. Ship first customer-facing module with end-to-end auditability.
5. Instrument KPI dashboard and set quarterly targets.

---

Execution rule: if a feature does not improve customer outcomes, migration speed, or operating cost, it does not ship.

