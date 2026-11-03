# Outreach CRM (inside mtd-api)

Prospect outreach tables, entities, and admin APIs. Deploy with the main API only.

## Auth

Reuses platform admin login. No separate outreach auth.
Protect with JwtAuthGuard + AuthAudience admin (same as /admin).

## API prefix

/api/v1/outreach/...

Key routes: firms, contacts, touchpoints, templates, sequences, tasks/today, suppressions, campaigns, contacts/:id/release|advance-step|stop-sequence.

## Admin UI

/admin/outreach/queue
/admin/outreach/prospects
/admin/outreach/templates
/admin/outreach/campaigns
/admin/outreach/suppressions

## Database

Same MySQL DB as product. Tables start with outreach_.

Apply:

npm run migration:run

Migrations:
- 1782300000000-AddOutreachCrmTables.ts
- 1782400000000-AddOutreachReleaseHeld.ts

Optional seed:

mysql -u USER -p DB_NAME < src/database/sql/outreach_002_seed_sequences_templates.sql
