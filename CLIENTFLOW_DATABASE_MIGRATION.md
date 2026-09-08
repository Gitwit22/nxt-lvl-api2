# ClientFlow Database Migration

ClientFlow uses `CLIENTFLOW_DATABASE_URL` as its sole data store, including its identity, organization, session, invitation, lifecycle, and audit data. `DATABASE_URL` is platform-only. The databases must be distinct, and the primary database must not contain `Cf*` tables.

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
3. Confirm every required platform object reports `is_present = true` and `clientflow_tables_absent = true`. Legacy `Cf*` objects are reported separately because their absence is the desired isolated state.
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

Both status commands must report that the database schema is up to date before deploying the application. Run `scripts/audit-clientflow-isolation.sql` against `CLIENTFLOW_DATABASE_URL` and require every orphan count to be zero.

## Preflight

1. Confirm both URLs point to distinct direct PostgreSQL connections and the ClientFlow database is the intended wild-moon production branch.
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

The copy command is retained only for recovery from a legacy backup that still contains `Cf*` tables. It refuses to run against an already-clean primary database. Do not use it during normal deployments; wild-moon is authoritative.

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
2. Roll back the API deployment only to a version that still uses `CLIENTFLOW_DATABASE_URL` as the ClientFlow source of truth.
3. Restore or branch wild-moon from its verified Neon backup when data recovery is required; never copy ClientFlow data back into the primary database.
4. Resume traffic only after login, bootstrap, and a controlled ClientFlow read succeed against wild-moon.

For a primary baseline failure, inspect `_prisma_migrations` before restoring data. A successful `migrate resolve` changes migration metadata only. Restore the Neon backup only when migration SQL changed schema or data and a forward repair is not appropriate.
