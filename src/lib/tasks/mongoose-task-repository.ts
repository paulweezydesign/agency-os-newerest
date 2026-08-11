import type { TaskRepository, TaskCreateRecord, TaskUpdateRecord } from "./task-repository";
import { getTaskModel } from "./task-model";
import type { Task, TaskStatus } from "./schemas";

const toTask = (doc: {
  _id: { toString: () => string };
  tenantId: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
}): Task => ({
  id: doc._id.toString(),
  tenantId: doc.tenantId,
  projectId: doc.projectId,
  title: doc.title,
  description: doc.description,
  status: doc.status,
  createdAt: doc.createdAt.toISOString(),
  updatedAt: doc.updatedAt.toISOString(),
});

export const createMongooseTaskRepository = (): TaskRepository => ({
  create: async (input: TaskCreateRecord) => {
    const model = getTaskModel();
    const doc = await model.create(input);
    return toTask(doc);
  },
  listByTenantAndProject: async (tenantId, projectId) => {
    const model = getTaskModel();
    const docs = await model
      .find({ tenantId, projectId })
      .sort({ createdAt: -1 })
      .exec();
    return docs.map(toTask);
  },
  getByTenantAndId: async (tenantId, id) => {
    const model = getTaskModel();
    if (!id.match(/^[a-f\d]{24}$/i)) {
      return null;
    }
    const doc = await model.findOne({ _id: id, tenantId }).exec();
    return doc ? toTask(doc) : null;
  },
  updateByTenantAndId: async (tenantId, id, patch: TaskUpdateRecord) => {
    const model = getTaskModel();
    if (!id.match(/^[a-f\d]{24}$/i)) {
      return null;
    }
    const doc = await model
      .findOneAndUpdate({ _id: id, tenantId }, { $set: patch }, { new: true })
      .exec();
    return doc ? toTask(doc) : null;
  },
});
