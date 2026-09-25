import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { isAdminCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { UserActions } from "@/components/admin/admin-actions";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "Все" },
  { key: "online", label: "Онлайн" },
  { key: "banned", label: "Забаненные" },
] as const;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; page?: string }>;
}) {
  if (!(await isAdminCookie())) redirect("/admin/login");

  const { filter = "all", q = "", page = "1" } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const pageSize = 50;
  const query = q.trim();

  const where: Prisma.UserWhereInput = {
    ...(filter === "online" ? { online: true } : {}),
    ...(filter === "banned" ? { banned: true } : {}),
    ...(query
      ? {
          OR: [
            { anonymousId: { contains: query, mode: "insensitive" } },
            { personas: { some: { nickname: { contains: query, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ online: "desc" }, { lastSeenAt: "desc" }],
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
      include: {
        personas: { where: { active: true }, take: 1 },
        _count: { select: { sentMessages: true, matchesA: true, matchesB: true, reportsAgainst: true } },
      },
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (params: Record<string, string>) => {
    const sp = new URLSearchParams({ filter, ...(query ? { q: query } : {}), ...params });
    return `/admin/users?${sp.toString()}`;
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">Пользователи ({total})</h1>
        <Link href="/admin" className="text-sm text-violet-300 hover:underline">
          ← Админка
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 text-sm">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={href({ filter: f.key })}
              className={`rounded-full px-3 py-1 ${
                filter === f.key ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-300"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <form action="/admin/users" className="flex gap-2">
          <input type="hidden" name="filter" value={filter} />
          <input
            name="q"
            defaultValue={query}
            placeholder="Никнейм или anon_id"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm sm:w-64"
          />
          <button className="rounded-lg bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700">Найти</button>
        </form>
      </div>

      <section className="mt-4 space-y-2">
        {users.length === 0 ? <p className="text-sm text-zinc-500">Никого не найдено.</p> : null}
        {users.map((u) => {
          const persona = u.personas[0];
          const chats = u._count.matchesA + u._count.matchesB;
          return (
            <Card key={u.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 break-words text-sm">
                  <p className="font-medium">
                    {u.online ? "🟢" : "⚪"} {persona?.nickname ?? "— без профиля —"}
                    {u.banned ? <span className="ml-2 text-red-400">забанен</span> : null}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {u.anonymousId}
                    {persona ? ` · ${persona.age} лет · ${persona.mode}` : ""}
                    {` · ${u.gender} · ищет ${u.preferredGender} · ${u.language}`}
                  </p>
                  {persona?.interests.length ? (
                    <p className="text-xs text-zinc-500">Интересы: {persona.interests.join(", ")}</p>
                  ) : null}
                  <p className="text-xs text-zinc-500">
                    Чатов: {chats} · Сообщений: {u._count.sentMessages} · Жалоб на него: {u._count.reportsAgainst}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Создан: {new Date(u.createdAt).toLocaleString()} · Был: {new Date(u.lastSeenAt).toLocaleString()}
                  </p>
                </div>
                <UserActions userId={u.id} banned={u.banned} />
              </div>
            </Card>
          );
        })}
      </section>

      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          {pageNum > 1 ? (
            <Link href={href({ page: String(pageNum - 1) })} className="text-violet-300">
              ← Назад
            </Link>
          ) : null}
          <span className="text-zinc-400">
            {pageNum} / {pages}
          </span>
          {pageNum < pages ? (
            <Link href={href({ page: String(pageNum + 1) })} className="text-violet-300">
              Вперёд →
            </Link>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
