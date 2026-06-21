# AGENTS.md

`server/ops/` contains runtime/admin entrypoints bundled into `dist`.

- These scripts may run during container startup or operational recovery, so keep imports server-only and startup-safe.
- Do not put development-only tooling here; use `tools/` for local generation scripts.
- Be careful with logs: never print secrets, tokens, private keys, database URLs, or generated passwords unless the command explicitly exists to reveal them.
- If an entrypoint is added here, update `package.json`, `esbuild.config.ts`, and docs as needed.
