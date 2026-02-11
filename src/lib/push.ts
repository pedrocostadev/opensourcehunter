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
  if (
    !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    !process.env.VAPID_PRIVATE_KEY ||
    !process.env.VAPID_EMAIL
  ) {
    console.warn(
      "VAPID not configured, skipping push. Set: PUBLIC_KEY=%s PRIVATE_KEY=%s EMAIL=%s",
      !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      !!process.env.VAPID_PRIVATE_KEY,
      !!process.env.VAPID_EMAIL
    );
    return null;
  }

  const endpoint = subscription.endpoint.slice(0, 60) + "...";
  try {
    const result = await webpush.sendNotification(
      subscription,
      JSON.stringify(payload)
    );
    console.log("Push sent OK to %s (status %d)", endpoint, result.statusCode);
    return result;
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    console.error("Push failed to %s (status %s):", endpoint, statusCode, error);
    if (statusCode === 410) {
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
  issueUrl: string,
  type: "issue" | "pull_request" = "issue"
): PushPayload {
  const itemType = type === "pull_request" ? "pull request" : "issue";
  return {
    title: `New ${itemType} in ${owner}/${repo}`,
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
