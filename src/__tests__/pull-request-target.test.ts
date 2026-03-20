import { describe, expect, it } from "vitest";
import {
  parseGitHubPullRequestUrl,
  resolveDraftPullRequestTarget,
} from "@/lib/pull-request-target";

describe("parseGitHubPullRequestUrl", () => {
  it("parses standard PR URLs", () => {
    expect(
      parseGitHubPullRequestUrl("https://github.com/octocat/hello-world/pull/42")
    ).toEqual({
      owner: "octocat",
      repo: "hello-world",
      pullNumber: 42,
    });
  });

  it("parses URLs with www and trailing slash", () => {
    expect(
      parseGitHubPullRequestUrl("https://www.github.com/vercel/next.js/pull/101/")
    ).toEqual({
      owner: "vercel",
      repo: "next.js",
      pullNumber: 101,
    });
  });

  it("returns null for non-PR or non-github URLs", () => {
    expect(
      parseGitHubPullRequestUrl("https://github.com/octocat/hello-world/issues/42")
    ).toBeNull();
    expect(
      parseGitHubPullRequestUrl("https://example.com/octocat/hello-world/pull/42")
    ).toBeNull();
  });
});

describe("resolveDraftPullRequestTarget", () => {
  it("prefers owner/repo/number from draft PR URL", () => {
    expect(
      resolveDraftPullRequestTarget({
        draftPrUrl: "https://github.com/fork-owner/fork-repo/pull/77",
        draftPrOwner: "stale-owner",
        draftPrNumber: 12,
        defaultOwner: "upstream-owner",
        defaultRepo: "upstream-repo",
      })
    ).toEqual({
      owner: "fork-owner",
      repo: "fork-repo",
      pullNumber: 77,
    });
  });

  it("falls back to stored owner/number and default repo when URL is invalid", () => {
    expect(
      resolveDraftPullRequestTarget({
        draftPrUrl: "https://github.com/not-a-pr/url",
        draftPrOwner: "stored-owner",
        draftPrNumber: 12,
        defaultOwner: "upstream-owner",
        defaultRepo: "upstream-repo",
      })
    ).toEqual({
      owner: "stored-owner",
      repo: "upstream-repo",
      pullNumber: 12,
    });
  });

  it("falls back to defaults when no URL and no stored owner", () => {
    expect(
      resolveDraftPullRequestTarget({
        draftPrUrl: null,
        draftPrOwner: null,
        draftPrNumber: 9,
        defaultOwner: "upstream-owner",
        defaultRepo: "upstream-repo",
      })
    ).toEqual({
      owner: "upstream-owner",
      repo: "upstream-repo",
      pullNumber: 9,
    });
  });
});
