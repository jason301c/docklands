# AGENTS.md

`server/core/` is the backend/domain library.

- Domain services belong in `server/core/services/`; keep side effects explicit and testable.
- Database schema lives in `server/core/db/schema/`. After schema edits, run `pnpm migration:generate` and commit SQL plus `drizzle/meta` updates.
- Docker, Traefik, deployment, backup, and runtime helpers are security-sensitive. Prefer structured arguments and existing helper APIs over string-built shell commands.
- Auth and permission changes should preserve least privilege, auditability, and organization scoping.
- Template logic belongs in `server/core/templates/`, not a root-level `templates/` directory.
- Runtime helpers that back production behavior belong in `server/core/runtime/`.
