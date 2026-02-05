-- AlterTable
ALTER TABLE "User" ADD COLUMN     "githubUsername" TEXT;

-- AlterTable
ALTER TABLE "WatchedRepo" ADD COLUMN     "forkOwner" TEXT,
ADD COLUMN     "isOwned" BOOLEAN NOT NULL DEFAULT false;
