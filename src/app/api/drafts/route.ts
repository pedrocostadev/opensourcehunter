import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/drafts - List all pending draft PRs
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const drafts = await prisma.trackedIssue.findMany({
    where: {
      watchedRepo: {
        userId: session.user.id,
      },
      autoFixStatus: "draft_ready",
    },
    include: {
      watchedRepo: {
        select: {
          owner: true,
          repo: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(drafts);
}
