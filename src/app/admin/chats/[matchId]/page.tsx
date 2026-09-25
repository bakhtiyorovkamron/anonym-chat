import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdminCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stickerUrl } from "@/lib/sticker-storage";
import { Card } from "@/components/ui/card";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { BanActions } from "@/components/admin/admin-actions";
import { GifMedia } from "@/components/ui/gif-media";

export const dynamic = "force-dynamic";

const userInclude = {
  select: {
    id: true,
    anonymousId: true,
    online: true,
    banned: true,
    personas: { where: { active: true }, take: 1, select: { nickname: true, age: true, mode: true } },
  },
} as const;

export default async function AdminChatViewPage({ params }: { params: Promise<{ matchId: string }> }) {
  if (!(await isAdminCookie())) redirect("/admin/login");

  const { matchId } = await params;
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      userA: userInclude,
      userB: userInclude,
      messages: {
        orderBy: { createdAt: "asc" },
        take: 500,
        include: { sticker: { select: { fileName: true, name: true, mimeType: true } } },
      },
    },
  });
  if (!match) notFound();

  const users = [match.userA, match.userB];
  const nameOf = (id: string) => {
    const u = id === match.userAId ? match.userA : match.userB;
    return u.personas[0]?.nickname ?? u.anonymousId;
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col px-3 py-4 sm:px-4 sm:py-8">
      {match.status === "ACTIVE" ? <AutoRefresh intervalMs={3000} /> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">Просмотр чата</h1>
        <Link href="/admin/chats" className="text-sm text-violet-300 hover:underline">
          ← Все чаты
        </Link>
      </div>
      <p className="mt-1 text-sm text-zinc-400">
        {match.status === "ACTIVE" ? "🟢 Активен (обновляется автоматически)" : "⚫ Завершён"}
        {match.endedAt ? ` · завершён ${new Date(match.endedAt).toLocaleString()}` : ""}
      </p>

      <section className="mt-4 grid gap-2 sm:grid-cols-2">
        {users.map((u, i) => (
          <Card key={u.id}>
            <p className="text-sm font-medium">
              {i === 0 ? "A" : "B"}: {u.online ? "🟢" : "⚪"} {u.personas[0]?.nickname ?? "—"}
            </p>
            <p className="break-words text-xs text-zinc-400">
              {u.anonymousId}
              {u.personas[0] ? ` · ${u.personas[0].age} лет · ${u.personas[0].mode}` : ""}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Подтвердил: {(i === 0 ? match.acceptedA : match.acceptedB) ? "да" : "нет"}
            </p>
            <div className="mt-2">
              <BanActions userId={u.id} banned={u.banned} />
            </div>
          </Card>
        ))}
      </section>

      <section className="mt-4 space-y-2">
        {match.messages.length === 0 ? <p className="text-sm text-zinc-500">Сообщений нет.</p> : null}
        {match.messages.map((m) => {
          const isA = m.senderId === match.userAId;
          return (
            <div key={m.id} className={`flex ${isA ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  isA ? "bg-zinc-800" : "bg-violet-700/60"
                } ${m.deletedAt ? "opacity-50" : ""}`}
              >
                <p className="text-xs font-semibold text-zinc-300">{nameOf(m.senderId)}</p>
                {m.sticker ? (
                  <div className="mt-1 w-40">
                    <GifMedia
                      url={stickerUrl(m.sticker.fileName)}
                      name={m.sticker.name}
                      mimeType={m.sticker.mimeType}
                    />
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                )}
                <p className="mt-1 text-[10px] text-zinc-400">
                  {new Date(m.createdAt).toLocaleTimeString()}
                  {m.deletedAt ? " · удалено" : ""}
                </p>
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
