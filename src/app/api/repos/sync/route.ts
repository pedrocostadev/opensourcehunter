import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchRepoIssues, fetchRepoPullRequests, issueHasLinkedPR } from "@/lib/github";
import { triggerCopilotAutoFix } from "@/lib/copilot";
import { createIssueNotification } from "@/lib/notifications";

// POST /api/repos/sync - Manually trigger issue sync for user's repos
export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const watchedRepos = await prisma.watchedRepo.findMany({
      where: { 
        userId: session.user.id,
        frozen: false,
      },
    });

    let issuesCreated = 0;
    let prsCreated = 0;
    let reposPolled = 0;
    const autofixTriggers: Promise<unknown>[] = [];

    for (const watched of watchedRepos) {
      reposPolled++;
      
      try {
        const issues = await fetchRepoIssues(
          watched.userId,
          watched.owner,
          watched.repo
        );

        for (const issue of issues) {
          const issueLabels = issue.labels
            ?.map((l) => (typeof l === "string" ? l : l.name))
            .filter((n): n is string => !!n) || [];

          const userLabels = JSON.parse(watched.labels || "[]") as string[];

          // If user has label filters, check if issue has matching labels
          if (userLabels.length > 0) {
            const hasMatchingLabel = userLabels.some((label) =>
              issueLabels.includes(label)
            );
            if (!hasMatchingLabel) {
              continue;
            }
          }

          // Title query filter
          if (watched.titleQuery && !issue.title.toLowerCase().includes(watched.titleQuery.toLowerCase())) {
            continue;
          }

          // Check if already tracking this issue
          const existingIssue = await prisma.trackedIssue.findUnique({
            where: {
              watchedRepoId_issueNumber: {
                watchedRepoId: watched.id,
                issueNumber: issue.number,
              },
            },
          });

          if (existingIssue) {
            continue;
          }

          // Check if issue already has a linked PR
          const hasPR = await issueHasLinkedPR(
            watched.userId,
            watched.owner,
            watched.repo,
            issue.number
          );

          if (hasPR) {
            continue;
          }

          // Create tracked issue
          const trackedIssue = await prisma.trackedIssue.create({
            data: {
              watchedRepoId: watched.id,
              issueNumber: issue.number,
              title: issue.title,
              url: issue.html_url,
              labels: JSON.stringify(issueLabels),
              type: "issue",
              autoFixStatus: "queued",
              notifiedAt: new Date(),
            },
          });

          issuesCreated++;

          // Create notification (dispatches to all enabled channels)
          await createIssueNotification(
            watched.userId,
            watched.owner,
            watched.repo,
            issue.number,
            issue.title,
            trackedIssue.id,
            issue.html_url,
            "issue"
          );

          // Trigger Copilot auto-fix (awaited before response)
          autofixTriggers.push(
            triggerCopilotAutoFix(trackedIssue.id).catch((error) => {
              console.error("Failed to trigger Copilot auto-fix:", error);
            })
          );
        }

        // Fetch recent pull requests
        const pullRequests = await fetchRepoPullRequests(
          watched.userId,
          watched.owner,
          watched.repo
        );

        for (const pr of pullRequests) {
          const prLabels = pr.labels
            ?.map((l) => (typeof l === "string" ? l : l.name))
            .filter((n): n is string => !!n) || [];

          const userLabels = JSON.parse(watched.labels || "[]") as string[];

          // If user has label filters, check if PR has matching labels
          if (userLabels.length > 0) {
            const hasMatchingLabel = userLabels.some((label) =>
              prLabels.includes(label)
            );
            if (!hasMatchingLabel) {
              continue;
            }
          }

          // Title query filter
          if (watched.titleQuery && !pr.title.toLowerCase().includes(watched.titleQuery.toLowerCase())) {
            continue;
          }

          // Check if already tracking this PR
          const existingPR = await prisma.trackedIssue.findUnique({
            where: {
              watchedRepoId_issueNumber: {
                watchedRepoId: watched.id,
                issueNumber: pr.number,
              },
            },
          });

          if (existingPR) {
            continue;
          }

          // Create tracked PR
          const trackedPR = await prisma.trackedIssue.create({
            data: {
              watchedRepoId: watched.id,
              issueNumber: pr.number,
              title: pr.title,
              url: pr.html_url,
              labels: JSON.stringify(prLabels),
              type: "pull_request",
              autoFixStatus: "skipped", // PRs don't need auto-fix
              notifiedAt: new Date(),
            },
          });

          prsCreated++;

          // Create notification (dispatches to all enabled channels)
          await createIssueNotification(
            watched.userId,
            watched.owner,
            watched.repo,
            pr.number,
            pr.title,
            trackedPR.id,
            pr.html_url,
            "pull_request"
          );
        }
      } catch (error) {
        console.error(`Failed to sync ${watched.owner}/${watched.repo}:`, error);
      }
    }

    await Promise.allSettled(autofixTriggers);

    return NextResponse.json({
      reposPolled,
      issuesCreated,
      prsCreated,
    });
  } catch (error) {
    console.error("Sync failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
