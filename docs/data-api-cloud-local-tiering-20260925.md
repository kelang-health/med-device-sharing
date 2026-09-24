# Data API / Cloud-to-Local storage reduction — non-disruptive evidence and safe gates (25 Sep 2026)

## Decision
The user policy is: JHCIS is authoritative for houses/persons, `jreportdb` on Local holds relevant reporting/history copies, and Cloud should retain only the minimum needed for responsive, role-scoped mobile workflows. **Do not delete live Cloud records simply because a local encrypted copy exists.** No Supabase Production SQL, Auth, LINE, front-end, local JHCIS write, or live cache deletion was performed in this audit.

## Storage and functional guardrails
- Keep current Cloud identities/roles/LINE metadata, active house and person projections, volunteer/home assignments, live booking/field-request states and the least information necessary to verify scope and reconcile source keys. Never export CID, phone, token or health detail to public GitHub.
- Historical inactive persons and removed/superseded houses may be archived in restricted Local `jreportdb`, but FK/reference/reader checks are mandatory **before** designing an alternative thin Cloud tombstone/relink migration. Do not break `houses`/`health_persons` keys or `health_can_access_house`.
- Current Cloud caches for screening targets, screening plans and snapshot reports are still queried. Local-side precomputation and explicit narrowly scoped Cloud summaries require separate synthetic role regression and latency measurement; moving cache rows unchanged may increase HTTP traffic and worsen app performance.
- Review performance samples and older reconcile audits as possible *retention-policy* candidates only after defining retention periods, legal/audit need, runtime reads and restoration. Do not purge security, OAuth, audit, notification, clinical records, migration history or booking data as a generic storage workaround.
- Postgres `DELETE` does not guarantee immediate physical disk reclaim; heavy vacuum/full-table rewrites can block reads and writes. Use measured database/storage metrics and separately approved low-load maintenance only if a future migration demonstrates safe reclamation.
- Keep local replica single-writer controls, separate encrypted off-host restore-tested backup and correct existing encryption key; a single Local table is not an independent disaster-recovery copy. Local-only archive tables are excluded from the existing 37-table JReport primary↔local comparison. Do not mistake primary/local report alignment for proof that archive rows have a second independent copy.

## Strict release criteria
1. Validate the local archived cohort's **full payload**, key lineage, encryption-key readback, source PCU, current Cloud identities and archived/restored row semantics, not only row counts or an MD5 digest of IDs; match after a quiesced, fresh source snapshot.
2. Prove every referencing FK, view, RPC, RLS policy, client query, sync job and downstream report has a replacement or requires the Cloud row to remain. Preserve clinical/audit/legal retention.
3. Build a separate, synthetic, isolated migration and rollback/forward-fix plan. Test real USER/STAFF/ADMIN/backend and partial offline/failed-local connectivity. No surprise Cloud→Local requests from browser or exposure of the private local service.
4. Compare mobile response time, request count, cache hit, Cloud bandwidth and storage footprint before/after on a disposable environment with representative non-identifying fixtures. Fail closed on regression.
5. Require separate explicit deployment authorization, a verified independent backup and a quiet-window plan for any actual Cloud deletion. The current Data API DEPLOY READINESS gate stays BLOCKED until full migration replay and API regression pass.

## Automated non-destructive check
`tests/data-api-cloud-local-retention-safety.cjs` rejects automatic Cloud deletion for every listed table, even with matching archived row counts and sample readback. It contains only synthetic metadata and cannot read or modify user data.

## med-device-sharing findings
- No med-device borrower/loan table or patient reference data was copied or deleted. Public equipment/borrow history and clinical/audit fields must remain available for live borrow, returns, availability, servicing, and legal retention unless a separately tested local workflow replaces them.
- The separate 46-version Supabase history replay gate remains BLOCKED. Do not share med-device source migrations/data-import rows or borrower IDs on GitHub.
