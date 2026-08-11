import type {
  ArtifactCreateRecord,
  ArtifactRepository,
} from "./artifact-repository";
import { getProjectArtifactModel } from "./artifact-model";
import type { ArtifactKind, ProjectArtifact } from "./schemas";

const toArtifact = (doc: {
  _id: { toString: () => string };
  tenantId: string;
  projectId: string;
  kind: ArtifactKind;
  title: string;
  body: string;
  createdAt: Date;
}): ProjectArtifact => ({
  id: doc._id.toString(),
  tenantId: doc.tenantId,
  projectId: doc.projectId,
  kind: doc.kind,
  title: doc.title,
  body: doc.body,
  createdAt: doc.createdAt.toISOString(),
});

export const createMongooseArtifactRepository = (): ArtifactRepository => ({
  create: async (input: ArtifactCreateRecord) => {
    const model = getProjectArtifactModel();
    const doc = await model.create(input);
    return toArtifact(doc);
  },
  listByTenantAndProject: async (tenantId, projectId) => {
    const model = getProjectArtifactModel();
    const docs = await model
      .find({ tenantId, projectId })
      .sort({ createdAt: -1 })
      .exec();
    return docs.map(toArtifact);
  },
  getByTenantAndId: async (tenantId, id) => {
    const model = getProjectArtifactModel();
    if (!id.match(/^[a-f\d]{24}$/i)) {
      return null;
    }
    const doc = await model.findOne({ _id: id, tenantId }).exec();
    return doc ? toArtifact(doc) : null;
  },
});
