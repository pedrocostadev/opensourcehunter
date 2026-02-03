import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { searchRepos } from "@/lib/github";

// GET /api/repos/search?q=query - Search GitHub repositories
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const searchType = (searchParams.get("type") || "all") as "all" | "name" | "owner";
  const perPage = 20;

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
  }

  try {
    const result = await searchRepos(session.user.id, query, perPage, page, searchType);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Failed to search repositories" }, { status: 500 });
  }
}
