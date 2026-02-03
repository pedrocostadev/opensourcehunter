import { prisma } from "./prisma";

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
  issueId: string
) {
  const message = `New issue in ${owner}/${repo}: #${issueNumber} - ${issueTitle}`;
  return createNotification(userId, message, issueId);
}

export async function createDraftReadyNotification(
  userId: string,
  owner: string,
  repo: string,
  issueNumber: number,
  prNumber: number,
  issueId: string
) {
  const message = `Draft PR #${prNumber} ready for review: ${owner}/${repo} issue #${issueNumber}`;
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
