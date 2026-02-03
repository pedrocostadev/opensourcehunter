"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, Check, X } from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { DiffViewer } from "@/components/diff-viewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface DraftDetails {
  id: string;
  issueNumber: number;
  title: string;
  url: string;
  labels: string;
  draftPrUrl: string;
  draftPrNumber: number;
  autoFixStatus: string;
  watchedRepo: {
    owner: string;
    repo: string;
  };
}

export default function DraftReviewPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const [draft, setDraft] = useState<DraftDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/api/auth/signin");
    }
  }, [status, router]);

  useEffect(() => {
    if (session && params.id) {
      fetchDraft();
    }
  }, [session, params.id]);

  const fetchDraft = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/drafts/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setDraft(data);
      } else {
        toast.error("Draft not found");
        router.push("/dashboard");
      }
    } catch (error) {
      toast.error("Failed to load draft");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const res = await fetch(`/api/drafts/${params.id}/publish`, { method: "POST" });
      if (res.ok) {
        toast.success("PR published successfully!");
        router.push("/dashboard");
      } else {
        toast.error("Failed to publish PR");
      }
    } catch (error) {
      toast.error("Failed to publish PR");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      const res = await fetch(`/api/drafts/${params.id}/reject`, { method: "POST" });
      if (res.ok) {
        toast.success("Draft PR rejected");
        router.push("/dashboard");
      } else {
        toast.error("Failed to reject PR");
      }
    } catch (error) {
      toast.error("Failed to reject PR");
    } finally {
      setIsRejecting(false);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container py-8">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-64" />
        </main>
      </div>
    );
  }

  if (!draft) {
    return null;
  }

  const labels = JSON.parse(draft.labels || "[]") as string[];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-8">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold mb-2">Review Draft PR</h1>
              <p className="text-muted-foreground">
                {draft.watchedRepo.owner}/{draft.watchedRepo.repo} • Issue #{draft.issueNumber}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={isRejecting || isPublishing}
              >
                <X className="mr-2 h-4 w-4" />
                {isRejecting ? "Rejecting..." : "Reject"}
              </Button>
              <Button
                onClick={handlePublish}
                disabled={isPublishing || isRejecting}
              >
                <Check className="mr-2 h-4 w-4" />
                {isPublishing ? "Publishing..." : "Publish PR"}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Changes</CardTitle>
              </CardHeader>
              <CardContent>
                <DiffViewer
                  owner={draft.watchedRepo.owner}
                  repo={draft.watchedRepo.repo}
                  prNumber={draft.draftPrNumber}
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Issue Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-1">{draft.title}</h4>
                  <a
                    href={draft.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    View Issue #{draft.issueNumber}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                {labels.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Labels</h4>
                    <div className="flex flex-wrap gap-1">
                      {labels.map((label) => (
                        <Badge key={label} variant="outline">
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Draft PR</CardTitle>
              </CardHeader>
              <CardContent>
                <a
                  href={draft.draftPrUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  PR #{draft.draftPrNumber}
                  <ExternalLink className="h-3 w-3" />
                </a>
                <p className="text-sm text-muted-foreground mt-2">
                  This is a draft PR created by Copilot. Review the changes and
                  publish when ready.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
