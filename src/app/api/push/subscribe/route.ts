import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { subscription } = body;

  if (!subscription || !subscription.endpoint) {
    return NextResponse.json(
      { error: "Invalid subscription" },
      { status: 400 }
    );
  }

  await prisma.notificationPreferences.upsert({
    where: { userId: session.user.id },
    update: {
      pushSubscription: JSON.stringify(subscription),
      pushEnabled: true,
    },
    create: {
      userId: session.user.id,
      pushSubscription: JSON.stringify(subscription),
      pushEnabled: true,
    },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.notificationPreferences.upsert({
    where: { userId: session.user.id },
    update: {
      pushSubscription: null,
      pushEnabled: false,
    },
    create: {
      userId: session.user.id,
      pushSubscription: null,
      pushEnabled: false,
    },
  });

  return NextResponse.json({ success: true });
}
