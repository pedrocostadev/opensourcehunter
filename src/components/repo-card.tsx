"use client";

import { useState } from "react";
import { ExternalLink, MoreVertical, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface WatchedRepo {
  id: string;
  owner: string;
  repo: string;
  labels: string;
  languages: string;
  createdAt: string;
  _count: {
    trackedIssues: number;
  };
}

interface RepoCardProps {
  repo: WatchedRepo;
  onDelete: () => void;
}

export function RepoCard({ repo, onDelete }: RepoCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const labels = JSON.parse(repo.labels || "[]") as string[];

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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium">
          <a
            href={`https://github.com/${repo.owner}/${repo.repo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:underline"
          >
            {repo.owner}/{repo.repo}
            <ExternalLink className="h-4 w-4" />
          </a>
        </CardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive cursor-pointer"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
        </div>
      </CardContent>
    </Card>
  );
}
