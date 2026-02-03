import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { issueHasLinkedPR } from "@/lib/github";
import { createIssueNotification } from "@/lib/notifications";
import { triggerCopilotAutoFix } from "@/lib/copilot";

// Verify GitHub webhook signature
function verifySignature(payload: string, signature: string | null): boolean {
  if (!signature || !process.env.GITHUB_WEBHOOK_SECRET) {
    return false;
  }

  const hmac = crypto.createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET);
  const digest = `sha256=${hmac.update(payload).digest("hex")}`;

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

// POST /api/webhooks/github - Receive GitHub webhook events
export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const event = request.headers.get("x-github-event");

  // Verify webhook signature
  if (!verifySignature(payload, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(payload);

  // Handle issue events
  if (event === "issues") {
    await handleIssueEvent(body);
  }

  return NextResponse.json({ received: true });
}

async function handleIssueEvent(payload: {
  action: string;
  issue: {
    number: number;
    title: string;
    html_url: string;
    labels: Array<{ name: string }>;
  };
  repository: {
    owner: { login: string };
    name: string;
  };
}) {
  const { action, issue, repository } = payload;

  // Only process opened or labeled events
  if (action !== "opened" && action !== "labeled") {
    return;
  }

  const owner = repository.owner.login;
  const repo = repository.name;
  const issueLabels = issue.labels.map((l) => l.name);

  // Find all users watching this repo
  const watchedRepos = await prisma.watchedRepo.findMany({
    where: {
      owner,
      repo,
    },
    include: {
      user: true,
    },
  });

  for (const watchedRepo of watchedRepos) {
    // Check if issue matches user's filters
    const userLabels = JSON.parse(watchedRepo.labels || "[]") as string[];

    // If user has label filters, check if issue has any matching labels
    if (userLabels.length > 0) {
      const hasMatchingLabel = userLabels.some((label) =>
        issueLabels.includes(label)
      );
      if (!hasMatchingLabel) {
        continue;
      }
    }

    // Check if issue already has a linked PR
    const hasPR = await issueHasLinkedPR(
      watchedRepo.userId,
      owner,
      repo,
      issue.number
    );

    if (hasPR) {
      continue;
    }

    // Check if we're already tracking this issue
    const existingIssue = await prisma.trackedIssue.findUnique({
      where: {
        watchedRepoId_issueNumber: {
          watchedRepoId: watchedRepo.id,
          issueNumber: issue.number,
        },
      },
    });

    if (existingIssue) {
      continue;
    }

    // Create tracked issue
    const trackedIssue = await prisma.trackedIssue.create({
      data: {
        watchedRepoId: watchedRepo.id,
        issueNumber: issue.number,
        title: issue.title,
        url: issue.html_url,
        labels: JSON.stringify(issueLabels),
        autoFixStatus: "queued",
        notifiedAt: new Date(),
      },
    });

    // Create notification
    await createIssueNotification(
      watchedRepo.userId,
      owner,
      repo,
      issue.number,
      issue.title,
      trackedIssue.id
    );

    // Trigger Copilot auto-fix in the background
    // This assigns the issue to Copilot coding agent
    triggerCopilotAutoFix(trackedIssue.id).catch((error) => {
      console.error("Failed to trigger Copilot auto-fix:", error);
    });
  }
}
