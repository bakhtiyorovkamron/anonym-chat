-- AlterEnum
ALTER TYPE "public"."MessageType" ADD VALUE 'IMAGE';

-- AlterTable
ALTER TABLE "public"."Message" ADD COLUMN "imageFile" TEXT;
