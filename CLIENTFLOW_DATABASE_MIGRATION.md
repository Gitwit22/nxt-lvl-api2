# ClientFlow Database Migration

ClientFlow now uses `CLIENTFLOW_DATABASE_URL`; platform identity, organizations, and audit logs continue to use `DATABASE_URL`. The old `Cf*` tables in the primary database are intentionally left untouched for rollback.

## Production Deployment Order

Render runs database work once in its pre-deploy phase:

1. Deploy primary migrations against `DATABASE_URL`.
2. Deploy ClientFlow migrations against `CLIENTFLOW_DATABASE_URL`.
3. Run the idempotent ClientFlow schema compatibility scripts.
4. Start the compiled API without rerunning migrations.

The build phase only installs dependencies and compiles the API. Service restarts only run `node dist/main`.

## One-Time Primary Baseline

The primary migration directory starts with an incremental migration, not a complete schema baseline. It cannot bootstrap an empty database. A populated primary database without a `_prisma_migrations` history produces Prisma error `P3005` and must be baselined once.

1. Create a Neon branch or point-in-time backup of the primary production database.
2. Run `scripts/audit-primary-migration-baseline.sql` against `DATABASE_URL` in the Neon SQL editor.
3. For each migration, confirm every listed object reports `is_present = true`. A migration with a mix of present and missing objects is partial; stop and repair it with reviewed, idempotent SQL before continuing.
4. Mark only fully represented migrations as applied, in chronological order:

```powershell
npx prisma migrate resolve --applied 20260818225500_add_clientflow_live_mode --schema prisma/schema.prisma
npx prisma migrate resolve --applied 20260831120000_add_refresh_sessions --schema prisma/schema.prisma
npx prisma migrate resolve --applied 20260903120000_add_admin_job_title --schema prisma/schema.prisma
```

Do not run a `resolve` command for a migration whose audit contains `false`. Leave an entirely absent migration pending so `prisma migrate deploy` can apply it. Leave `20260903130000_restore_platform_seed_login` pending; its update/upsert is idempotent and Prisma should execute and record it normally.

Never insert rows into `_prisma_migrations` manually. `prisma migrate resolve` records the expected checksum and migration metadata.

After resolving the verified migrations, run:

```powershell
npx prisma migrate status --schema prisma/schema.prisma
npm run prisma:deploy
npx prisma migrate status --schema prisma/schema.prisma
npm run prisma:deploy:clientflow
npx prisma migrate status --schema prisma/clientflow/schema.prisma
```

Both status commands must report that the database schema is up to date before deploying the application.

## Preflight

1. Confirm both URLs point to direct PostgreSQL connections and the target ClientFlow database is empty.
2. Take or verify the primary Neon backup.
3. Deploy code only after the copy and verification complete.
4. Pause ClientFlow writes for the maintenance window. Other platform traffic may continue.

## Maintenance Window

Run from the API repository with both environment variables set:

```powershell
npm ci
npm run prisma:generate
npm run prisma:deploy:clientflow
npm run clientflow:data:copy
npm run clientflow:data:verify
```

The copy command only reads `Cf*` tables from `DATABASE_URL`. It upserts target rows by stable IDs, so it can be rerun after a partial failure. It discovers source columns dynamically to support the legacy source schema, creates deterministic enrollments for legacy client/program pairs, and links operational records when the enrollment is unambiguous.

Do not run `prisma migrate deploy` for the primary schema during the initial data cutover until its migration history has been verified and baselined as described above.

## Form Normalization

After the ClientFlow database exists, use the secure runner to deploy pending ClientFlow migrations, audit repeated intake fields, and optionally apply normalization:

```powershell
npm run clientflow:forms:deploy
```

The runner prompts for `CLIENTFLOW_DATABASE_URL` when it is not already set, keeps it only in the current process, prints the target host and database without credentials, and requires typing `APPLY` after the dry-run report. To run the commands separately, first set `CLIENTFLOW_DATABASE_URL` in the same PowerShell session.

## Cutover

1. Keep ClientFlow writes paused after verification succeeds.
2. Deploy the API with `CLIENTFLOW_DATABASE_URL` configured.
3. Smoke-test login, client/program lists, one secure intake render, and one controlled submission.
4. Resume ClientFlow writes.

## Rollback

1. Pause ClientFlow writes.
2. Roll back the API deployment to the previous version.
3. Keep the new ClientFlow database for investigation; do not copy data back automatically.
4. Resume traffic only after confirming the previous API reads the untouched primary `Cf*` tables.

For a primary baseline failure, inspect `_prisma_migrations` before restoring data. A successful `migrate resolve` changes migration metadata only. Restore the Neon backup only when migration SQL changed schema or data and a forward repair is not appropriate.
