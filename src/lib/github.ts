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

// Fetch issues from a repository
export async function fetchRepoIssues(
  userId: string,
  owner: string,
  repo: string,
  labels?: string[]
) {
  const octokit = await getUserOctokit(userId);

  const { data: issues } = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    state: "open",
    labels: labels?.join(","),
    per_page: 100,
    sort: "created",
    direction: "desc",
  });

  // Filter out pull requests (GitHub API returns PRs as issues)
  return issues.filter((issue) => !issue.pull_request);
}

// Check if an issue has a linked PR
export async function issueHasLinkedPR(
  userId: string,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<boolean> {
  const octokit = await getUserOctokit(userId);

  try {
    const { data: timeline } = await octokit.rest.issues.listEventsForTimeline({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
    });

    // Check for cross-reference events from PRs
    return timeline.some(
      (event) =>
        event.event === "cross-referenced" &&
        (event as { source?: { issue?: { pull_request?: unknown } } }).source?.issue?.pull_request
    );
  } catch {
    return false;
  }
}

// Get repository languages
export async function getRepoLanguages(
  userId: string,
  owner: string,
  repo: string
): Promise<string[]> {
  const octokit = await getUserOctokit(userId);

  const { data: languages } = await octokit.rest.repos.listLanguages({
    owner,
    repo,
  });

  return Object.keys(languages);
}

// Publish a draft PR (convert from draft to ready for review)
export async function publishDraftPR(
  userId: string,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<void> {
  const octokit = await getUserOctokit(userId);

  // Use GraphQL to mark PR as ready for review
  await octokit.graphql(`
    mutation($pullRequestId: ID!) {
      markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
        pullRequest {
          id
          isDraft
        }
      }
    }
  `, {
    pullRequestId: await getPullRequestNodeId(octokit, owner, repo, pullNumber),
  });
}

// Close a draft PR
export async function closeDraftPR(
  userId: string,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<void> {
  const octokit = await getUserOctokit(userId);

  await octokit.rest.pulls.update({
    owner,
    repo,
    pull_number: pullNumber,
    state: "closed",
  });
}

// Helper to get PR node ID for GraphQL
async function getPullRequestNodeId(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<string> {
  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  });

  return pr.node_id;
}

// Validate repository exists and user has access
export async function validateRepoAccess(
  userId: string,
  owner: string,
  repo: string
): Promise<boolean> {
  const octokit = await getUserOctokit(userId);

  try {
    await octokit.rest.repos.get({ owner, repo });
    return true;
  } catch {
    return false;
  }
}

// Register a webhook for a repository
export async function registerWebhook(
  userId: string,
  owner: string,
  repo: string,
  webhookUrl: string
): Promise<{ id: number } | null> {
  const octokit = await getUserOctokit(userId);

  try {
    const { data: webhook } = await octokit.rest.repos.createWebhook({
      owner,
      repo,
      config: {
        url: webhookUrl,
        content_type: "json",
        secret: process.env.GITHUB_WEBHOOK_SECRET,
      },
      events: ["issues"],
      active: true,
    });

    return { id: webhook.id };
  } catch (error) {
    console.error("Failed to register webhook:", error);
    return null;
  }
}
