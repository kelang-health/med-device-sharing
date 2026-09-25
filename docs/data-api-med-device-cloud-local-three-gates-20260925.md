# med-device-sharing: Cloud→Local three-gate assessment (25 September 2026)

This is an audit-only document for the existing DRAFT Data API PR. No borrower/equipment row was exported, archived, deleted or changed; no front-end, login, LINE, live API or production schema was changed.

## 1. Restore evidence and retention
OSM-PHC's already existing Local `jreportdb` person/house archive and the new separately encrypted same-computer file belong **only to the OSM-PHC population/household project**. They do not contain or validate med-device borrower, equipment, reservation or maintenance history. A complete med-device historical migration source and independently restored, source-verified borrower/asset archive were not established. Never treat the other project's archive or a CI synthetic fixture as a loan-record backup. No Cloud med-device record is eligible for deletion under this audit.

## 2. Local-first options without breaking current site
Equipment availability, active loans and returns, borrower/role control, pending maintenance, audit trails, and required LINE integration must remain available to existing authorized API paths. For future design only, compute closed-period aggregate equipment usage and reports in restricted Local, then publish minimal versioned, access-controlled summary if existing live UI actually needs it. A user-facing page must not directly connect to Local, must not receive patient IDs, private keys or service-role credentials, and must fail closed when Local reports are unavailable. The scope and schema require real gateway/frontend/RLS testing on an isolated disposable environment before any implementation.

## 3. Current Cloud footprint and limits
Read-only PostgreSQL catalog currently reports combined relation sizes including indexes/TOAST: `equipment_history` 270,336 bytes, `borrow_logs` 262,144 bytes, `audit_logs` 229,376 bytes, `equipments` 172,032 bytes, `borrow_evidence` 163,840 bytes, `borrow_extensions` 155,648 bytes, `maintenance_plans` 131,072 bytes. The previously checked database footprint is approximately 15 MiB. These table sizes are NOT reclaimable-byte estimates and very small versus the larger OSM-PHC Cloud tables. Full offsite restore, legally required retention, row-level dependencies, current gateway read paths and prospective local availability remain unverified.

Guaranteed Cloud storage reclaimed by this work: **0 bytes**. No real med-device response-time or request-count before/after measurement was performed, since nothing was deployed. The OSM-PHC fabricated card benchmark must not be applied to equipment/borrower performance.

**Next gate:** recover and vet 46 recorded migration sources; separately approve encrypted independent med-device backup/restore with no public exposure of borrower data; analyze actual UI/gateway/RLS/LINE field dependencies and retention policy; test a local aggregate reporting pilot with synthetic med-device data in isolated infrastructure; record real p50/p95, API calls and storage before proposing changes. Keep current Draft PR, deployment-readiness block, and production website unchanged.
