"use client";

import { signIn } from "next-auth/react";
import { Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Github className="h-12 w-12" />
          </div>
          <CardTitle className="text-2xl">Sign in to OpenSourceHunter</CardTitle>
          <CardDescription>
            Connect your GitHub account to start tracking issues and generating PRs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
          >
            <Github className="h-5 w-5" />
            Continue with GitHub
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-4">
            We'll request access to your repositories to track issues and create PRs.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
