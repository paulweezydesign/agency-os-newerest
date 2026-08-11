import { getPolicyGateService } from "@/lib/policy-gates/get-policy-gate-service";
import { getProjectService } from "@/lib/projects/get-project-service";
import {
  createDepositService,
  type DepositService,
} from "./deposit-service";

export const getDepositService = async (): Promise<DepositService> => {
  const [projects, policyGates] = await Promise.all([
    getProjectService(),
    getPolicyGateService(),
  ]);
  return createDepositService({ projects, policyGates });
};
