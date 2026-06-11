# Zero-Trust Healthcare Improvements

This note translates the research discussion into practical project changes for the Hospital Management System.

## Brainstormed Improvements

1. MFA authentication: keep password-first login and OTP as a second factor.
2. Hybrid ABAC-RBAC: keep role checks, then add contextual policy checks such as trust score, verified account state, time window, and emergency break-glass reason.
3. Dynamic trust evaluation: score every protected request from session age, recent failed attempts, verified state, device fingerprint, and request context.
4. Continuous session verification: keep checking whether an account is active after token issuance.
5. Emergency-aware access control: allow carefully audited break-glass access for doctor/admin users when normal context policy would deny access.
6. Patient-centric consent: add future patient-consent records that bind patient, provider, resource, purpose, expiry, and revocation status.
7. Audit trail: write every access decision as append-only JSONL with hash chaining so later blockchain anchoring or external notarization can use the log root.
8. Performance evaluation: measure trust-score overhead, Redis cache hit rate, access decision latency, and audit write latency.

## Implemented In This Pass

- Dynamic request trust scoring in the auth service.
- ABAC-style policy options for `requireRole()`.
- Emergency break-glass support via `x-break-glass-reason` for doctor/admin policy checks.
- Access-decision audit logging with hash chaining.
- `/me` now returns the current request trust context.

## Next Implementation Candidates

- Patient consent model and middleware for patient-owned resources.
- Dedicated policy decision endpoint for other services.
- Audit log anchoring job that periodically stores the latest hash in an external ledger.
- Admin dashboard for low-trust sessions and break-glass access reviews.
