export type PullRequestTarget = {
  owner: string;
  repo: string;
  pullNumber: number;
};

type DraftPullRequestTargetInput = {
  draftPrUrl?: string | null;
  draftPrOwner?: string | null;
  draftPrNumber: number;
  defaultOwner: string;
  defaultRepo: string;
};

export function parseGitHubPullRequestUrl(
  url: string
): PullRequestTarget | null {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return null;
  }

  try {
    const parsed = new URL(trimmedUrl);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname !== "github.com" && hostname !== "www.github.com") {
      return null;
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 4) {
      return null;
    }

    const [owner, repo, resource, pullNumberRaw] = segments;
    if (!owner || !repo || resource !== "pull") {
      return null;
    }

    const pullNumber = Number.parseInt(pullNumberRaw, 10);
    if (!Number.isInteger(pullNumber) || pullNumber < 1) {
      return null;
    }

    return { owner, repo, pullNumber };
  } catch {
    return null;
  }
}

export function resolveDraftPullRequestTarget(
  input: DraftPullRequestTargetInput
): PullRequestTarget {
  const fromUrl = input.draftPrUrl
    ? parseGitHubPullRequestUrl(input.draftPrUrl)
    : null;

  return {
    owner: fromUrl?.owner || input.draftPrOwner || input.defaultOwner,
    repo: fromUrl?.repo || input.defaultRepo,
    pullNumber: fromUrl?.pullNumber || input.draftPrNumber,
  };
}
