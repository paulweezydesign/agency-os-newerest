import type { ProjectRepository, ProjectCreateRecord } from "./project-repository";
import { getProjectModel } from "./project-model";
import type { Project } from "./schemas";

const toProject = (doc: {
  _id: { toString: () => string };
  tenantId: string;
  clientId: string;
  name: string;
  budget: number;
  timelineStart: string;
  timelineEnd: string;
  createdAt: Date;
}): Project => ({
  id: doc._id.toString(),
  tenantId: doc.tenantId,
  clientId: doc.clientId,
  name: doc.name,
  budget: doc.budget,
  timelineStart: doc.timelineStart,
  timelineEnd: doc.timelineEnd,
  createdAt: doc.createdAt.toISOString(),
});

export const createMongooseProjectRepository = (): ProjectRepository => ({
  create: async (input: ProjectCreateRecord) => {
    const model = getProjectModel();
    const doc = await model.create(input);
    return toProject(doc);
  },
  listByTenantAndClient: async (tenantId, clientId) => {
    const model = getProjectModel();
    const docs = await model
      .find({ tenantId, clientId })
      .sort({ createdAt: -1 })
      .exec();
    return docs.map(toProject);
  },
  getByTenantAndId: async (tenantId, id) => {
    const model = getProjectModel();

    if (!id.match(/^[a-f\d]{24}$/i)) {
      return null;
    }

    const doc = await model.findOne({ _id: id, tenantId }).exec();
    return doc ? toProject(doc) : null;
  },
});
