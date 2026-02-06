import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRepoOwnership, forkRepository, getGitHubUsername, validateRepoAccess } from "@/lib/github";

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
  const { owner, repo, languages = [], labels = [], titleQuery } = body;

  if (!owner || !repo) {
    return NextResponse.json(
      { error: "Owner and repo are required" },
      { status: 400 }
    );
  }

  try {
    // Validate repo exists and user has access
    const hasAccess = await validateRepoAccess(session.user.id, owner, repo);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Repository not found or not accessible" },
        { status: 404 }
      );
    }

    // Check if user owns the repo (has push access)
    const { isOwned } = await checkRepoOwnership(session.user.id, owner, repo);

    let forkOwner: string | null = null;
    let forkRepo: string | null = null;

    if (!isOwned) {
      // User doesn't own the repo - need to fork it for Copilot to create PRs
      try {
        const fork = await forkRepository(session.user.id, owner, repo);
        forkOwner = fork.forkOwner;
        forkRepo = fork.forkRepo;
      } catch (error) {
        console.error("Failed to fork repository:", error);
        return NextResponse.json(
          { error: "Failed to fork repository. Please try again." },
          { status: 500 }
        );
      }
    }

    // Ensure user's GitHub username is stored
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.githubUsername) {
      const username = await getGitHubUsername(session.user.id);
      await prisma.user.update({
        where: { id: session.user.id },
        data: { githubUsername: username },
      });
    }

    const watchedRepo = await prisma.watchedRepo.create({
      data: {
        userId: session.user.id,
        owner,
        repo,
        languages: JSON.stringify(languages),
        labels: JSON.stringify(labels),
        titleQuery: titleQuery || null,
        isOwned,
        forkOwner,
        forkRepo,
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
