import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { getKnowledgeBase } from "@/lib/rag/get-knowledge-base";
import { handleQueryKnowledge } from "@/lib/rag/rag-api";

export const POST = async (request: Request) => {
  const body = await request.json().catch(() => null);
  const result = await handleQueryKnowledge({
    session: toAuthSession(await auth()),
    knowledgeBase: getKnowledgeBase(),
    body,
  });

  return NextResponse.json(result.body, { status: result.status });
};
