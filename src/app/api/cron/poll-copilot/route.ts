import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pollCopilotPRStatus } from "@/lib/copilot";

// This endpoint can be called by Vercel Cron or external cron service
// to check if Copilot has created PRs for issues that are "generating"

export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find all issues that are in "generating" status
    const generatingIssues = await prisma.trackedIssue.findMany({
      where: {
        autoFixStatus: "generating",
      },
      select: {
        id: true,
      },
    });

    console.log(`Polling ${generatingIssues.length} issues for Copilot PR status`);

    // Poll each issue for PR status
    const results = await Promise.allSettled(
      generatingIssues.map((issue) => pollCopilotPRStatus(issue.id))
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({
      polled: generatingIssues.length,
      successful,
      failed,
    });
  } catch (error) {
    console.error("Cron job failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
