-- CreateEnum
CREATE TYPE "public"."MessageType" AS ENUM ('TEXT', 'STICKER');

-- AlterTable
ALTER TABLE "public"."Message" ADD COLUMN     "stickerId" TEXT,
ADD COLUMN     "type" "public"."MessageType" NOT NULL DEFAULT 'TEXT',
ALTER COLUMN "text" SET DEFAULT '';

-- CreateTable
CREATE TABLE "public"."Sticker" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sticker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sticker_fileName_key" ON "public"."Sticker"("fileName");

-- CreateIndex
CREATE INDEX "Sticker_active_sortOrder_idx" ON "public"."Sticker"("active", "sortOrder");

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_stickerId_fkey" FOREIGN KEY ("stickerId") REFERENCES "public"."Sticker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
