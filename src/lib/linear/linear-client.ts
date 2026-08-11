import type { LinearOutboundIssue } from "./map-task";

export type LinearIssue = LinearOutboundIssue & {
  id: string;
};

export type LinearClient = {
  createIssue: (input: LinearOutboundIssue) => Promise<LinearIssue>;
  updateIssue: (
    id: string,
    input: Partial<LinearOutboundIssue>,
  ) => Promise<LinearIssue>;
};

export const createInMemoryLinearClient = (): LinearClient & {
  issues: Map<string, LinearIssue>;
} => {
  const issues = new Map<string, LinearIssue>();
  let seq = 0;

  return {
    issues,
    createIssue: async (input) => {
      seq += 1;
      const issue: LinearIssue = { id: `lin-${seq}`, ...input };
      issues.set(issue.id, issue);
      return issue;
    },
    updateIssue: async (id, input) => {
      const current = issues.get(id);
      if (!current) {
        throw new Error(`Linear issue not found: ${id}`);
      }
      const updated: LinearIssue = { ...current, ...input, id };
      issues.set(id, updated);
      return updated;
    },
  };
};
