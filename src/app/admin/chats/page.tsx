import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { AutoRefresh } from "@/components/admin/auto-refresh";

export const dynamic = "force-dynamic";

const userInclude = {
  select: {
    anonymousId: true,
    online: true,
    personas: { where: { active: true }, take: 1, select: { nickname: true } },
  },
} as const;

export default async function AdminChatsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  if (!(await isAdminCookie())) redirect("/admin/login");

  const { status } = await searchParams;
  const showEnded = status === "ended";

  const matches = await prisma.match.findMany({
    where: { status: showEnded ? "ENDED" : "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      userA: userInclude,
      userB: userInclude,
      _count: { select: { messages: true } },
    },
  });

  const name = (u: (typeof matches)[number]["userA"]) => u.personas[0]?.nickname ?? u.anonymousId;

  return (
    <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 sm:py-8">
      <AutoRefresh intervalMs={5000} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">Чаты</h1>
        <Link href="/admin" className="text-sm text-violet-300 hover:underline">
          ← Админка
        </Link>
      </div>

      <div className="mt-4 flex gap-2 text-sm">
        <Link
          href="/admin/chats"
          className={`rounded-full px-3 py-1 ${!showEnded ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-300"}`}
        >
          Активные
        </Link>
        <Link
          href="/admin/chats?status=ended"
          className={`rounded-full px-3 py-1 ${showEnded ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-300"}`}
        >
          Завершённые
        </Link>
      </div>

      <section className="mt-4 space-y-2">
        {matches.length === 0 ? <p className="text-sm text-zinc-500">Нет чатов.</p> : null}
        {matches.map((m) => {
          const confirmed = m.acceptedA && m.acceptedB;
          return (
            <Link key={m.id} href={`/admin/chats/${m.id}`} className="block">
              <Card className="transition hover:border-violet-500">
                <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <p className="min-w-0 break-words font-medium">
                    {m.userA.online ? "🟢" : "⚪"} {name(m.userA)} ↔ {m.userB.online ? "🟢" : "⚪"} {name(m.userB)}
                  </p>
                  <p className="text-zinc-400">
                    {!confirmed && m.status === "ACTIVE" ? "⏳ ждёт подтверждения · " : ""}
                    {m._count.messages} сообщ. · {new Date(m.createdAt).toLocaleString()}
                  </p>
                </div>
              </Card>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
