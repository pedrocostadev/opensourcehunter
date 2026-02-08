import { prisma } from "./prisma";
import {
  dispatchIssueNotification,
  dispatchDraftReadyNotification,
} from "./notifications/dispatcher";

export async function createNotification(
  userId: string,
  message: string,
  issueId?: string
) {
  return prisma.notification.create({
    data: {
      userId,
      message,
      issueId,
    },
  });
}

export async function createIssueNotification(
  userId: string,
  owner: string,
  repo: string,
  issueNumber: number,
  issueTitle: string,
  issueId: string,
  issueUrl?: string,
  type: "issue" | "pull_request" = "issue"
) {
  const url = issueUrl || `https://github.com/${owner}/${repo}/${type === "pull_request" ? "pull" : "issues"}/${issueNumber}`;
  return dispatchIssueNotification(
    { userId, issueId },
    { owner, repo, issueNumber, issueTitle, issueUrl: url, type }
  );
}

export async function createDraftReadyNotification(
  userId: string,
  owner: string,
  repo: string,
  issueNumber: number,
  prNumber: number,
  issueId: string,
  draftId?: string
) {
  return dispatchDraftReadyNotification(
    { userId, issueId },
    { owner, repo, issueNumber, prNumber, draftId: draftId || issueId }
  );
}

export async function createIssueClosedNotification(
  userId: string,
  owner: string,
  repo: string,
  issueNumber: number,
  issueTitle: string,
  issueId: string
) {
  const message = `Issue #${issueNumber} closed: ${issueTitle}`;
  return createNotification(userId, message, issueId);
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });
}
