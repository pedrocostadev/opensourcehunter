"use client";

import { signIn } from "next-auth/react";
import { Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignInPage() {
  return (
    <div className="min-h-svh flex items-start sm:items-center justify-center bg-background px-4 pt-24 sm:pt-0">
      <Card className="w-full max-w-sm border-0 shadow-none sm:border sm:shadow-sm">
        <CardHeader className="text-center px-2 sm:px-6">
          <div className="flex justify-center mb-4">
            <Github className="h-10 w-10 sm:h-12 sm:w-12" />
          </div>
          <CardTitle className="text-xl sm:text-2xl">Sign in to OpenSourceHunter</CardTitle>
          <CardDescription>
            Connect your GitHub account to start tracking issues and generating PRs
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
          >
            <Github className="h-5 w-5" />
            Continue with GitHub
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-4">
            We&apos;ll request access to your repositories to track issues and create PRs.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
