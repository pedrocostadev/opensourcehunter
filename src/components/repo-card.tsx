"use client";

import { useState } from "react";
import { ExternalLink, MoreVertical, Trash2, Snowflake, Play, Bell, FileEdit, Rocket, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WatchedRepo {
  id: string;
  owner: string;
  repo: string;
  labels: string;
  languages: string;
  titleQuery: string | null;
  frozen: boolean;
  prMode: string;
  createdAt: string;
  _count: {
    trackedIssues: number;
  };
}

interface RepoCardProps {
  repo: WatchedRepo;
  onDelete: () => void;
  onUpdate: () => void;
}

export function RepoCard({ repo, onDelete, onUpdate }: RepoCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isChangingMode, setIsChangingMode] = useState(false);
  const labels = JSON.parse(repo.labels || "[]") as string[];

  const handlePrModeChange = async (mode: string) => {
    setIsChangingMode(true);
    try {
      const res = await fetch(`/api/repos/${repo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prMode: mode }),
      });
      if (res.ok) {
        const modeLabel = mode === "notify" ? "Notify only" : mode === "draft" ? "Draft PR" : "Auto-publish";
        toast.success(`PR mode set to ${modeLabel}`);
        onUpdate();
      } else {
        toast.error("Failed to update PR mode");
      }
    } catch {
      toast.error("Failed to update PR mode");
    } finally {
      setIsChangingMode(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/repos/${repo.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(`Stopped watching ${repo.owner}/${repo.repo}`);
        onDelete();
      } else {
        toast.error("Failed to remove repository");
      }
    } catch (error) {
      toast.error("Failed to remove repository");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleFreeze = async () => {
    setIsToggling(true);
    try {
      const res = await fetch(`/api/repos/${repo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frozen: !repo.frozen }),
      });
      if (res.ok) {
        toast.success(
          repo.frozen
            ? `Resumed watching ${repo.owner}/${repo.repo}`
            : `Paused watching ${repo.owner}/${repo.repo}`
        );
        onUpdate();
      } else {
        toast.error("Failed to update repository");
      }
    } catch (error) {
      toast.error("Failed to update repository");
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <Card className={cn(repo.frozen && "opacity-60")}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-lg font-medium min-w-0">
          <a
            href={`https://github.com/${repo.owner}/${repo.repo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:underline"
          >
            <span className="truncate">{repo.owner}/{repo.repo}</span>
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
          </a>
        </CardTitle>
        <div className="flex items-center gap-2">
          {repo.frozen && (
            <Badge variant="secondary" className="gap-1">
              <Snowflake className="h-3 w-3" aria-hidden="true" />
              Paused
            </Badge>
          )}
          <Badge variant="outline" className="gap-1">
            {repo.prMode === "notify" && <><Bell className="h-3 w-3" aria-hidden="true" />Notify</>}
            {repo.prMode === "draft" && <><FileEdit className="h-3 w-3" aria-hidden="true" />Draft</>}
            {repo.prMode === "publish" && <><Rocket className="h-3 w-3" aria-hidden="true" />Auto</>}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Repository options">
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs text-muted-foreground">PR mode</DropdownMenuLabel>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => handlePrModeChange("notify")}
                disabled={isChangingMode || repo.prMode === "notify"}
              >
                <Bell className="mr-2 h-4 w-4" aria-hidden="true" />
                Notify only
                {repo.prMode === "notify" && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => handlePrModeChange("draft")}
                disabled={isChangingMode || repo.prMode === "draft"}
              >
                <FileEdit className="mr-2 h-4 w-4" aria-hidden="true" />
                Draft PR
                {repo.prMode === "draft" && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => handlePrModeChange("publish")}
                disabled={isChangingMode || repo.prMode === "publish"}
              >
                <Rocket className="mr-2 h-4 w-4" aria-hidden="true" />
                Auto-publish
                {repo.prMode === "publish" && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={handleToggleFreeze}
                disabled={isToggling}
              >
                {repo.frozen ? (
                  <>
                    <Play className="mr-2 h-4 w-4" aria-hidden="true" />
                    Resume
                  </>
                ) : (
                  <>
                    <Snowflake className="mr-2 h-4 w-4" aria-hidden="true" />
                    Pause
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive cursor-pointer"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{repo._count.trackedIssues}</span>
            <span className="text-muted-foreground">tracked issues</span>
          </div>
          {labels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {labels.map((label) => (
                <Badge key={label} variant="secondary">
                  {label}
                </Badge>
              ))}
            </div>
          )}
          {repo.titleQuery && (
            <div className="text-sm text-muted-foreground">
              Title: &ldquo;{repo.titleQuery}&rdquo;
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
