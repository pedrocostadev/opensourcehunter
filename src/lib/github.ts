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

// Get the authenticated user's GitHub username
export async function getGitHubUsername(userId: string): Promise<string> {
  const octokit = await getUserOctokit(userId);
  const { data: user } = await octokit.rest.users.getAuthenticated();
  return user.login;
}

// Check if user owns the repository (has write/admin access)
export async function checkRepoOwnership(
  userId: string,
  owner: string,
  repo: string
): Promise<{ isOwned: boolean; permission: string }> {
  const octokit = await getUserOctokit(userId);

  try {
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
    
    // Check permissions - user owns if they have push/admin access
    const permissions = repoData.permissions;
    const isOwned = permissions?.push || permissions?.admin || false;
    
    return {
      isOwned,
      permission: permissions?.admin ? "admin" : permissions?.push ? "push" : "read",
    };
  } catch {
    return { isOwned: false, permission: "none" };
  }
}

// Fork a repository to the user's account
export async function forkRepository(
  userId: string,
  owner: string,
  repo: string
): Promise<{ forkOwner: string; forkRepo: string }> {
  const octokit = await getUserOctokit(userId);

  // Check if fork already exists (may have a different name than the original)
  const username = await getGitHubUsername(userId);

  try {
    const { data: forks } = await octokit.rest.repos.listForks({
      owner,
      repo,
      per_page: 100,
    });
    const existingFork = forks.find((f) => f.owner.login === username);
    if (existingFork) {
      return { forkOwner: username, forkRepo: existingFork.name };
    }
  } catch {
    // Could not check forks, will try to create
  }

  // Create the fork
  const { data: fork } = await octokit.rest.repos.createFork({
    owner,
    repo,
  });

  // Wait a bit for GitHub to fully create the fork
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return { forkOwner: fork.owner.login, forkRepo: fork.name };
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

// Fetch pull requests from a repository
export async function fetchRepoPullRequests(
  userId: string,
  owner: string,
  repo: string,
  labels?: string[]
) {
  const octokit = await getUserOctokit(userId);

  const { data: pulls } = await octokit.rest.pulls.list({
    owner,
    repo,
    state: "open",
    per_page: 100,
    sort: "created",
    direction: "desc",
  });

  // Filter by labels if provided
  if (labels && labels.length > 0) {
    return pulls.filter((pr) => {
      const prLabels = pr.labels?.map((l) => (typeof l === "string" ? l : l.name)).filter(Boolean) || [];
      return labels.some((label) => prLabels.includes(label));
    });
  }

  return pulls;
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

// Search for repositories on GitHub
export async function searchRepos(
  userId: string,
  query: string,
  perPage: number = 20,
  page: number = 1,
  searchType: "all" | "name" | "owner" = "all"
): Promise<{
  items: {
    id: number;
    full_name: string;
    description: string | null;
    stargazers_count: number;
    language: string | null;
    owner: { login: string; avatar_url: string };
  }[];
  total_count: number;
  has_more: boolean;
}> {
  const octokit = await getUserOctokit(userId);

  // Helper to fetch repos for a user/org
  const fetchUserRepos = async (username: string, pg: number, limit: number) => {
    try {
      let data;
      try {
        const response = await octokit.rest.repos.listForUser({
          username,
          per_page: limit,
          page: pg,
          sort: "pushed",
          direction: "desc",
        });
        data = response.data;
      } catch {
        const response = await octokit.rest.repos.listForOrg({
          org: username,
          per_page: limit,
          page: pg,
          sort: "pushed",
          direction: "desc",
        });
        data = response.data;
      }
      return data.map((repo) => ({
        id: repo.id,
        full_name: repo.full_name,
        description: repo.description ?? null,
        stargazers_count: repo.stargazers_count ?? 0,
        language: repo.language ?? null,
        owner: {
          login: repo.owner.login,
          avatar_url: repo.owner.avatar_url,
        },
      }));
    } catch {
      return [];
    }
  };

  // For owner search, list repos directly
  if (searchType === "owner") {
    const items = await fetchUserRepos(query, page, perPage);
    const hasMore = items.length === perPage;
    return {
      items,
      total_count: hasMore ? page * perPage + 1 : (page - 1) * perPage + items.length,
      has_more: hasMore,
    };
  }

  // Build search query based on type
  let searchQuery = query;
  if (searchType === "name") {
    searchQuery = `${query} in:name`;
  }

  const { data } = await octokit.rest.search.repos({
    q: searchQuery,
    per_page: perPage,
    page,
    sort: "stars",
    order: "desc",
  });

  let items = data.items
    .filter((repo) => repo.owner !== null)
    .map((repo) => ({
      id: repo.id,
      full_name: repo.full_name,
      description: repo.description,
      stargazers_count: repo.stargazers_count,
      language: repo.language,
      owner: {
        login: repo.owner!.login,
        avatar_url: repo.owner!.avatar_url,
      },
    }));

  // For "all" search on first page, also check if query matches a username
  if (searchType === "all" && page === 1 && /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(query)) {
    const userRepos = await fetchUserRepos(query, 1, 10);
    if (userRepos.length > 0) {
      // Merge user repos at the top, avoiding duplicates
      const existingIds = new Set(items.map((r) => r.id));
      const newRepos = userRepos.filter((r) => !existingIds.has(r.id));
      items = [...newRepos, ...items];
    }
  }

  return {
    items,
    total_count: data.total_count,
    has_more: page * perPage < data.total_count,
  };
}

// Fetch a single issue's current state
export async function fetchIssueState(
  userId: string,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<{ state: "open" | "closed"; closedAt: string | null }> {
  const octokit = await getUserOctokit(userId);

  const { data: issue } = await octokit.rest.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });

  return {
    state: issue.state as "open" | "closed",
    closedAt: issue.closed_at,
  };
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
