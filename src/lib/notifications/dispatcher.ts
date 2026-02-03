import { prisma } from "@/lib/prisma";
import {
  sendEmail,
  newIssueEmailTemplate,
  draftReadyEmailTemplate,
} from "@/lib/email";
import {
  sendPushNotification,
  newIssuePushPayload,
  draftReadyPushPayload,
} from "@/lib/push";

interface NotificationContext {
  userId: string;
  issueId?: string;
}

interface IssueNotificationData {
  owner: string;
  repo: string;
  issueNumber: number;
  issueTitle: string;
  issueUrl: string;
}

interface DraftNotificationData {
  owner: string;
  repo: string;
  issueNumber: number;
  prNumber: number;
  draftId: string;
}

async function getUserPreferencesAndEmail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { notificationPreferences: true },
  });
  return user;
}

async function createInAppNotification(
  userId: string,
  message: string,
  issueId?: string
) {
  return prisma.notification.create({
    data: { userId, message, issueId },
  });
}

export async function dispatchIssueNotification(
  context: NotificationContext,
  data: IssueNotificationData
) {
  const { userId, issueId } = context;
  const { owner, repo, issueNumber, issueTitle, issueUrl } = data;

  const message = `New issue in ${owner}/${repo}: #${issueNumber} - ${issueTitle}`;

  // Always create in-app notification
  await createInAppNotification(userId, message, issueId);

  // Get user preferences
  const user = await getUserPreferencesAndEmail(userId);
  if (!user) return;

  const prefs = user.notificationPreferences;
  if (!prefs) return;

  // Send email if enabled
  if (prefs.emailEnabled && prefs.newIssueEmail && user.email) {
    const template = newIssueEmailTemplate(
      owner,
      repo,
      issueNumber,
      issueTitle,
      issueUrl
    );
    await sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.html,
    });
  }

  // Send push if enabled
  if (prefs.pushEnabled && prefs.newIssuePush && prefs.pushSubscription) {
    try {
      const subscription = JSON.parse(prefs.pushSubscription);
      const payload = newIssuePushPayload(
        owner,
        repo,
        issueNumber,
        issueTitle,
        issueUrl
      );
      const result = await sendPushNotification(subscription, payload);

      // Clear expired subscription
      if (result && "expired" in result && result.expired) {
        await prisma.notificationPreferences.update({
          where: { userId },
          data: { pushSubscription: null, pushEnabled: false },
        });
      }
    } catch {
      console.error("Failed to parse push subscription");
    }
  }
}

export async function dispatchDraftReadyNotification(
  context: NotificationContext,
  data: DraftNotificationData
) {
  const { userId, issueId } = context;
  const { owner, repo, issueNumber, prNumber, draftId } = data;

  const message = `Draft PR #${prNumber} ready for review: ${owner}/${repo} issue #${issueNumber}`;

  // Always create in-app notification
  await createInAppNotification(userId, message, issueId);

  // Get user preferences
  const user = await getUserPreferencesAndEmail(userId);
  if (!user) return;

  const prefs = user.notificationPreferences;
  if (!prefs) return;

  // Send email if enabled
  if (prefs.emailEnabled && prefs.draftReadyEmail && user.email) {
    const draftUrl = `${process.env.NEXTAUTH_URL}/drafts/${draftId}`;
    const template = draftReadyEmailTemplate(
      owner,
      repo,
      issueNumber,
      prNumber,
      draftUrl
    );
    await sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.html,
    });
  }

  // Send push if enabled
  if (prefs.pushEnabled && prefs.draftReadyPush && prefs.pushSubscription) {
    try {
      const subscription = JSON.parse(prefs.pushSubscription);
      const payload = draftReadyPushPayload(
        owner,
        repo,
        issueNumber,
        prNumber,
        draftId
      );
      const result = await sendPushNotification(subscription, payload);

      // Clear expired subscription
      if (result && "expired" in result && result.expired) {
        await prisma.notificationPreferences.update({
          where: { userId },
          data: { pushSubscription: null, pushEnabled: false },
        });
      }
    } catch {
      console.error("Failed to parse push subscription");
    }
  }
}
