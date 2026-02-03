"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { AddRepoDialog } from "@/components/add-repo-dialog";
import { RepoCard } from "@/components/repo-card";
import { IssueCard } from "@/components/issue-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface WatchedRepo {
  id: string;
  owner: string;
  repo: string;
  labels: string;
  languages: string;
  frozen: boolean;
  createdAt: string;
  _count: {
    trackedIssues: number;
  };
}

interface TrackedIssue {
  id: string;
  issueNumber: number;
  title: string;
  url: string;
  labels: string;
  isRead: boolean;
  claimedAt: string | null;
  autoFixStatus: string;
  draftPrUrl: string | null;
  draftPrNumber: number | null;
  createdAt: string;
  watchedRepo: {
    owner: string;
    repo: string;
  };
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [repos, setRepos] = useState<WatchedRepo[]>([]);
  const [issues, setIssues] = useState<TrackedIssue[]>([]);
  const [drafts, setDrafts] = useState<TrackedIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("issues");

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/api/auth/signin");
    }
  }, [status]);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [reposRes, issuesRes, draftsRes] = await Promise.all([
        fetch("/api/repos"),
        fetch("/api/issues"),
        fetch("/api/drafts"),
      ]);

      if (reposRes.ok) setRepos(await reposRes.json());
      if (issuesRes.ok) setIssues(await issuesRes.json());
      if (draftsRes.ok) setDrafts(await draftsRes.json());
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container py-8">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  const unreadIssues = issues.filter((i) => !i.isRead);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">
              Track open source issues and auto-generate PRs
            </p>
          </div>
          <AddRepoDialog onRepoAdded={fetchData} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="issues">
              Issues {unreadIssues.length > 0 && `(${unreadIssues.length} new)`}
            </TabsTrigger>
            <TabsTrigger value="drafts">
              Draft PRs {drafts.length > 0 && `(${drafts.length})`}
            </TabsTrigger>
            <TabsTrigger value="repos">
              Watched Repos ({repos.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="issues" className="space-y-4">
            {issues.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg">No issues found</p>
                <p className="text-sm">
                  Add repositories to start tracking issues
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {issues.map((issue) => (
                  <IssueCard key={issue.id} issue={issue} onUpdate={fetchData} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="drafts" className="space-y-4">
            {drafts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg">No draft PRs pending</p>
                <p className="text-sm">
                  Draft PRs will appear here when Copilot generates them
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {drafts.map((issue) => (
                  <IssueCard key={issue.id} issue={issue} onUpdate={fetchData} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="repos" className="space-y-4">
            {repos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg">No repositories watched</p>
                <p className="text-sm">
                  Click "Add Repository" to start watching a repo
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {repos.map((repo) => (
                  <RepoCard key={repo.id} repo={repo} onDelete={fetchData} onUpdate={fetchData} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
