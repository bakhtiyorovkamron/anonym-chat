-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN "lastIp" TEXT,
ADD COLUMN "country" TEXT,
ADD COLUMN "countryCode" TEXT,
ADD COLUMN "city" TEXT;

-- CreateIndex
CREATE INDEX "User_lastIp_idx" ON "public"."User"("lastIp");
