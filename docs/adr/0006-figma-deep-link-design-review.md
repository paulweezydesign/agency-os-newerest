# Figma deep-link on design review

Design reviews store an optional **Figma URL** (`file` or `design` path) plus resolved `figmaFileKey` / `figmaFileName`. Attachment validates via a `FigmaClient` seam (in-memory mock in v1; HTTP Files API when `FIGMA_ACCESS_TOKEN` is set). Failures are logged to AgentActionLog and returned as actionable 400s. Asset URL remains supported; when only Figma is provided, the Figma URL doubles as `assetUrl` for the existing open-link UX. Approve/reject is unchanged.
