import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { closeDraftPR } from "@/lib/github";

type Params = Promise<{ id: string }>;

// POST /api/drafts/[id]/reject - Reject & close draft PR
export async function POST(
  request: Request,
  { params }: { params: Params }
) {
  const session = await getServerSession(authOptions);
  const { id } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const draft = await prisma.trackedIssue.findFirst({
    where: {
      id,
      watchedRepo: {
        userId: session.user.id,
      },
      autoFixStatus: "draft_ready",
    },
    include: {
      watchedRepo: true,
    },
  });

  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  if (!draft.draftPrNumber) {
    return NextResponse.json({ error: "No draft PR found" }, { status: 400 });
  }

  try {
    // Close the draft PR on GitHub
    await closeDraftPR(
      session.user.id,
      draft.watchedRepo.owner,
      draft.watchedRepo.repo,
      draft.draftPrNumber
    );

    const updatedIssue = await prisma.trackedIssue.update({
      where: { id },
      data: {
        autoFixStatus: "rejected",
      },
    });

    return NextResponse.json(updatedIssue);
  } catch (error) {
    console.error("Failed to close draft PR:", error);
    return NextResponse.json(
      { error: "Failed to close PR" },
      { status: 500 }
    );
  }
}
