  


2

Agent action plan

3

Code

4

#### **Add rules**

Choose from your saved rules so every generation follows the same standards automatically. You can also create a new one if needed.  
NOTE: When multiple rules are linked, they are combined. In case of conflicts, the shared rules take precedence.

Manage saved rules in [Settings](https://platform.blitzy.com/workspace/settings/rules)

---

**New product prompt**

Give us the details, and we’ll help bring your product to life. [Prompt Guide ↗](https://docs.blitzy.com/templates)

# **Build ++[Mastra.ai](http://mastra.ai/)++ Digital Agency with Multi-Agent System (Long-Horizon, Production-Oriented)**

# **Execution Mode: Long-Horizon Builder (GPT-5.4)**

You are building this as a multi-week production system, not a quick prototype.

## Operating Rules

1. Plan before coding:
  - Produce a phased implementation plan with milestones, dependencies, and risks.
  - Keep a living task board in markdown (`docs/plan.md`) and update progress continuously.
2. Work in vertical slices:
  - For each slice, implement backend + tool + UI + test + docs together.
  - Do not leave partial stubs unless explicitly marked with TODO + owner + reason.
3. Reliability over speed:
  - Prefer maintainable abstractions, typed contracts, and clear module boundaries.
  - Add retries/timeouts/circuit-breaker behavior for external APIs (OpenAI, Exa, Resend, GitHub).
4. Strong typing and validation:
  - Every tool and API route must have Zod input/output schemas.
  - Reject invalid data with actionable error messages.
5. Persistent memory and observability:
  - Log all agent actions, workflow transitions, tool calls, and failures to MongoDB.
  - Add correlation IDs across requests/workflows.
6. Test gates:
  - Add unit tests for tools and services.
  - Add integration tests for key workflows (client-pipeline, project-lifecycle, agency-delivery).
  - Add smoke tests for API routes.
  - No milestone is complete unless tests pass.
7. Security and RBAC:
  - Enforce role checks on all protected routes and APIs.
  - Never expose secrets in logs or client responses.
8. Incremental delivery:
  - After each milestone, output:
    - what was implemented
    - files changed
    - tests run/results
    - known issues
    - next milestone plan
9. Quality gates before completion:
  - `npm run lint` passes
  - `npm run typecheck` passes
  - `npm run test` passes
  - `npm run build` passes
10. Documentation discipline:

- Maintain `README.md`, `docs/architecture.md`, `docs/workflows.md`, and `docs/runbooks.md`.
- Keep `.env.example` accurate.

## Milestone Sequence

M1 Foundation: project scaffolding, DB connection, base models, env, auth skeleton  
M2 Core tools: mongodb/search/email/file/github/codegen + schema validation  
M3 Agents: all 10 agents with scoped tools + action logging  
M4 Workflows: client-pipeline, project-lifecycle, sprint-planning, code-review, agency-delivery  
M5 RAG: ingestion/query pipelines with source attribution  
M6 UI: dashboard, agents chat, projects, clients, portal pages  
M7 API + streaming: all routes with validation and RBAC  
M8 Hardening: tests, observability, retries, performance checks, docs polish

## Definition of Done

The system can:

- acquire and qualify leads,
- nurture and onboard clients,
- generate brief + SOW + MVP scaffold,
- execute multi-agent delivery workflows,
- show status and audit trails in the dashboard,  
with production-grade reliability and clear documentation.

---

## Core Requirements

Create a production-ready **Next.js 15 + ++[Mastra.ai](http://mastra.ai/)**++ application called `digital-agency` that operates like a real digital design/development agency and can complete actual client work end-to-end.

### **Stack**

- Next.js 15 (App Router)
- ++[Mastra.ai](http://mastra.ai/)++ (`@mastra/core`, `@mastra/rag`)
- MongoDB via Mongoose
- Tailwind CSS v4
- shadcn/ui
- TypeScript

### **Architecture**

- Multi-agent orchestration with Mastra workflows
- Tool-driven agents using strict Zod schemas
- Persistent memory/audit trail in MongoDB
- Streaming chat APIs for agent interaction
- Role-based authentication (admin, agent-operator, client)

---

## Step 1: Initialize Project

```
npx create-next-app@latest digital-agency --typescript --tailwind --eslint --app --src-dir
cd digital-agency
npx shadcn@latest init
npm install @mastra/core @mastra/rag mongoose @ai-sdk/openai ai zod
npm install resend exa-js
 
Also install any additional required dependencies (Auth.js, Octokit, PDF/document parsing, testing libs, etc.) and ensure all imports compile.

Step 2: MongoDB + Models
Create src/lib/db/mongodb.ts  with a Next.js-safe singleton Mongoose connection.

Create models in src/lib/db/models/ :

project.ts  — name, client, status, tasks, agents, timeline, budget
client.ts  — company, contacts, pipelineStage, notes, interactions, leadScore
task.ts  — title, description, assignedAgent, status, projectRef, dependencies, sprint
conversation.ts  — agentId, messages, context, projectRef, clientRef
agent-action-log.ts  — agentName, toolName, input, output, status, timestamp, correlationId
Include timestamps, indexes, and enums where appropriate.

Step 3: Mastra Instance + Agents
Create src/mastra/index.ts  registering all agents, tools, and workflows.

Create agent files in src/mastra/agents/ :

project-manager.ts 
tech-lead.ts 
design.ts 
research.ts 
frontend.ts 
backend.ts 
qa.ts 
prospector.ts 
nurture.ts 
onboarding.ts 
Each agent must include:

clear role-specific instructions
tool access scoped to responsibilities
output format contracts
safety rules (no guessing, ask for missing data)
logging of all tool actions to MongoDB
Step 4: Mastra Tools (with strict schemas)
Create tools in src/mastra/tools/  using Mastra createTool()  + Zod:

mongodb-tools.ts 
CRUD for projects/clients/tasks/conversations/action logs
search-tools.ts 
Exa web search, company lookup, competitive scan
email-tools.ts 
Resend sendEmail, template rendering, sequence scheduling
code-gen-tools.ts 
Generate component/API/test scaffolds with structured outputs
github-tools.ts 
Repo/branch/PR/file commit operations via Octokit
file-tools.ts 
Safe read/write/list for project assets
agency-ops-tools.ts  (required added skills)
createProjectBrief(clientInput) 
generateSOW(brief) 
buildMVPScaffold(stack, features) 
All tools must implement:

input validation
typed output schemas
timeout/retry strategy
actionable error messages
Step 5: Workflows
Create in src/mastra/workflows/ :

project-lifecycle.ts 
PM intake → Research → Tech Lead architecture → Design → Frontend+Backend (parallel) → QA → PM review
client-pipeline.ts 
Prospector find → qualify → Nurture sequence → follow-up loop → Onboarding
Include conditional branching by lead score.
code-review.ts 
sprint-planning.ts 
agency-delivery.ts  (required added workflow)
Intake → Brief generation → SOW generation → MVP scaffold → PM handoff
Use Mastra workflows (not ad-hoc chaining).

Step 6: RAG for Research Agent
Create in src/mastra/rag/ :

knowledge-base.ts 
embeddings.ts 
documents.ts 
Requirements:

use @mastra/rag  vector query tooling
embeddings model: text-embedding-3-small 
support ingestion from URL, PDF, raw text
query + synthesize with web search
persist ingestion metadata and source attribution
Step 7: Next.js Frontend
Build dashboard UI in src/app/(dashboard)/ :

layout.tsx  with sidebar/topbar
page.tsx  dashboard overview
projects/page.tsx 
projects/[id]/page.tsx 
clients/page.tsx 
clients/[id]/page.tsx 
agents/page.tsx 
agents/[name]/page.tsx 
Build client portal in src/app/(portal)/ .

Create components in src/components/ :

AgentChat 
KanbanBoard 
ProjectTimeline 
ClientPipelineBoard 
TaskCard 
Install shadcn components: button, card, dialog, input, select, table, tabs, badge, avatar, dropdown-menu, sheet, form, toast, command, separator, scroll-area.

Step 8: API Routes
Implement:

src/app/api/agents/[name]/chat/route.ts  (streaming with Vercel AI SDK + Mastra)
src/app/api/projects/route.ts 
src/app/api/clients/route.ts 
src/app/api/workflows/[name]/route.ts 
src/app/api/rag/ingest/route.ts 
src/app/api/rag/query/route.ts 
Add validation, error handling, typed response contracts, and RBAC enforcement.

Step 9: Environment Variables
Create .env.local  with:

env

OPENAI_API_KEY=
MONGODB_URI=
EXA_API_KEY=
RESEND_API_KEY=
GITHUB_TOKEN=
AUTH_SECRET=
NEXTAUTH_URL=
 
Also create and maintain .env.example .

Step 10: Authentication + RBAC
Integrate Auth.js v5 (NextAuth) with MongoDB adapter (or equivalent RBAC system) for:

admin
agent-operator
client
Protect dashboard/portal routes and API endpoints by role.

Required “Agency Skills” (First-Class Features)
Implement these as tools + workflow steps + visible UI outputs:

createProjectBrief(clientInput) 
Produces structured brief: goals, scope, deliverables, constraints, success metrics.
generateSOW(brief) 
Produces SOW: milestones, timeline, pricing assumptions, acceptance criteria.
buildMVPScaffold(stack, features) 
Generates project skeleton/code plan and starter files/tasks.
Persist outputs to MongoDB and expose them in project detail UI.

Non-Functional Requirements
Type-safe end-to-end (no any  unless justified)
Clean folder structure + reusable services
Robust logging + action audit trail
Graceful failures and retries for external APIs
Real-time updates (change streams or polling)
Production-grade DX: lint, format, build, tests passing
Deliverables
Full source code
README with setup + architecture diagram + workflow map
.env.example 
Seed script with sample clients/projects/tasks
Demo script showing:
lead → qualification → nurture → onboarding
project intake → brief → SOW → MVP scaffold
agent collaboration with logged actions
Implementation Notes
Use agent.generate()  for single-turn calls and agent.stream()  for chat streaming.
Use Mastra workflows for orchestration.
Use RAG with source attribution.
Store all conversations and agent actions in MongoDB.
Ensure pipeline workflow supports conditional branching by lead score.
After each milestone, print a concise implementation report and update docs/plan.md.


agency/  
├── src/  
│   ├── app/                          # Next.js App Router  
│   │   ├── (dashboard)/              # Agency dashboard routes  
│   │   │   ├── projects/  
│   │   │   ├── clients/  
│   │   │   ├── agents/  
│   │   │   └── layout.tsx  
│   │   ├── (portal)/                 # Client-facing portal  
│   │   ├── api/  
│   │   │   ├── agents/route.ts  
│   │   │   ├── projects/route.ts  
│   │   │   ├── clients/route.ts  
│   │   │   └── rag/route.ts  
│   │   ├── layout.tsx  
│   │   └── page.tsx  
│   ├── components/                   # shadcn/ui components  
│   │   ├── ui/                       # Base shadcn components  
│   │   ├── dashboard/  
│   │   ├── agents/  
│   │   └── projects/  
│   ├── lib/  
│   │   ├── db/  
│   │   │   ├── mongodb.ts            # MongoDB connection  
│   │   │   ├── models/  
│   │   │   │   ├── project.ts  
│   │   │   │   ├── client.ts  
│   │   │   │   ├── task.ts  
│   │   │   │   └── conversation.ts  
│   │   │   └── schemas/  
│   │   └── utils.ts  
│   ├── mastra/  
│   │   ├── index.ts                  # Mastra instance config  
│   │   ├── agents/  
│   │   │   ├── project-manager.ts  
│   │   │   ├── tech-lead.ts  
│   │   │   ├── design.ts  
│   │   │   ├── research.ts  
│   │   │   ├── frontend.ts  
│   │   │   ├── backend.ts  
│   │   │   ├── qa.ts  
│   │   │   ├── prospector.ts  
│   │   │   ├── nurture.ts  
│   │   │   └── onboarding.ts  
│   │   ├── tools/  
│   │   │   ├── mongodb-tools.ts  
│   │   │   ├── github-tools.ts  
│   │   │   ├── email-tools.ts  
│   │   │   ├── search-tools.ts  
│   │   │   ├── code-gen-tools.ts  
│   │   │   └── file-tools.ts  
│   │   ├── workflows/  
│   │   │   ├── project-lifecycle.ts  
│   │   │   ├── client-pipeline.ts  
│   │   │   ├── code-review.ts  
│   │   │   └── sprint-planning.ts  
│   │   └── rag/  
│   │       ├── knowledge-base.ts     # Vector store setup  
│   │       ├── embeddings.ts  
│   │       └── documents.ts  
│   └── types/  
│       ├── project.ts  
│       ├── client.ts  
│       └── agent.ts  
├── .env.local  
├── package.json  
├── tailwind.config.ts  
└── tsconfig.json



i want to create a project manager for my ai agency, using mastra.ai and mongodb for observeable memory and vector store as well. the agent needs to have acees to the web with exa.ai web search. it needs to keep linear and github in sync, as well as monday.com. it is to delagate work, not complete work,  after it breaks down the task into pieces , it then passes the work outto its teammates.  from then it monitors the  the progress of the other agents. if they get stuck he is  too assist and unblock them. if he/or the other agents do not have the right tool for the job you are to createthat tool to complete the task at hand. Like wise if you do not have the right ammount of team members to get the job done, dynamically create them  so that you can  get the job done. if there is a tie you are the tie breker, do not leave work unfinnished or assume someone else will finish the job later, do not lie, not present something as a fact/truth/benchmark, unless you have the documentation to back it up. Test driven development is in fact a way of life, and its not an option to us. we test all code period. Use modern javascript with functional programming best practices at all timeS. lead by example

```

