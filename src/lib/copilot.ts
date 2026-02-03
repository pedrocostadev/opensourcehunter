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

// Check if Copilot has created a PR for an issue
export async function checkCopilotPRStatus(
  userId: string,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<{ hasPR: boolean; prNumber?: number; prUrl?: string; isDraft?: boolean }> {
  const octokit = await getUserOctokit(userId);

  try {
    // Search for PRs that mention this issue
    const { data: prs } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: "open",
      per_page: 100,
    });

    // Look for PRs that reference the issue (Copilot typically mentions the issue in the body)
    for (const pr of prs) {
      const body = pr.body || "";
      const title = pr.title || "";
      
      // Check if PR references the issue
      const issueRef = `#${issueNumber}`;
      const fullIssueUrl = `https://github.com/${owner}/${repo}/issues/${issueNumber}`;
      
      if (
        body.includes(issueRef) ||
        body.includes(fullIssueUrl) ||
        title.includes(issueRef)
      ) {
        // Check if it's a Copilot-created PR (user will be 'github-copilot[bot]' or similar)
        const isCopilotPR = 
          pr.user?.login?.includes("copilot") ||
          pr.user?.type === "Bot" ||
          body.toLowerCase().includes("copilot");

        if (isCopilotPR || pr.draft) {
          return {
            hasPR: true,
            prNumber: pr.number,
            prUrl: pr.html_url,
            isDraft: pr.draft,
          };
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
