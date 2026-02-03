import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchIssueState } from "@/lib/github";
import { createIssueClosedNotification } from "@/lib/notifications";

// Poll for issue state changes (closed issues)
// Run via Vercel Cron every 10 minutes

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all open tracked issues (not yet archived)
    const openIssues = await prisma.trackedIssue.findMany({
      where: {
        state: "open",
        archivedAt: null,
      },
      include: {
        watchedRepo: {
          include: { user: true },
        },
      },
    });

    let issuesClosed = 0;
    let issuesChecked = 0;

    for (const issue of openIssues) {
      issuesChecked++;
      const { owner, repo, userId } = issue.watchedRepo;

      try {
        const { state, closedAt } = await fetchIssueState(
          userId,
          owner,
          repo,
          issue.issueNumber
        );

        if (state === "closed") {
          // Update issue state and auto-archive
          await prisma.trackedIssue.update({
            where: { id: issue.id },
            data: {
              state: "closed",
              closedAt: closedAt ? new Date(closedAt) : new Date(),
              archivedAt: new Date(),
            },
          });

          // Create notification
          await createIssueClosedNotification(
            userId,
            owner,
            repo,
            issue.issueNumber,
            issue.title,
            issue.id
          );

          issuesClosed++;
        }
      } catch (error) {
        console.error(
          `Failed to check issue ${owner}/${repo}#${issue.issueNumber}:`,
          error
        );
      }
    }

    return NextResponse.json({
      issuesChecked,
      issuesClosed,
    });
  } catch (error) {
    console.error("Poll issue state cron failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
