# ClientFlow API Extraction Audit

## Decision

ClientFlow is moving to a standalone NestJS/Prisma service located at `clientflow-hub/clientflow-api`. API 2 remains authoritative during scaffolding and compatibility work. No ClientFlow code, route, migration, or environment requirement is removed in this phase.

## Ownership summary

| Surface | Current location | Destination | Compatibility | Risk | Action |
|---|---|---|---|---|---|
| ClientFlow controllers/services/DTOs | `src/modules/clientflow` | New API domain modules | Keep API 2 routes | High | Port with parity tests |
| ClientFlow schema/migrations | `prisma/clientflow` | New API Prisma | API 2 remains migration owner | High | Copy now; transfer execution later |
| Identity and organizations | `auth`, `organizations`, ClientFlow schema | New API | Preserve cookie contract | High | Copy patterns; no runtime coupling |
| Public forms/tokens | ClientFlow module | New API forms | Preserve distributed links | High | Port before URL cutover |
| Notifications/email/n8n | ClientFlow + shared notification module | New API integrations | Preserve delivery receipts | High | Port disabled; verify workflows |
| R2 documents | ClientFlow + shared files module | New API storage | Preserve object keys/bucket | High | Copy pattern and test signed URLs |
| Guards/errors/validation/audit | Shared API 2 infrastructure | Local copies | None after cutover | Medium | Refactor patterns only |
| API 2 non-ClientFlow modules | API 2 | API 2 | None | Low | Keep |
| Frontend API client | `clientflow-hub/src/lib/apiClient.ts` | Frontend | Keep API 2 base URL now | High | Switch only after parity |

## Routes

Current dedicated routes are defined by `ClientflowController` under `/api/v1/admin/cf` and `PublicFormController` under `/api/v1/public/form`. They cover clients, programs, enrollments/history, templates, assignments/send, intake submissions, notifications, terms, monitoring/history, contracts, documents/upload/download, communications, final reports, activity, demo/live-mode, and public form render/submit. ClientFlow Hub also consumes partitioned `/api/v1/auth` and `/api/v1/organizations` routes. The nested service documents every method/path in `docs/API_ROUTES.md`.

## Data model

The ClientFlow schema owns organization/admin/session/invitation/audit/notification records plus client, program, enrollment, intake, forms, terms, contracts, documents, communications, reports, tasks, progress, goals, monitoring, history, and evidence models. Preserve camelCase Prisma fields and existing IDs.

`ClientContact` is embedded in `CfClient`; answers are JSON; secure form tokens live on assignments/render sessions; `ContractTemplate`, `EmailEvent`, and `WebhookEvent` are not first-class models. Additions or renames require explicit migrations and backfills after parity.

## Environment ownership

Temporary API 2 ownership includes `CLIENTFLOW_DATABASE_URL`, ClientFlow R2 bucket settings, ClientFlow n8n form-email configuration, shared email credentials, JWT/cookie configuration, CORS origins, and partition metadata. The new API uses its own `DATABASE_URL`, JWT secrets, CORS/app URLs, R2 credentials, email sender values, and n8n credentials. Never share API 2 database credentials.

## Deployment coupling

API 2 currently generates the ClientFlow Prisma client and runs ClientFlow migrations plus compatibility repair scripts during deployment. Do not remove those phases until the new Render service has an approved database, verified migration history, full route parity, and production verification.

## Cutover and rollback

Create the Render service with automatic deployment and outbound integrations disabled. Port and test authentication, organization isolation, lifecycle rules, public links, n8n, storage, audit, and archive restore. Then switch the frontend base URL, observe production, disable API 2 routes, and remove old ownership in a later change. Rollback restores the frontend URL and disables new outbound effects while preserving both databases for reconciliation.
