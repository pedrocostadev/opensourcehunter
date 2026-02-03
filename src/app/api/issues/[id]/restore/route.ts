import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

// POST /api/issues/[id]/restore - Restore an archived issue
export async function POST(
  request: Request,
  { params }: { params: Params }
) {
  const session = await getServerSession(authOptions);
  const { id } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const issue = await prisma.trackedIssue.findFirst({
    where: {
      id,
      watchedRepo: {
        userId: session.user.id,
      },
    },
  });

  if (!issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  if (!issue.archivedAt) {
    return NextResponse.json({ error: "Issue is not archived" }, { status: 400 });
  }

  const updatedIssue = await prisma.trackedIssue.update({
    where: { id },
    data: { archivedAt: null },
  });

  return NextResponse.json(updatedIssue);
}
