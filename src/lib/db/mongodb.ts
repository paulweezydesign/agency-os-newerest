import mongoose from "mongoose";

export type MongoConnectionStatus = {
  ready: boolean;
};

const isConnected = (): boolean => mongoose.connection.readyState === 1;

export const connectMongo = async (): Promise<MongoConnectionStatus> => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is required");
  }

  if (isConnected()) {
    return { ready: true };
  }

  await mongoose.connect(uri);

  return { ready: true };
};
