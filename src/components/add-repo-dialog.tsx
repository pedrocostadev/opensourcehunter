"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Search, Star, Loader2, User, BookMarked, Check } from "lucide-react";
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

type SearchType = "all" | "name" | "owner";

interface SearchResult {
  id: number;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  owner: { login: string; avatar_url: string };
}

interface CreatedRepo {
  id: string;
  owner: string;
  repo: string;
  labels: string;
  languages: string;
  titleQuery: string | null;
  frozen: boolean;
  createdAt: string;
}

interface AddRepoDialogProps {
  onRepoAdded: (repo: CreatedRepo) => void;
}

export function AddRepoDialog({ onRepoAdded }: AddRepoDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("all");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [currentQuery, setCurrentQuery] = useState("");
  const [currentType, setCurrentType] = useState<SearchType>("all");
  const [selectedRepo, setSelectedRepo] = useState<SearchResult | null>(null);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [titleQuery, setTitleQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  const getEffectiveSearch = useCallback((query: string, type: SearchType): { query: string; type: SearchType } => {
    // Auto-detect @ prefix for owner search
    if (query.startsWith("@")) {
      return { query: query.slice(1), type: "owner" };
    }
    return { query, type };
  }, []);

  const fetchResults = useCallback(async (query: string, type: SearchType, pageNum: number, append: boolean = false) => {
    const effective = getEffectiveSearch(query, type);
    
    if (pageNum === 1) {
      setIsSearching(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const res = await fetch(
        `/api/repos/search?q=${encodeURIComponent(effective.query)}&page=${pageNum}&type=${effective.type}`
      );
      if (res.ok) {
        const data = await res.json();
        if (append) {
          setSearchResults((prev) => [...prev, ...data.items]);
        } else {
          setSearchResults(data.items);
        }
        setHasMore(data.has_more);
        setCurrentQuery(query);
        setCurrentType(type);
      }
    } catch {
      // Silently fail search
    } finally {
      setIsSearching(false);
      setIsLoadingMore(false);
    }
  }, [getEffectiveSearch]);

  useEffect(() => {
    const effective = getEffectiveSearch(searchQuery, searchType);
    
    if (effective.query.trim().length < 2) {
      setSearchResults([]);
      setHasMore(false);
      setPage(1);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      fetchResults(searchQuery, searchType, 1, false);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, searchType, fetchResults, getEffectiveSearch]);

  const handleScroll = useCallback(() => {
    const container = resultsContainerRef.current;
    if (!container || isLoadingMore || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollTop + clientHeight >= scrollHeight - 50) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchResults(currentQuery, currentType, nextPage, true);
    }
  }, [isLoadingMore, hasMore, page, currentQuery, currentType, fetchResults]);

  const selectRepo = (repo: SearchResult) => {
    if (selectedRepo?.id === repo.id) {
      setSelectedRepo(null);
    } else {
      setSelectedRepo(repo);
    }
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

    let repoToAdd: { owner: string; repo: string } | null = null;

    if (selectedRepo) {
      const [owner, repoName] = selectedRepo.full_name.split("/");
      repoToAdd = { owner, repo: repoName };
    } else {
      // If no repo selected from search, try to parse the input
      const patterns = [
        /^([^/]+)\/([^/]+)$/,
        /github\.com\/([^/]+)\/([^/]+)/,
      ];
      for (const pattern of patterns) {
        const match = searchQuery.trim().match(pattern);
        if (match) {
          repoToAdd = { owner: match[1], repo: match[2].replace(/\.git$/, "") };
          break;
        }
      }
    }

    if (!repoToAdd) {
      toast.error("Please select a repository or enter a valid owner/repo format");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: repoToAdd.owner,
          repo: repoToAdd.repo,
          labels: selectedLabels,
          languages: [],
          titleQuery: titleQuery.trim() || undefined,
        }),
      });

      if (res.ok) {
        const createdRepo = await res.json();
        toast.success(`Now watching ${repoToAdd.owner}/${repoToAdd.repo}`);
        setOpen(false);
        setSearchQuery("");
        setSelectedRepo(null);
        setSelectedLabels([]);
        onRepoAdded(createdRepo);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to add repository");
      }
    } catch {
      toast.error("Failed to add repository");
    } finally {
      setIsLoading(false);
    }
  };

  const resetDialog = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedRepo(null);
    setSelectedLabels([]);
    setTitleQuery("");
    setHasMore(false);
    setPage(1);
    setSearchType("all");
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetDialog();
    }}>
      <DialogTrigger asChild>
        <Button className="w-[152px]" size="sm">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Add Repository
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[640px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Repository to Watch</DialogTitle>
            <DialogDescription>
              Search for a GitHub repository or enter owner/repo directly.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="repo">Repository</Label>
              <div className="flex gap-1 mb-2">
                <Button
                  type="button"
                  size="sm"
                  variant={searchType === "all" ? "default" : "outline"}
                  onClick={() => setSearchType("all")}
                >
                  All
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={searchType === "name" ? "default" : "outline"}
                  onClick={() => setSearchType("name")}
                >
                  <BookMarked className="h-3 w-3 mr-1" aria-hidden="true" />
                  By Name
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={searchType === "owner" ? "default" : "outline"}
                  onClick={() => setSearchType("owner")}
                >
                  <User className="h-3 w-3 mr-1" aria-hidden="true" />
                  By Owner
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="repo"
                  placeholder={
                    searchType === "owner"
                      ? "Enter owner/org name (e.g., vercel)…"
                      : searchType === "name"
                      ? "Enter repository name…"
                      : "Search or use @owner (e.g., @vercel)…"
                  }
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedRepo(null);
                  }}
                  className="pl-9"
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />
                )}
              </div>
              <div
                ref={resultsContainerRef}
                onScroll={handleScroll}
                className="h-[200px] rounded-md border bg-popover overflow-y-auto"
              >
                {isSearching ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 mb-2 animate-spin opacity-50" aria-hidden="true" />
                    <p className="text-sm">Searching…</p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <Search className="h-8 w-8 mb-2 opacity-50" aria-hidden="true" />
                    <p className="text-sm">Type to search repositories…</p>
                  </div>
                ) : (
                  <>
                    {searchResults.map((repo) => {
                      const isSelected = selectedRepo?.id === repo.id;
                      return (
                        <button
                          key={repo.id}
                          type="button"
                          className={`flex w-full items-start gap-3 p-3 text-left transition-colors border-b last:border-b-0 ${
                            isSelected
                              ? "bg-primary/5 ring-1 ring-inset ring-primary/20"
                              : "hover:bg-accent"
                          }`}
                          onClick={() => selectRepo(repo)}
                        >
                          <img
                            src={repo.owner.avatar_url}
                            alt=""
                            aria-hidden="true"
                            width={32}
                            height={32}
                            className="h-8 w-8 rounded-full shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{repo.full_name}</div>
                            {repo.description && (
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {repo.description}
                              </div>
                            )}
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Star className="h-3 w-3" aria-hidden="true" />
                                {repo.stargazers_count.toLocaleString()}
                              </span>
                              {repo.language && <span>{repo.language}</span>}
                            </div>
                          </div>
                          {isSelected && (
                            <Check className="h-5 w-5 shrink-0 text-green-600 mt-0.5" aria-hidden="true" />
                          )}
                        </button>
                      );
                    })}
                    {isLoadingMore && (
                      <div className="flex items-center justify-center p-3">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
                        <span className="ml-2 text-sm text-muted-foreground">Loading more…</span>
                      </div>
                    )}
                  </>
                )}
              </div>
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
            <div className="grid gap-2">
              <Label htmlFor="titleQuery">Filter by title</Label>
              <Input
                id="titleQuery"
                placeholder="e.g. memory leak"
                value={titleQuery}
                onChange={(e) => setTitleQuery(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                Only issues whose title contains this text will be tracked
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Adding…" : "Add Repository"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
