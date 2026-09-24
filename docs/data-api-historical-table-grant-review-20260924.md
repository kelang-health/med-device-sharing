# Historical table-grant review — med-device-sharing (2026-09-24)

**Review-only evidence. Do not execute a mass GRANT or apply a default-privilege change to production.**

Per-table examination of recorded Supabase migration SQL identified 21 literal `CREATE TABLE public.*` occurrences across 46 history records; **13 occurrences lack a table-specific GRANT within their own migration** (textual conservative check, not a proven production failure). One further literal create is in `app_private`. The existing public catalog contains 25 tables, all RLS-enabled. Some tables may have originated outside this recorded history.

| Recorded migration | Table | Catalog privilege / policy classification | Required action before isolated replay |
| --- | --- | --- | --- |
| 20260914222240 | audit_logs | authenticated admin SELECT, staff INSERT policies | Explicit minimum auth SELECT/INSERT as needed, never anon client grant. |
| 20260914222240 | borrow_extensions | authenticated staff SELECT/INSERT policies | Explicit scoped auth SELECT/INSERT if client uses direct table. |
| 20260914222240 | borrow_logs | authenticated staff SELECT/INSERT/UPDATE policies | Explicit necessary auth privileges; verify staff auth and no anon row access. |
| 20260914222240 | borrowers | authenticated staff SELECT/INSERT/UPDATE policies; anon currently has SQL grant but no anon RLS allow policy | No anon grant for identifiable borrower data; check anonymous UI boot and empty-result vs permission-denied behavior. |
| 20260914222240 | equipments | authenticated staff SELECT, admin INSERT/UPDATE/DELETE policies | Explicit policy-aligned authenticated table privileges; ensure administration scoped in RLS. |
| 20260914222240 | maintenance_logs | authenticated admin SELECT, staff INSERT policies | Explicit minimum authenticated privileges. |
| 20260914222240 | profiles | authenticated self/admin SELECT and admin UPDATE policies | Explicit minimum authenticated privileges and scope tests. |
| 20260914222240 | public_content | authenticated admin write and public SELECT policy | Explicit anon SELECT, authenticated SELECT/required write privileges. |
| 20260914222240 | system_settings | authenticated admin SELECT/INSERT/UPDATE/DELETE policies | Explicit authenticated minimum privileges; do not grant anon. |
| 20260914222510 | public_dashboard_stats | public SELECT policy | Explicit anon SELECT and authenticated SELECT if used; no anon write. |
| 20260915025838 | audit_log_archive | deny-client RLS; current broad anon/auth SQL grants | **Server-only:** do not regrant anon/auth on rebuild. |
| 20260915025920 | backup_runs | deny-client RLS; current broad anon/auth SQL grants | **Server-only:** do not regrant anon/auth on rebuild. |
| 20260917003844 | equipment_meter_readings | client-deny RLS; already revoked client grants | **Server-only:** preserve denial. |

The `line_hub` schema has 11 tables with no direct SELECT grant to anon/auth/service_role in current catalog. Anonymous API calls with `Accept-Profile: line_hub` for `services` returned HTTP 406 (not sufficient alone to prove all Dashboard exposed schema settings). A zero-row (`limit=0`) anon read for `public_content` and `borrowers` returned 200. This confirms API reachability for those requests only; it does **not** prove borrower rows are visible or invisible.

No complete `supabase/migrations` directory is in the public repository, and the stored SQL history is approximately 167,496 characters. Do not publish unreviewed original migrations with potentially sensitive hardcoded values. Restore privately, review, replay in isolation, then perform role-bound API smoke tests. Existing public tables and default ACLs remain unchanged.
