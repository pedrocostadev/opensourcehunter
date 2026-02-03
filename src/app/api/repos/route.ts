import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/repos - List user's watched repos
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repos = await prisma.watchedRepo.findMany({
    where: { userId: session.user.id },
    include: {
      _count: {
        select: { trackedIssues: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(repos);
}

// POST /api/repos - Add a repo to watchlist
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { owner, repo, languages = [], labels = [] } = body;

  if (!owner || !repo) {
    return NextResponse.json(
      { error: "Owner and repo are required" },
      { status: 400 }
    );
  }

  try {
    const watchedRepo = await prisma.watchedRepo.create({
      data: {
        userId: session.user.id,
        owner,
        repo,
        languages: JSON.stringify(languages),
        labels: JSON.stringify(labels),
      },
    });

    return NextResponse.json(watchedRepo, { status: 201 });
  } catch (error) {
    // Check for unique constraint violation
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "You are already watching this repository" },
        { status: 409 }
      );
    }
    throw error;
  }
}
