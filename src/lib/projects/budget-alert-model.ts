import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const budgetAlertSchema = new Schema(
  {
    tenantId: { type: String, required: true, index: true },
    projectId: { type: String, required: true, index: true },
    threshold: { type: Number, required: true, enum: [80, 100, 120] },
    spend: { type: Number, required: true, min: 0 },
    budget: { type: Number, required: true, min: 0 },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  },
);

budgetAlertSchema.index(
  { tenantId: 1, projectId: 1, threshold: 1 },
  { unique: true },
);

export type BudgetAlertDocument = InferSchemaType<typeof budgetAlertSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

type BudgetAlertModel = Model<BudgetAlertDocument>;

const modelName = "BudgetAlert";

export const getBudgetAlertModel = (): BudgetAlertModel => {
  const existing = mongoose.models[modelName] as BudgetAlertModel | undefined;
  return (
    existing ??
    mongoose.model<BudgetAlertDocument>(modelName, budgetAlertSchema)
  );
};
