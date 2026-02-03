"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const COMMON_LABELS = [
  "good first issue",
  "help wanted",
  "bug",
  "enhancement",
  "documentation",
];

interface AddRepoDialogProps {
  onRepoAdded: () => void;
}

export function AddRepoDialog({ onRepoAdded }: AddRepoDialogProps) {
  const [open, setOpen] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<string[]>(["good first issue"]);
  const [isLoading, setIsLoading] = useState(false);

  const parseRepoUrl = (url: string): { owner: string; repo: string } | null => {
    // Handle formats: owner/repo, github.com/owner/repo, https://github.com/owner/repo
    const patterns = [
      /^([^/]+)\/([^/]+)$/,
      /github\.com\/([^/]+)\/([^/]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.trim().match(pattern);
      if (match) {
        return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
      }
    }
    return null;
  };

  const toggleLabel = (label: string) => {
    setSelectedLabels((prev) =>
      prev.includes(label)
        ? prev.filter((l) => l !== label)
        : [...prev, label]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
      toast.error("Invalid repository format. Use owner/repo or GitHub URL");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: parsed.owner,
          repo: parsed.repo,
          labels: selectedLabels,
          languages: [],
        }),
      });

      if (res.ok) {
        toast.success(`Now watching ${parsed.owner}/${parsed.repo}`);
        setOpen(false);
        setRepoUrl("");
        setSelectedLabels(["good first issue"]);
        onRepoAdded();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to add repository");
      }
    } catch (error) {
      toast.error("Failed to add repository");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Repository
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Repository to Watch</DialogTitle>
            <DialogDescription>
              Enter a GitHub repository to monitor for new issues.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="repo">Repository</Label>
              <Input
                id="repo"
                placeholder="owner/repo or https://github.com/owner/repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Filter by labels</Label>
              <div className="flex flex-wrap gap-2">
                {COMMON_LABELS.map((label) => (
                  <Button
                    key={label}
                    type="button"
                    variant={selectedLabels.includes(label) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleLabel(label)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Only issues with these labels will be tracked
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Adding..." : "Add Repository"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
