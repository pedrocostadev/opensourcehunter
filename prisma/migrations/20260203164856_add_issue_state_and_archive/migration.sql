-- AlterTable
ALTER TABLE "TrackedIssue" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "state" TEXT NOT NULL DEFAULT 'open';
