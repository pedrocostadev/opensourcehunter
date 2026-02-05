import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchRepoIssues, issueHasLinkedPR } from "@/lib/github";
import { createIssueNotification } from "@/lib/notifications";
import { triggerCopilotAutoFix } from "@/lib/copilot";

// Poll for new issues on watched repos
// Run via Vercel Cron every 5 minutes

export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all watched repos grouped by unique owner/repo
    const watchedRepos = await prisma.watchedRepo.findMany({
      where: { frozen: false },
      include: { user: true },
    });

    let issuesCreated = 0;
    let reposPolled = 0;
    const autofixTriggers: Promise<unknown>[] = [];

    // Group by owner/repo to avoid duplicate API calls
    const repoGroups = new Map<string, typeof watchedRepos>();
    for (const watched of watchedRepos) {
      const key = `${watched.owner}/${watched.repo}`;
      if (!repoGroups.has(key)) {
        repoGroups.set(key, []);
      }
      repoGroups.get(key)!.push(watched);
    }

    for (const [repoKey, watchers] of repoGroups) {
      reposPolled++;
      const [owner, repo] = repoKey.split("/");
      
      // Use first watcher's token to fetch issues (they all have read access to public repos)
      const firstWatcher = watchers[0];
      
      try {
        // Fetch recent issues (last 100)
        const issues = await fetchRepoIssues(firstWatcher.userId, owner, repo);
        
        for (const issue of issues) {
          const issueLabels = issue.labels
            ?.map((l) => (typeof l === "string" ? l : l.name))
            .filter((n): n is string => !!n) || [];

          // Check each watcher's filters
          for (const watched of watchers) {
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
              owner,
              repo,
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
                autoFixStatus: "queued",
                notifiedAt: new Date(),
              },
            });

            issuesCreated++;

            // Create notification (dispatches to all enabled channels)
            await createIssueNotification(
              watched.userId,
              owner,
              repo,
              issue.number,
              issue.title,
              trackedIssue.id,
              issue.html_url
            );

            // Trigger Copilot auto-fix (awaited before response)
            autofixTriggers.push(
              triggerCopilotAutoFix(trackedIssue.id).catch((error) => {
                console.error("Failed to trigger Copilot auto-fix:", error);
              })
            );
          }
        }
      } catch (error) {
        console.error(`Failed to poll ${repoKey}:`, error);
      }
    }

    await Promise.allSettled(autofixTriggers);

    return NextResponse.json({
      reposPolled,
      issuesCreated,
    });
  } catch (error) {
    console.error("Poll issues cron failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
