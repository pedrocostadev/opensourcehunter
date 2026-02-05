import { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      authorization: {
        params: {
          scope: "read:user user:email repo",
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // Store GitHub username when user signs in
      if (account?.provider === "github" && profile) {
        const githubProfile = profile as { login?: string };
        if (githubProfile.login && user.id) {
          await prisma.user.update({
            where: { id: user.id },
            data: { githubUsername: githubProfile.login },
          }).catch(() => {
            // User may not exist yet on first sign in, adapter will create it
          });
        }
      }
      return true;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};
