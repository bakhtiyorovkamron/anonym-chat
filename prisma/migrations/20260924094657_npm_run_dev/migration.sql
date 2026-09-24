-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "public"."GenderPreference" AS ENUM ('MALE', 'FEMALE', 'ANY');

-- CreateEnum
CREATE TYPE "public"."Language" AS ENUM ('RUSSIAN', 'ENGLISH', 'UZBEK');

-- CreateEnum
CREATE TYPE "public"."Mode" AS ENUM ('TALK', 'DATE', 'FLIRT', 'ROLEPLAY', 'COMPANY');

-- CreateEnum
CREATE TYPE "public"."MatchStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "public"."ReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'SEXUAL_HARASSMENT', 'SCAM', 'THREATS', 'PERSONAL_INFORMATION', 'SUSPECTED_MINOR', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ReportStatus" AS ENUM ('PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "public"."AdminRole" AS ENUM ('MODERATOR', 'ADMIN');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "anonymousId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "online" BOOLEAN NOT NULL DEFAULT false,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "age" INTEGER,
    "gender" "public"."Gender" NOT NULL DEFAULT 'UNSPECIFIED',
    "preferredGender" "public"."GenderPreference" NOT NULL DEFAULT 'ANY',
    "language" "public"."Language" NOT NULL DEFAULT 'RUSSIAN',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Persona" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "interests" TEXT[],
    "mode" "public"."Mode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Match" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "status" "public"."MatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Message" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "replyToId" TEXT,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Block" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedUserId" TEXT NOT NULL,
    "matchId" TEXT,
    "reason" "public"."ReportReason" NOT NULL,
    "description" TEXT,
    "status" "public"."ReportStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Admin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."AdminRole" NOT NULL DEFAULT 'MODERATOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SearchQueue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" "public"."Mode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnonymousConnection" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnonymousConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_anonymousId_key" ON "public"."User"("anonymousId");

-- CreateIndex
CREATE INDEX "User_online_banned_language_idx" ON "public"."User"("online", "banned", "language");

-- CreateIndex
CREATE INDEX "User_lastSeenAt_idx" ON "public"."User"("lastSeenAt");

-- CreateIndex
CREATE INDEX "Persona_userId_active_idx" ON "public"."Persona"("userId", "active");

-- CreateIndex
CREATE INDEX "Match_userAId_status_idx" ON "public"."Match"("userAId", "status");

-- CreateIndex
CREATE INDEX "Match_userBId_status_idx" ON "public"."Match"("userBId", "status");

-- CreateIndex
CREATE INDEX "Match_status_createdAt_idx" ON "public"."Match"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Message_matchId_createdAt_idx" ON "public"."Message"("matchId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_createdAt_idx" ON "public"."Message"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "Block_blockedId_idx" ON "public"."Block"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "Block_blockerId_blockedId_key" ON "public"."Block"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "public"."Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Report_reportedUserId_createdAt_idx" ON "public"."Report"("reportedUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_reporterId_createdAt_idx" ON "public"."Report"("reporterId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_userId_key" ON "public"."Admin"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchQueue_userId_key" ON "public"."SearchQueue"("userId");

-- CreateIndex
CREATE INDEX "SearchQueue_updatedAt_idx" ON "public"."SearchQueue"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnonymousConnection_userAId_userBId_key" ON "public"."AnonymousConnection"("userAId", "userBId");

-- AddForeignKey
ALTER TABLE "public"."Persona" ADD CONSTRAINT "Persona_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Block" ADD CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Block" ADD CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Admin" ADD CONSTRAINT "Admin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SearchQueue" ADD CONSTRAINT "SearchQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
