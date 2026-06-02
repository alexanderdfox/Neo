# Security Baseline

No app is "100% secure," but this repository now enforces a practical security baseline.

## Implemented controls

- Admin/settings APIs require bearer token auth (`ADMIN_TOKEN`) in production.
- Security headers enabled:
  - `Content-Security-Policy`
  - `Strict-Transport-Security` (production)
  - `X-Content-Type-Options`
  - `X-Frame-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
- CORS allowlist via `CORS_ORIGIN` (disabled if unset).
- Input validation on mutable settings.
- Redis-backed rate limiting on settings write/apply endpoints.
- CI security automation:
  - `.github/workflows/security-ci.yml` runs npm audits, secret scanning (Gitleaks), and CodeQL.
  - `.github/dependabot.yml` enables weekly dependency and GitHub Action updates.

## Required production configuration

Set these environment variables:

- `ADMIN_TOKEN` (long random secret, at least 32 chars)
- `CORS_ORIGIN` (exact trusted frontend origin)
- `TRUST_PROXY=true` only behind a trusted ingress/proxy
- `NODE_ENV=production`

## Operational checklist

- Enable TLS termination and redirect HTTP to HTTPS.
- Rotate `ADMIN_TOKEN` regularly and on incident.
- Keep dependencies patched (`npm audit`, CI scanners).
- Restrict database and Redis network exposure.
- Enable centralized logs and alerting for 401/429 spikes.
- Back up Postgres and test restore.

## Note

This is engineering guidance, not legal/compliance certification or formal pentest attestation.

