import { randomUUID } from "node:crypto";
import { DEFAULT_TENANT_ID } from "@/lib/auth/seed-users";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { createClientPipelineService } from "@/lib/client-pipeline/client-pipeline-service";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import {
  createDemoEffectRunner,
  createDemoEffectStore,
} from "@/lib/policy-gates/demo-effects";
import { createInMemoryPolicyGateRepository } from "@/lib/policy-gates/policy-gate-repository";
import { createPolicyGateService } from "@/lib/policy-gates/policy-gate-service";
import { createInMemoryArtifactRepository } from "@/lib/project-artifacts/artifact-repository";
import { createArtifactService } from "@/lib/project-artifacts/artifact-service";
import { createInMemoryBudgetAlertRepository } from "@/lib/projects/budget-alert-repository";
import { createInMemoryProjectRepository } from "@/lib/projects/project-repository";
import { createProjectService } from "@/lib/projects/project-service";

export type DemoPathResult = {
  leadToOnboard: {
    branch: "onboard" | "nurture" | "prospect";
    stages: string[];
    pendingEmailGates: number;
  };
  briefToScaffold: {
    kinds: string[];
    sowGateId: string;
  };
};

/** Demo script covering lead → onboard and brief → SOW → scaffold. */
export const runDemoPaths = async (
  tenantId: string = DEFAULT_TENANT_ID,
): Promise<DemoPathResult> => {
  const actionLogs = createInMemoryAgentActionLogRepository();
  const clients = createClientService(createInMemoryClientRepository());
  const projects = createProjectService(
    createInMemoryProjectRepository(),
    clients,
    createInMemoryBudgetAlertRepository(),
  );
  const policyGates = createPolicyGateService(
    createInMemoryPolicyGateRepository(),
    actionLogs,
    createDemoEffectRunner(createDemoEffectStore()),
  );
  const pipeline = createClientPipelineService({ clients, policyGates });
  const artifacts = createArtifactService(
    createInMemoryArtifactRepository(),
    projects,
    actionLogs,
    policyGates,
  );

  const lead = await clients.create({
    tenantId,
    name: "Demo Lead Co",
    contactEmail: "lead@demo.example",
  });

  const pipelineResult = await pipeline.run({
    tenantId,
    clientId: lead.id,
    leadScore: 92,
    contactEmail: "lead@demo.example",
    requestedBy: "demo-script",
    correlationId: randomUUID(),
  });

  const project = await projects.create({
    tenantId,
    clientId: lead.id,
    name: "Demo Delivery",
    budget: 12_000,
    timelineStart: "2026-02-01",
    timelineEnd: "2026-05-01",
  });

  await artifacts.createProjectBrief({
    tenantId,
    projectId: project.id,
    title: "Demo brief",
    body: "Scope a marketing MVP.",
    correlationId: randomUUID(),
    actorName: "demo-script",
  });

  const sow = await artifacts.generateSOW({
    tenantId,
    projectId: project.id,
    title: "Demo SOW",
    body: "Fixed-scope MVP with portal reviews.",
    correlationId: randomUUID(),
    actorName: "demo-script",
  });

  await artifacts.buildMVPScaffold({
    tenantId,
    projectId: project.id,
    title: "Demo scaffold",
    body: "Next.js app shell + auth + Mongo models.",
    correlationId: randomUUID(),
    actorName: "demo-script",
  });

  const sowGate = await artifacts.sendSowToClient({
    tenantId,
    projectId: project.id,
    artifactId: sow.id,
    correlationId: randomUUID(),
    actorName: "demo-script",
  });

  const listed = await artifacts.listByProject(tenantId, project.id);

  return {
    leadToOnboard: {
      branch: pipelineResult.branch,
      stages: pipelineResult.steps.map((step) => step.stage),
      pendingEmailGates: pipelineResult.pendingEmailGates.length,
    },
    briefToScaffold: {
      kinds: listed.map((artifact) => artifact.kind).sort(),
      sowGateId: sowGate.gateId,
    },
  };
};
