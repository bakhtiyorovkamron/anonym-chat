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
      <nav className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link href="/admin/users" className="rounded-lg bg-violet-600 px-3 py-2 text-white hover:bg-violet-500">
          👥 Пользователи
        </Link>
        <Link href="/admin/chats" className="rounded-lg bg-violet-600 px-3 py-2 text-white hover:bg-violet-500">
          👀 Чаты
        </Link>
      </nav>
      <section className="mt-4 grid grid-cols-2 gap-2 text-sm sm:mt-6 sm:grid-cols-3 sm:gap-3 sm:text-base lg:grid-cols-6">
        <Link href="/admin/users"><Card className="h-full hover:border-violet-500">Users: {users}</Card></Link>
        <Link href="/admin/users?filter=online"><Card className="h-full hover:border-violet-500">Online: {onlineUsers}</Card></Link>
        <Link href="/admin/chats"><Card className="h-full hover:border-violet-500">Active chats: {activeChats}</Card></Link>
        <Card>Messages: {messages}</Card>
        <Card>Reports: {reports}</Card>
        <Link href="/admin/users?filter=banned"><Card className="h-full hover:border-violet-500">Blocked users: {blockedUsers}</Card></Link>
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
