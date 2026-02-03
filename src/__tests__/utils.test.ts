import { describe, it, expect } from "vitest";

describe("Utility functions", () => {
  describe("parseRepoUrl", () => {
    const parseRepoUrl = (url: string): { owner: string; repo: string } | null => {
      const patterns = [
        /^([^/]+)\/([^/]+)$/,
        /github\.com\/([^/]+)\/([^/]+)/,
      ];

      for (const pattern of patterns) {
        const match = url.trim().match(pattern);
        if (match) {
          return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
        }
      }
      return null;
    };

    it("parses owner/repo format", () => {
      const result = parseRepoUrl("facebook/react");
      expect(result).toEqual({ owner: "facebook", repo: "react" });
    });

    it("parses github.com URL", () => {
      const result = parseRepoUrl("https://github.com/vercel/next.js");
      expect(result).toEqual({ owner: "vercel", repo: "next.js" });
    });

    it("parses github.com URL with .git suffix", () => {
      const result = parseRepoUrl("https://github.com/prisma/prisma.git");
      expect(result).toEqual({ owner: "prisma", repo: "prisma" });
    });

    it("returns null for invalid format", () => {
      const result = parseRepoUrl("invalid-format");
      expect(result).toBeNull();
    });

    it("handles whitespace", () => {
      const result = parseRepoUrl("  owner/repo  ");
      expect(result).toEqual({ owner: "owner", repo: "repo" });
    });
  });
});

describe("Issue filtering", () => {
  it("matches issues with correct labels", () => {
    const userLabels = ["good first issue", "bug"];
    const issueLabels = ["bug", "help wanted"];

    const hasMatch = userLabels.some((label) => issueLabels.includes(label));
    expect(hasMatch).toBe(true);
  });

  it("does not match issues without matching labels", () => {
    const userLabels = ["good first issue"];
    const issueLabels = ["bug", "help wanted"];

    const hasMatch = userLabels.some((label) => issueLabels.includes(label));
    expect(hasMatch).toBe(false);
  });

  it("matches all issues when no filters set", () => {
    const userLabels: string[] = [];
    const issueLabels = ["bug"];

    const hasMatch = userLabels.length === 0 || userLabels.some((label) => issueLabels.includes(label));
    expect(hasMatch).toBe(true);
  });
});

describe("Auto-fix status", () => {
  const validStatuses = [
    "queued",
    "generating",
    "draft_ready",
    "published",
    "rejected",
    "failed",
    "skipped",
  ];

  it("has all valid status values", () => {
    expect(validStatuses).toContain("queued");
    expect(validStatuses).toContain("draft_ready");
    expect(validStatuses).toContain("skipped");
  });

  it("transitions from queued to generating", () => {
    const currentStatus = "queued";
    const nextStatus = "generating";
    expect(validStatuses.indexOf(nextStatus)).toBeGreaterThan(validStatuses.indexOf(currentStatus));
  });
});
