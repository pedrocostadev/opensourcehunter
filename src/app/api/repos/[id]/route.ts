import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

// DELETE /api/repos/[id] - Remove repo from watchlist
export async function DELETE(
  request: Request,
  { params }: { params: Params }
) {
  const session = await getServerSession(authOptions);
  const { id } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repo = await prisma.watchedRepo.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!repo) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }

  await prisma.watchedRepo.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

// PATCH /api/repos/[id] - Update repo filters
export async function PATCH(
  request: Request,
  { params }: { params: Params }
) {
  const session = await getServerSession(authOptions);
  const { id } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repo = await prisma.watchedRepo.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!repo) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }

  const body = await request.json();
  const { languages, labels, frozen, titleQuery } = body;

  const updatedRepo = await prisma.watchedRepo.update({
    where: { id },
    data: {
      ...(languages !== undefined && { languages: JSON.stringify(languages) }),
      ...(labels !== undefined && { labels: JSON.stringify(labels) }),
      ...(frozen !== undefined && { frozen }),
      ...(titleQuery !== undefined && { titleQuery: titleQuery || null }),
    },
  });

  return NextResponse.json(updatedRepo);
}
