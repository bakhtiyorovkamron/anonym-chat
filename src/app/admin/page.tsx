import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { BanActions, ReportStatusActions } from "@/components/admin/admin-actions";
import { StickerManager } from "@/components/admin/sticker-manager";

export default async function AdminPage() {
  const allowed = await isAdminCookie();
  if (!allowed) {
    redirect("/admin/login");
  }

  const [users, activeChats, messages, reports, blockedUsers, onlineUsers, recentReports] = await Promise.all([
    prisma.user.count(),
    prisma.match.count({ where: { status: "ACTIVE" } }),
    prisma.message.count(),
    prisma.report.count(),
    prisma.user.count({ where: { banned: true } }),
    prisma.user.count({ where: { online: true } }),
    prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        reporter: { select: { id: true, anonymousId: true } },
        reportedUser: { select: { id: true, anonymousId: true, banned: true } },
      },
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 sm:py-8">
      <h1 className="text-xl font-semibold sm:text-2xl">Admin panel</h1>
      <section className="mt-4 grid grid-cols-2 gap-2 text-sm sm:mt-6 sm:grid-cols-3 sm:gap-3 sm:text-base lg:grid-cols-6">
        <Card>Users: {users}</Card>
        <Card>Online: {onlineUsers}</Card>
        <Card>Active chats: {activeChats}</Card>
        <Card>Messages: {messages}</Card>
        <Card>Reports: {reports}</Card>
        <Card>Blocked users: {blockedUsers}</Card>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">Recent reports</h2>
        {recentReports.map((report) => (
          <Card key={report.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="min-w-0 break-words text-sm">
                <p>Reporter: {report.reporter.anonymousId}</p>
                <p>Reported: {report.reportedUser.anonymousId}</p>
                <p>Reason: {report.reason}</p>
                <p>Status: {report.status}</p>
                <p>Text: {report.description || "—"}</p>
                <p>{new Date(report.createdAt).toLocaleString()}</p>
              </div>
              <div className="space-y-2">
                <ReportStatusActions reportId={report.id} />
                <BanActions userId={report.reportedUser.id} banned={report.reportedUser.banned} />
              </div>
            </div>
          </Card>
        ))}
      </section>

      <StickerManager />
    </main>
  );
}
