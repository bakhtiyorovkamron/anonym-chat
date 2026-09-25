-- AlterTable
ALTER TABLE "public"."Match" ADD COLUMN "acceptedA" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "acceptedB" BOOLEAN NOT NULL DEFAULT false;

-- Existing matches were already started, treat them as confirmed
UPDATE "public"."Match" SET "acceptedA" = true, "acceptedB" = true;
