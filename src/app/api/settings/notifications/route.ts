import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const preferences = await prisma.notificationPreferences.findUnique({
    where: { userId: session.user.id },
  });

  // Return default preferences if none exist
  if (!preferences) {
    return NextResponse.json({
      emailEnabled: false,
      pushEnabled: false,
      newIssueEmail: true,
      draftReadyEmail: true,
      newIssuePush: true,
      draftReadyPush: true,
      hasPushSubscription: false,
    });
  }

  return NextResponse.json({
    emailEnabled: preferences.emailEnabled,
    pushEnabled: preferences.pushEnabled,
    newIssueEmail: preferences.newIssueEmail,
    draftReadyEmail: preferences.draftReadyEmail,
    newIssuePush: preferences.newIssuePush,
    draftReadyPush: preferences.draftReadyPush,
    hasPushSubscription: !!preferences.pushSubscription,
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    emailEnabled,
    pushEnabled,
    newIssueEmail,
    draftReadyEmail,
    newIssuePush,
    draftReadyPush,
  } = body;

  const data: Record<string, boolean> = {};
  if (typeof emailEnabled === "boolean") data.emailEnabled = emailEnabled;
  if (typeof pushEnabled === "boolean") data.pushEnabled = pushEnabled;
  if (typeof newIssueEmail === "boolean") data.newIssueEmail = newIssueEmail;
  if (typeof draftReadyEmail === "boolean") data.draftReadyEmail = draftReadyEmail;
  if (typeof newIssuePush === "boolean") data.newIssuePush = newIssuePush;
  if (typeof draftReadyPush === "boolean") data.draftReadyPush = draftReadyPush;

  const preferences = await prisma.notificationPreferences.upsert({
    where: { userId: session.user.id },
    update: data,
    create: {
      userId: session.user.id,
      ...data,
    },
  });

  return NextResponse.json({
    emailEnabled: preferences.emailEnabled,
    pushEnabled: preferences.pushEnabled,
    newIssueEmail: preferences.newIssueEmail,
    draftReadyEmail: preferences.draftReadyEmail,
    newIssuePush: preferences.newIssuePush,
    draftReadyPush: preferences.draftReadyPush,
    hasPushSubscription: !!preferences.pushSubscription,
  });
}
