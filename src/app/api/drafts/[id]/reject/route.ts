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
    // Use the stored PR owner (could be fork owner or original repo owner)
    const prOwner = draft.draftPrOwner || draft.watchedRepo.owner;

    // Close the draft PR on GitHub; ignore errors if the PR is already closed
    try {
      await closeDraftPR(
        session.user.id,
        prOwner,
        draft.watchedRepo.repo,
        draft.draftPrNumber
      );
    } catch (githubError) {
      const status =
        githubError instanceof Error &&
        "status" in githubError &&
        typeof (githubError as { status: unknown }).status === "number"
          ? (githubError as { status: number }).status
          : null;
      // 422 means the PR is already closed; proceed with archiving
      if (status !== 422) {
        throw githubError;
      }
      console.warn(
        "Draft PR is already closed on GitHub; proceeding with rejection."
      );
    }

    const updatedIssue = await prisma.trackedIssue.update({
      where: { id },
      data: {
        autoFixStatus: "rejected",
        archivedAt: new Date(),
      },
    });

    return NextResponse.json(updatedIssue);
  } catch (error) {
    console.error("Failed to reject draft:", error);
    return NextResponse.json(
      { error: "Failed to reject draft" },
      { status: 500 }
    );
  }
}
