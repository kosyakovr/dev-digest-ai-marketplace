# Changelog

All notable changes to `engineering-paved-path` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0]

### Added
- Twelve technical skills: `react-best-practices`, `react-testing-library`, `next-best-practices`, `fastify-best-practices`, `onion-architecture`, `frontend-ui-architecture`, `drizzle-orm-patterns`, `postgresql-table-design`, `zod`, `typescript-expert`, `security`, `mermaid-diagram`. All but `next-best-practices` were copied from the DevDigest project and stripped of project-specific paths and rules, keeping their section numbers; `next-best-practices` was written anew from the official Next.js documentation.
- `skill-routing`: maps files and technologies to the skill sections that govern them, for agents that plan, implement or review code.
- `THIRD_PARTY_NOTICES.md` with the origin and license of every copied skill.

### Removed
- The `scaffold-service` and `write-adr` skill stubs and the `paved-path-auditor` agent stub.

## [0.1.0]

### Added
- Initial stub: `scaffold-service` skill with paved-path conventions, `write-adr` skill with ADR template, `paved-path-auditor` agent.
