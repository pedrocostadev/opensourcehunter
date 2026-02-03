import { Octokit } from "octokit";
import { prisma } from "./prisma";

const COPILOT_ASSIGNEE = "copilot";

// Get user's GitHub access token from the database
async function getUserOctokit(userId: string): Promise<Octokit> {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: "github",
    },
  });

  if (!account?.access_token) {
    throw new Error("GitHub access token not found");
  }

  return new Octokit({ auth: account.access_token });
}

// Assign an issue to Copilot coding agent
export async function assignIssueToCopilot(
  userId: string,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<boolean> {
  const octokit = await getUserOctokit(userId);

  try {
    // Assign Copilot as the issue assignee - this triggers the coding agent
    await octokit.rest.issues.addAssignees({
      owner,
      repo,
      issue_number: issueNumber,
      assignees: [COPILOT_ASSIGNEE],
    });

    console.log(`Assigned issue #${issueNumber} to Copilot in ${owner}/${repo}`);
    return true;
  } catch (error) {
    console.error("Failed to assign issue to Copilot:", error);
    return false;
  }
}

// Check if Copilot has created a PR for an issue using timeline API
export async function checkCopilotPRStatus(
  userId: string,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<{ hasPR: boolean; prNumber?: number; prUrl?: string; isDraft?: boolean }> {
  const octokit = await getUserOctokit(userId);

  try {
    // Use timeline API to find cross-referenced PRs (most reliable method)
    const { data: timeline } = await octokit.rest.issues.listEventsForTimeline({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
    });

    // Look for cross-reference events from PRs
    for (const event of timeline) {
      if (event.event === "cross-referenced") {
        const crossRefEvent = event as {
          source?: {
            issue?: {
              number?: number;
              html_url?: string;
              pull_request?: unknown;
              draft?: boolean;
              user?: { login?: string; type?: string };
            };
          };
        };
        
        const sourceIssue = crossRefEvent.source?.issue;
        
        // Check if the cross-reference is from a PR
        if (sourceIssue?.pull_request && sourceIssue.number && sourceIssue.html_url) {
          // Check if it's a Copilot-created PR (matches copilot, copilot-swe-agent[bot], etc.)
          const login = sourceIssue.user?.login?.toLowerCase() || "";
          const isCopilotPR = login.includes("copilot");
          
          if (isCopilotPR) {
            return {
              hasPR: true,
              prNumber: sourceIssue.number,
              prUrl: sourceIssue.html_url,
              isDraft: sourceIssue.draft,
            };
          }
        }
      }
    }

    return { hasPR: false };
  } catch (error) {
    console.error("Failed to check Copilot PR status:", error);
    return { hasPR: false };
  }
}

// Trigger Copilot coding agent for a tracked issue
export async function triggerCopilotAutoFix(
  trackedIssueId: string
): Promise<boolean> {
  const trackedIssue = await prisma.trackedIssue.findUnique({
    where: { id: trackedIssueId },
    include: {
      watchedRepo: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!trackedIssue) {
    console.error("Tracked issue not found:", trackedIssueId);
    return false;
  }

  // Don't trigger if already claimed or not in queued status
  if (trackedIssue.claimedAt || trackedIssue.autoFixStatus !== "queued") {
    return false;
  }

  // Update status to generating
  await prisma.trackedIssue.update({
    where: { id: trackedIssueId },
    data: { autoFixStatus: "generating" },
  });

  try {
    const success = await assignIssueToCopilot(
      trackedIssue.watchedRepo.userId,
      trackedIssue.watchedRepo.owner,
      trackedIssue.watchedRepo.repo,
      trackedIssue.issueNumber
    );

    if (!success) {
      await prisma.trackedIssue.update({
        where: { id: trackedIssueId },
        data: { autoFixStatus: "failed" },
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to trigger Copilot auto-fix:", error);
    await prisma.trackedIssue.update({
      where: { id: trackedIssueId },
      data: { autoFixStatus: "failed" },
    });
    return false;
  }
}

// Poll for Copilot PR status and update tracked issue
export async function pollCopilotPRStatus(
  trackedIssueId: string
): Promise<void> {
  const trackedIssue = await prisma.trackedIssue.findUnique({
    where: { id: trackedIssueId },
    include: {
      watchedRepo: true,
    },
  });

  if (!trackedIssue || trackedIssue.autoFixStatus !== "generating") {
    return;
  }

  const status = await checkCopilotPRStatus(
    trackedIssue.watchedRepo.userId,
    trackedIssue.watchedRepo.owner,
    trackedIssue.watchedRepo.repo,
    trackedIssue.issueNumber
  );

  if (status.hasPR && status.prNumber) {
    await prisma.trackedIssue.update({
      where: { id: trackedIssueId },
      data: {
        autoFixStatus: "draft_ready",
        draftPrNumber: status.prNumber,
        draftPrUrl: status.prUrl,
      },
    });

    // Create notification for draft ready
    await prisma.notification.create({
      data: {
        userId: trackedIssue.watchedRepo.userId,
        issueId: trackedIssueId,
        message: `Draft PR #${status.prNumber} ready for review: ${trackedIssue.watchedRepo.owner}/${trackedIssue.watchedRepo.repo} issue #${trackedIssue.issueNumber}`,
      },
    });
  }
}
