import webpush from "web-push";

if (
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY &&
  process.env.VAPID_EMAIL
) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

export async function sendPushNotification(
  subscription: webpush.PushSubscription,
  payload: PushPayload
) {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn("VAPID keys not set, skipping push notification");
    return null;
  }

  try {
    const result = await webpush.sendNotification(
      subscription,
      JSON.stringify(payload)
    );
    return result;
  } catch (error) {
    console.error("Push notification error:", error);
    if ((error as { statusCode?: number }).statusCode === 410) {
      // Subscription expired or unsubscribed
      return { expired: true };
    }
    return null;
  }
}

export function newIssuePushPayload(
  owner: string,
  repo: string,
  issueNumber: number,
  issueTitle: string,
  issueUrl: string
): PushPayload {
  return {
    title: `New issue in ${owner}/${repo}`,
    body: `#${issueNumber} - ${issueTitle}`,
    url: issueUrl,
    icon: "/icon-192.png",
  };
}

export function draftReadyPushPayload(
  owner: string,
  repo: string,
  issueNumber: number,
  prNumber: number,
  draftId: string
): PushPayload {
  return {
    title: `Draft PR #${prNumber} ready`,
    body: `${owner}/${repo} issue #${issueNumber}`,
    url: `${process.env.NEXTAUTH_URL}/drafts/${draftId}`,
    icon: "/icon-192.png",
  };
}
