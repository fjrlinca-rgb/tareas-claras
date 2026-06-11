# Database migrations

Forward-only SQL migrations applied with `npm run migrate`.

## Conventions

- File name: `YYYYMMDDHHMMSS_<slug>.sql` (auto with `npm run migrate:create -- <name>`).
- Wrap statements in `BEGIN; ... COMMIT;` — the runner also wraps each file in a transaction.
- Once applied, files are immutable. Their SHA-256 checksum is verified on every run. To change behaviour, create a new migration.
- The runner tracks state in `public.schema_migrations(version, checksum, applied_at)` (created automatically).

## Workflow

```bash
# scaffold
npm run migrate:create -- add_users_index

# review files in backend/migrations/

# apply pending
npm run migrate

# inspect
npm run migrate:status
```

## Initial schema

The base schema lives in `helpdesk_schema_pg12.sql` and is loaded **once** during initial deployment (see `README_DEPLOY.md`, step 2.3). All subsequent DB changes go through this migrations folder.
