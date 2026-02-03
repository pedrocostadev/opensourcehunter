import Link from "next/link";
import { Github, Zap, Bell, GitPullRequest } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/navbar";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container">
        {/* Hero Section */}
        <section className="py-20 md:py-32 text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Hunt Open Source Issues.
            <br />
            <span className="text-primary">Ship PRs Faster.</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Track your favorite open source projects, get notified instantly
            when new issues appear, and let AI generate draft PRs for you.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/api/auth/signin">
              <Button size="lg" className="gap-2">
                <Github className="h-5 w-5" />
                Get Started with GitHub
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline">
                View Dashboard
              </Button>
            </Link>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 border-t">
          <h2 className="text-3xl font-bold text-center mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Github className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Watch Repositories</h3>
              <p className="text-muted-foreground">
                Add your favorite open source projects and configure filters
                for the types of issues you want to work on.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Bell className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Real-time Notifications</h3>
              <p className="text-muted-foreground">
                Get instant notifications via webhooks when new issues are
                created that match your criteria.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <GitPullRequest className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">AI-Powered PRs</h3>
              <p className="text-muted-foreground">
                Copilot automatically generates draft PRs for new issues.
                Review the code and publish when ready.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 border-t text-center">
          <div className="bg-primary/5 rounded-2xl p-12">
            <Zap className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-4">
              Ready to contribute to open source?
            </h2>
            <p className="text-muted-foreground mb-6">
              Sign in with GitHub to start tracking issues and generating PRs.
            </p>
            <Link href="/api/auth/signin">
              <Button size="lg" className="gap-2">
                <Github className="h-5 w-5" />
                Sign in with GitHub
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container text-center text-muted-foreground">
          <p>Built with Next.js, Tailwind CSS, and GitHub Copilot</p>
        </div>
      </footer>
    </div>
  );
}
