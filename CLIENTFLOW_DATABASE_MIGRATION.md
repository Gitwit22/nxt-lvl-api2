# ClientFlow Database Migration

ClientFlow now uses `CLIENTFLOW_DATABASE_URL`; platform identity, organizations, and audit logs continue to use `DATABASE_URL`. The old `Cf*` tables in the primary database are intentionally left untouched for rollback.

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

Do not run `prisma migrate deploy` for the primary schema as part of this cutover. Its migration history must be verified separately.

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
