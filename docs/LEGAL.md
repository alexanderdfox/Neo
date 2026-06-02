# Legal and Compliance Baseline

This project is set up to be legally clean by default, but no software can be guaranteed "100% legal" across every jurisdiction and deployment without advice from qualified counsel.

## What this repo already has

- Project license: BSD 3-Clause (`LICENSE`)
- Source-controlled dependencies (via `package.json` files)
- No proprietary Oracle SDKs or Oracle-licensed runtime dependencies

## Required checks before shipping

1. **Dependency license audit**
   - Run an SPDX license inventory for `apps/api` and `apps/web`.
   - Confirm all licenses are compatible with BSD-3-Clause distribution.
   - Flag copyleft obligations (GPL/AGPL/LGPL) before production use.

2. **Third-party notices**
   - Maintain attribution in `docs/THIRD_PARTY_NOTICES.md`.
   - Include required copyright and notice text in releases.

3. **Privacy and data handling**
   - If telemetry is enabled, disclose collection and retention policy.
   - If personal data is processed, publish privacy terms and data-subject request process.

4. **Security and export controls**
   - Confirm cryptography/export requirements for your target countries.
   - Keep dependency and container image scanning in CI.

5. **Commercial readiness**
   - Add Terms of Service and Privacy Policy before public launch.
   - Verify trademark/branding clearance for "Neo" name and logo use in your markets.

## Recommended CI gates

- Fail build on disallowed licenses.
- Fail build on known high/critical vulnerabilities.
- Require THIRD_PARTY_NOTICES updates when dependency lockfiles change.

## Important note

This checklist is engineering guidance, not legal advice.

