# Changelog

All notable changes to Docklands are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Docklands has not had a tagged release yet; everything below is pre-release.

## [Unreleased]

Pre-release state of the Docklands fork. High-level summary:

- **Fork of Dokploy.** Started from upstream `dokploy/dokploy` (`canary`), kept
  the useful base, and reshaped it into a project-first, self-hosted deployment
  control plane for VM operators. Cloud-only and source-available/proprietary
  upstream code paths were removed; the tree is Apache-2.0-compatible only.
- **Workspace canvas.** The primary surface is a project environment canvas
  rendered with React Flow — services are nodes and connections are edges, with
  persisted layout, service connections, generated connection variables,
  deployments, domains, previews, topology grouping, and command-bar navigation.
- **Cloudflare Tunnel ingress.** A beginner-first default that exposes apps
  through a managed `cloudflared` tunnel — no open ports, public IP, manual DNS,
  or certificate setup — alongside the classic public-IP path.
- **Security hardening pass.** Selective review-gated merges of upstream
  security-positive PRs rather than a mass merge, plus a first-install secret
  preflight and tightened secret handling across auth, encryption, and runtime
  boundaries.
