# Mastra-in-Next monolith for v1

We run AgencyOS as a **Next.js 15 App Router monolith** hosting Mastra agents/workflows and API routes, sharing MongoDB — not a NestJS API + Next split (PRD) and not a separate Mastra worker process yet. Goal is one deployable unit for the hybrid human UI + agent workforce; extract a worker if agent jobs starve the web tier.
