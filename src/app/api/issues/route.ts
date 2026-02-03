import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/issues - Get all tracked issues for user
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // filter by autoFixStatus
  const unreadOnly = searchParams.get("unread") === "true";

  const issues = await prisma.trackedIssue.findMany({
    where: {
      watchedRepo: {
        userId: session.user.id,
      },
      ...(status && { autoFixStatus: status }),
      ...(unreadOnly && { isRead: false }),
    },
    include: {
      watchedRepo: {
        select: {
          owner: true,
          repo: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(issues);
}
