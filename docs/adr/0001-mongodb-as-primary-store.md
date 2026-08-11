# MongoDB as the primary data store

AgencyOS is a hybrid human CRM/PM + Mastra agent workforce. We chose **MongoDB only** (via Mongoose) for application data, agent memory/action logs, and vector storage — rejecting PostgreSQL-only (PRD) and a Postgres+Mongo polyglot split — so Mastra observability, RAG, and the task system of record share one operational database and one ops surface. Multi-tenant isolation and relational reporting constraints are accepted trade-offs to revisit only if tenancy/RLS requirements outgrow Mongo.
