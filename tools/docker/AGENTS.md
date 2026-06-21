# AGENTS.md

`tools/docker/` contains repository-level Docker image build and push helpers.

- Scripts should work from any current working directory by resolving the repository root from their own path.
- Build context is the workspace root; Dockerfile is `apps/docklands/Dockerfile`.
- Read the image version from `apps/docklands/package.json`.
- Do not put production runtime logic here. Runtime entrypoints belong in `apps/docklands/server/ops/` or the app Dockerfile.
