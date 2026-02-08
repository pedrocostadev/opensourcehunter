"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Check, X, Clock, Wrench, Eye, RotateCcw, Trash2, GitPullRequest, CircleDot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface TrackedIssue {
  id: string;
  issueNumber: number;
  title: string;
  url: string;
  labels: string;
  type?: string;
  state: string;
  isRead: boolean;
  claimedAt: string | null;
  autoFixStatus: string;
  draftPrUrl: string | null;
  draftPrNumber: number | null;
  archivedAt: string | null;
  createdAt: string;
  watchedRepo: {
    owner: string;
    repo: string;
  };
}

interface IssueCardProps {
  issue: TrackedIssue;
  onUpdate: () => void;
  showArchiveActions?: boolean;
}

const statusIcons: Record<string, React.ReactNode> = {
  queued: <Clock className="h-4 w-4 text-yellow-500" aria-hidden="true" />,
  generating: <Wrench className="h-4 w-4 text-blue-500 animate-spin" aria-hidden="true" />,
  draft_ready: <Check className="h-4 w-4 text-green-500" aria-hidden="true" />,
  published: <Check className="h-4 w-4 text-green-700" aria-hidden="true" />,
  rejected: <X className="h-4 w-4 text-red-500" aria-hidden="true" />,
  failed: <X className="h-4 w-4 text-red-500" aria-hidden="true" />,
  skipped: <Clock className="h-4 w-4 text-gray-500" aria-hidden="true" />,
};

const statusLabels: Record<string, string> = {
  queued: "Queued for auto-fix",
  generating: "Generating PR…",
  draft_ready: "Draft PR ready",
  published: "PR published",
  rejected: "Rejected",
  failed: "Auto-fix failed",
  skipped: "Working on it",
};

export function IssueCard({ issue, onUpdate, showArchiveActions = false }: IssueCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const labels = JSON.parse(issue.labels || "[]") as string[];
  const isClosed = issue.state === "closed";
  const isPullRequest = issue.type === "pull_request";

  const handleClaim = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/issues/${issue.id}/claim`, { method: "POST" });
      if (res.ok) {
        toast.success("Marked as working on it");
        onUpdate();
      }
    } catch (error) {
      toast.error("Failed to claim issue");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnclaim = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/issues/${issue.id}/claim`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Unclaimed issue");
        onUpdate();
      }
    } catch (error) {
      toast.error("Failed to unclaim issue");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/drafts/${issue.id}/publish`, { method: "POST" });
      if (res.ok) {
        toast.success("PR published!");
        onUpdate();
      }
    } catch (error) {
      toast.error("Failed to publish PR");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/drafts/${issue.id}/reject`, { method: "POST" });
      if (res.ok) {
        toast.success("Draft PR rejected");
        onUpdate();
      }
    } catch (error) {
      toast.error("Failed to reject PR");
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async () => {
    if (issue.isRead) return;
    try {
      await fetch(`/api/issues/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });
      onUpdate();
    } catch (error) {
      // Silent fail for mark as read
    }
  };

  const handleRestore = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/issues/${issue.id}/restore`, { method: "POST" });
      if (res.ok) {
        toast.success("Issue restored");
        onUpdate();
      }
    } catch (error) {
      toast.error("Failed to restore issue");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/issues/${issue.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Issue removed");
        onUpdate();
      }
    } catch (error) {
      toast.error("Failed to remove issue");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card
      className={`transition-colors ${!issue.isRead ? "border-primary/50 bg-primary/5" : ""} ${isClosed ? "opacity-75" : ""}`}
      onClick={markAsRead}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base font-medium leading-tight">
              <a
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`group flex items-start gap-2 hover:underline ${isClosed ? "line-through text-muted-foreground" : ""}`}
                onClick={(e) => e.stopPropagation()}
              >
                {isPullRequest ? (
                  <GitPullRequest className="h-4 w-4 shrink-0 mt-0.5 text-purple-500" aria-label="Pull Request" />
                ) : (
                  <CircleDot className="h-4 w-4 shrink-0 mt-0.5 text-green-500" aria-label="Issue" />
                )}
                <span className="shrink-0 text-muted-foreground">#{issue.issueNumber}</span>
                <span className="line-clamp-2 break-words">{issue.title}</span>
                <ExternalLink className="h-4 w-4 shrink-0 mt-0.5 opacity-70 group-hover:opacity-100" aria-hidden="true" />
              </a>
            </CardTitle>
            <div className="mt-1 text-sm text-muted-foreground">
              {issue.watchedRepo.owner}/{issue.watchedRepo.repo}
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            {isPullRequest && (
              <Badge variant="outline" className="border-purple-500/50 text-purple-700 dark:text-purple-400">PR</Badge>
            )}
            {isClosed && (
              <Badge variant="secondary">Closed</Badge>
            )}
            {!issue.isRead && (
              <Badge variant="default">New</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {labels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {labels.map((label) => (
                <Badge key={label} variant="outline" className="text-xs">
                  {label}
                </Badge>
              ))}
            </div>
          )}

          {!showArchiveActions && (
            <div className="flex items-center gap-2">
              {statusIcons[issue.autoFixStatus]}
              <span className="text-sm">{statusLabels[issue.autoFixStatus]}</span>
            </div>
          )}

          {issue.draftPrUrl && issue.autoFixStatus === "draft_ready" && (
            <a
              href={issue.draftPrUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View Draft PR #{issue.draftPrNumber}
            </a>
          )}

          <div className="flex gap-2 pt-2">
            {issue.autoFixStatus === "draft_ready" && (
              <>
                <Link href={`/drafts/${issue.id}`}>
                  <Button size="sm" variant="outline">
                    <Eye className="mr-1 h-3 w-3" aria-hidden="true" />
                    Review
                  </Button>
                </Link>
                <Button size="sm" onClick={handlePublish} disabled={isLoading}>
                  Publish PR
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReject}
                  disabled={isLoading}
                >
                  Reject
                </Button>
              </>
            )}

            {issue.autoFixStatus === "queued" && !issue.claimedAt && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleClaim}
                disabled={isLoading}
              >
                I&apos;ll work on this
              </Button>
            )}

            {issue.claimedAt && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleUnclaim}
                disabled={isLoading}
              >
                Unclaim
              </Button>
            )}

            {showArchiveActions && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRestore}
                  disabled={isLoading}
                >
                  <RotateCcw className="mr-1 h-3 w-3" aria-hidden="true" />
                  Restore
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={isLoading}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-1 h-3 w-3" aria-hidden="true" />
                  Remove
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
