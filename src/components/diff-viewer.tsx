"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface DiffFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

interface DiffViewerProps {
  owner: string;
  repo: string;
  prNumber: number;
}

export function DiffViewer({ owner, repo, prNumber }: DiffViewerProps) {
  const [files, setFiles] = useState<DiffFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDiff();
  }, [owner, repo, prNumber]);

  const fetchDiff = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`,
        {
          headers: {
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      if (!res.ok) {
        throw new Error("Failed to fetch PR diff");
      }

      const data = await res.json();
      setFiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load diff");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {error}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="font-medium">{files.length} files changed</span>
        <Badge variant="secondary" className="text-green-600">
          +{files.reduce((sum, f) => sum + f.additions, 0)}
        </Badge>
        <Badge variant="secondary" className="text-red-600">
          -{files.reduce((sum, f) => sum + f.deletions, 0)}
        </Badge>
      </div>

      {files.map((file) => (
        <Card key={file.filename}>
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-mono">
                {file.filename}
              </CardTitle>
              <div className="flex gap-2">
                <Badge
                  variant={
                    file.status === "added"
                      ? "default"
                      : file.status === "removed"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {file.status}
                </Badge>
                <span className="text-green-600 text-sm">+{file.additions}</span>
                <span className="text-red-600 text-sm">-{file.deletions}</span>
              </div>
            </div>
          </CardHeader>
          {file.patch && (
            <CardContent className="p-0">
              <pre className="text-xs overflow-x-auto bg-muted p-4 rounded-b-lg">
                {file.patch.split("\n").map((line, i) => (
                  <div
                    key={i}
                    className={`${
                      line.startsWith("+")
                        ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                        : line.startsWith("-")
                        ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                        : line.startsWith("@@")
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                        : ""
                    }`}
                  >
                    {line}
                  </div>
                ))}
              </pre>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
