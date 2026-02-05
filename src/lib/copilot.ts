import { Octokit } from "octokit";
import { prisma } from "./prisma";

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

// Get the Copilot actor ID for a repository (needed for GraphQL assignment)
async function getCopilotActorId(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<string | null> {
  try {
    const response = await octokit.graphql<{
      repository: {
        suggestedActors: {
          nodes: Array<{ __typename: string; id?: string; login: string }>;
        };
      };
    }>(
      `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          suggestedActors(capabilities: [CAN_BE_ASSIGNED], first: 100) {
            nodes {
              __typename
              login
              ... on Bot {
                id
              }
              ... on User {
                id
              }
              ... on Mannequin {
                id
              }
              ... on Organization {
                id
              }
            }
          }
        }
      }
    `,
      {
        owner,
        repo,
        headers: {
          "GraphQL-Features": "issues_copilot_assignment_api_support",
        },
      }
    );

    const copilotActor = response.repository.suggestedActors.nodes.find(
      (actor) => actor.login.toLowerCase() === "copilot"
    );

    if (!copilotActor?.id) {
      console.log("Available actors:", response.repository.suggestedActors.nodes.map(a => a.login));
    }

    return copilotActor?.id || null;
  } catch (error) {
    console.error("Failed to get Copilot actor ID:", error);
    return null;
  }
}

// Get the issue node ID for GraphQL mutations
async function getIssueNodeId(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<string | null> {
  try {
    const response = await octokit.graphql<{
      repository: {
        issue: { id: string };
      };
    }>(
      `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            id
          }
        }
      }
    `,
      { owner, repo, number: issueNumber }
    );

    return response.repository.issue.id;
  } catch (error) {
    console.error("Failed to get issue node ID:", error);
    return null;
  }
}

// Assign an issue to Copilot coding agent using GraphQL API
// For owned repos: assigns directly on the original repo
// For forked repos: creates a linked issue on the fork and assigns Copilot there
// Returns the fork issue number if a fork issue was created
export async function assignIssueToCopilot(
  userId: string,
  owner: string,
  repo: string,
  issueNumber: number,
  isOwned: boolean,
  forkOwner: string | null
): Promise<{ success: boolean; forkIssueNumber?: number }> {
  const octokit = await getUserOctokit(userId);

  try {
    if (isOwned) {
      // User owns the repo - assign Copilot directly using GraphQL API
      const copilotId = await getCopilotActorId(octokit, owner, repo);
      if (!copilotId) {
        console.error(`Copilot coding agent is not available in ${owner}/${repo}`);
        return { success: false };
      }

      const issueId = await getIssueNodeId(octokit, owner, repo, issueNumber);
      if (!issueId) {
        console.error(`Could not find issue #${issueNumber} in ${owner}/${repo}`);
        return { success: false };
      }

      // Use GraphQL to assign Copilot to the issue
      await octokit.graphql(
        `
        mutation($issueId: ID!, $assigneeIds: [ID!]!) {
          addAssigneesToAssignable(input: { assignableId: $issueId, assigneeIds: $assigneeIds }) {
            clientMutationId
          }
        }
      `,
        {
          issueId,
          assigneeIds: [copilotId],
          headers: {
            "GraphQL-Features": "issues_copilot_assignment_api_support",
          },
        }
      );

      console.log(`Assigned issue #${issueNumber} to Copilot in ${owner}/${repo}`);
      return { success: true };
    } else if (forkOwner) {
      // User doesn't own the repo - we need to work on the fork
      // First check if Copilot is available on the fork
      const copilotId = await getCopilotActorId(octokit, forkOwner, repo);
      if (!copilotId) {
        console.error(`Copilot coding agent is not available in fork ${forkOwner}/${repo}`);
        return { success: false };
      }

      // Get the original issue details
      const { data: originalIssue } = await octokit.rest.issues.get({
        owner,
        repo,
        issue_number: issueNumber,
      });

      // Create a corresponding issue on the fork that references the original
      const { data: forkIssue } = await octokit.rest.issues.create({
        owner: forkOwner,
        repo,
        title: `[Upstream #${issueNumber}] ${originalIssue.title}`,
        body: `This issue tracks the fix for upstream issue: ${originalIssue.html_url}\n\n---\n\n${originalIssue.body || "No description provided."}`,
        labels: originalIssue.labels
          ?.map((l) => (typeof l === "string" ? l : l.name))
          .filter((n): n is string => !!n) || [],
      });

      // Get the fork issue node ID
      const forkIssueId = await getIssueNodeId(octokit, forkOwner, repo, forkIssue.number);
      if (!forkIssueId) {
        console.error(`Could not get node ID for fork issue #${forkIssue.number}`);
        return { success: false };
      }

      // Assign Copilot to the fork issue using GraphQL
      await octokit.graphql(
        `
        mutation($issueId: ID!, $assigneeIds: [ID!]!) {
          addAssigneesToAssignable(input: { assignableId: $issueId, assigneeIds: $assigneeIds }) {
            clientMutationId
          }
        }
      `,
        {
          issueId: forkIssueId,
          assigneeIds: [copilotId],
          headers: {
            "GraphQL-Features": "issues_copilot_assignment_api_support",
          },
        }
      );

      console.log(`Created fork issue #${forkIssue.number} and assigned to Copilot in ${forkOwner}/${repo}`);
      return { success: true, forkIssueNumber: forkIssue.number };
    } else {
      console.error("Cannot assign Copilot: no fork available for non-owned repo");
      return { success: false };
    }
  } catch (error) {
    console.error("Failed to assign issue to Copilot:", error);
    return { success: false };
  }
}

// Check if Copilot has created a PR for an issue
// For owned repos: checks timeline of the original issue
// For forked repos: checks PRs on the fork that reference the upstream issue
export async function checkCopilotPRStatus(
  userId: string,
  owner: string,
  repo: string,
  issueNumber: number,
  isOwned: boolean,
  forkOwner: string | null,
  forkIssueNumber: number | null
): Promise<{ hasPR: boolean; prNumber?: number; prUrl?: string; prOwner?: string; isDraft?: boolean }> {
  const octokit = await getUserOctokit(userId);

  try {
    if (isOwned) {
      // For owned repos, check the original issue timeline
      const result = await checkTimelineForCopilotPR(octokit, owner, repo, issueNumber);
      if (result.hasPR) {
        return { ...result, prOwner: owner };
      }
      return result;
    } else if (forkOwner) {
      // For forked repos, check the fork issue timeline if we have the fork issue number
      if (forkIssueNumber) {
        const result = await checkTimelineForCopilotPR(octokit, forkOwner, repo, forkIssueNumber);
        if (result.hasPR) {
          return { ...result, prOwner: forkOwner };
        }
      }

      // Also check for PRs on the fork that mention the upstream issue
      const { data: prs } = await octokit.rest.pulls.list({
        owner: forkOwner,
        repo,
        state: "all",
        per_page: 30,
      });

      for (const pr of prs) {
        const login = pr.user?.login?.toLowerCase() || "";
        const isCopilotPR = login.includes("copilot");
        const referencesUpstream = pr.body?.includes(`${owner}/${repo}#${issueNumber}`) ||
          pr.body?.includes(`${owner}/${repo}/issues/${issueNumber}`) ||
          pr.title?.includes(`[Upstream #${issueNumber}]`);

        if (isCopilotPR && referencesUpstream) {
          return {
            hasPR: true,
            prNumber: pr.number,
            prUrl: pr.html_url,
            prOwner: forkOwner,
            isDraft: pr.draft ?? false,
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

// Helper to check issue timeline for Copilot PRs
async function checkTimelineForCopilotPR(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<{ hasPR: boolean; prNumber?: number; prUrl?: string; isDraft?: boolean }> {
  const { data: timeline } = await octokit.rest.issues.listEventsForTimeline({
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  });

  for (const event of timeline) {
    if (event.event === "cross-referenced") {
      const crossRefEvent = event as {
        source?: {
          issue?: {
            number?: number;
            html_url?: string;
            pull_request?: object;
            draft?: boolean;
            user?: { login?: string; type?: string };
          };
        };
      };

      const sourceIssue = crossRefEvent.source?.issue;

      if (sourceIssue?.pull_request && sourceIssue.number && sourceIssue.html_url) {
        const login = sourceIssue.user?.login?.toLowerCase() || "";
        const isCopilotPR = login.includes("copilot");

        if (isCopilotPR) {
          return {
            hasPR: true,
            prNumber: sourceIssue.number,
            prUrl: sourceIssue.html_url,
            isDraft: sourceIssue.draft ?? false,
          };
        }
      }
    }
  }

  return { hasPR: false };
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

  // Update status to generating with timestamp
  await prisma.trackedIssue.update({
    where: { id: trackedIssueId },
    data: { 
      autoFixStatus: "generating",
      generatingAt: new Date(),
    },
  });

  try {
    const result = await assignIssueToCopilot(
      trackedIssue.watchedRepo.userId,
      trackedIssue.watchedRepo.owner,
      trackedIssue.watchedRepo.repo,
      trackedIssue.issueNumber,
      trackedIssue.watchedRepo.isOwned,
      trackedIssue.watchedRepo.forkOwner
    );

    if (!result.success) {
      await prisma.trackedIssue.update({
        where: { id: trackedIssueId },
        data: { autoFixStatus: "failed" },
      });
      return false;
    }

    // Store the fork issue number if one was created
    if (result.forkIssueNumber) {
      await prisma.trackedIssue.update({
        where: { id: trackedIssueId },
        data: { forkIssueNumber: result.forkIssueNumber },
      });
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

// Timeout for generating status (2 hours)
const GENERATING_TIMEOUT_MS = 2 * 60 * 60 * 1000;

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

  // Check for timeout - if generating for too long, mark as failed
  if (trackedIssue.generatingAt) {
    const elapsed = Date.now() - trackedIssue.generatingAt.getTime();
    if (elapsed > GENERATING_TIMEOUT_MS) {
      console.log(`Issue ${trackedIssueId} timed out after ${elapsed}ms in generating status`);
      await prisma.trackedIssue.update({
        where: { id: trackedIssueId },
        data: { autoFixStatus: "failed" },
      });
      return;
    }
  }

  const status = await checkCopilotPRStatus(
    trackedIssue.watchedRepo.userId,
    trackedIssue.watchedRepo.owner,
    trackedIssue.watchedRepo.repo,
    trackedIssue.issueNumber,
    trackedIssue.watchedRepo.isOwned,
    trackedIssue.watchedRepo.forkOwner,
    trackedIssue.forkIssueNumber
  );

  if (status.hasPR && status.prNumber) {
    await prisma.trackedIssue.update({
      where: { id: trackedIssueId },
      data: {
        autoFixStatus: "draft_ready",
        draftPrNumber: status.prNumber,
        draftPrUrl: status.prUrl,
        draftPrOwner: status.prOwner,
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
