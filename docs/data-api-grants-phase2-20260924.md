# Phase 2 — Data API explicit GRANT readiness (24 Sep 2026)

**Status: staged for review; no SQL applied to production.** Scope: med-device-sharing and the colocated LINE Service Hub schema. Existing app, auth, device loans, server connectors, and LINE webhook are unchanged.

## Evidence from connected production DB (read-only inspection)

- Project `txjuiaiwffsxfcrxpkvd`: 25 public tables, all RLS-enabled; 13 have anon SQL-level SELECT/INSERT/UPDATE/DELETE grants, but only the `public_content` and `public_dashboard_stats` public SELECT RLS policies intentionally permit anon row access. Do not confuse SQL grants with actual row-level authorization.
- `line_hub` contains 11 tables; none has SELECT granted to anon, authenticated or service_role. No direct Data API access is intended: preserve the private/backend connection model and verify actual Dashboard exposed schemas.
- Default ACLs for `postgres` and `supabase_admin` currently grant public-table DML automatically. Explicit grants are necessary for *new* public Data API tables after the Supabase change.
- The database has 46 migration records; a complete replayable `supabase/migrations` baseline is **not present in this repository**.
- Two of nine migrations containing `CREATE TABLE` do not contain a literal `GRANT` in the same recorded migration: `backup_runs` (server-only backup support, RLS enabled) and `equipment_meter_readings` (explicit client REVOKE and deny-client policy). No blanket GRANT should be added to these tables. Remaining migrations require per-table verification; merely having any GRANT statement is insufficient.
- Four public JHCIS mapping/verification support tables and the 11 `line_hub` tables have RLS enabled without policies: intended deny-by-default may be appropriate, verify backend connection/privileges separately.

## Implementation now

`database/phase2/20260924_future_public_table_defaults_candidate.sql` is **review-only**. It changes default ACLs only for future public tables created by `postgres`; it does not touch existing tables or the `line_hub` schema. Do not install it in an auto-deployed migration until historical migrations and isolated rebuild tests pass.

For each new table: add RLS, role-scoped policies and the **minimal explicit grants** in the same migration. Do not grant direct browser privileges on patient mappings, verification tickets, backups, LINE Hub internal tables or sensitive borrowers data merely to avoid a 42501 error. Keep server-only access server-side and grant any required sequences/RPCs separately.

## Gates before deployment

1. Reconstruct historical migrations; compare clean rebuilt schema, GRANTs, RLS, policies and API behavior to production.
2. Verify data API exposed schemas in the Dashboard and actual LINE Service Hub backend connection roles.
3. Test anon public summary access, authenticated staff functions, denied direct patient-map/LINE Hub reads, and authorized server-only workflows.
4. Audit SECURITY DEFINER and database advisors independently. Roll out only after isolated tests and app regression.

## Creator-role permission check (24 Sep 2026)

Read-only SQL confirmed that the connected SQL role is `postgres`, with role membership to manage its own defaults, **but without membership in `supabase_admin`**. The candidate SQL deliberately omits `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin` to avoid a privilege error that would roll back the entire transaction. Track supabase_admin-created public tables separately using an authorized owner/platform-managed mechanism; do not elevate postgres or grant broad roles as a workaround. No SQL was executed against production in this phase.
