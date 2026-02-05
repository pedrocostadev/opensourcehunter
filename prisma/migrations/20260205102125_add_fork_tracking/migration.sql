-- AlterTable
ALTER TABLE "TrackedIssue" ADD COLUMN     "draftPrOwner" TEXT,
ADD COLUMN     "forkIssueNumber" INTEGER,
ADD COLUMN     "generatingAt" TIMESTAMP(3);
