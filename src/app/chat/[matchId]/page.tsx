"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GifMedia } from "@/components/ui/gif-media";
import { getCsrfTokenFromCookie } from "@/lib/utils";

type ChatMessage = {
  id: string;
  senderId: string;
  type?: "TEXT" | "STICKER";
  text: string;
  sticker?: { url: string; name: string; mimeType?: string } | null;
  createdAt: string;
  deletedAt: string | null;
  replyToId: string | null;
};

type PickerSticker = { id: string; name: string; url: string; mimeType?: string };

type MatchMeta = {
  id: string;
  status: "ACTIVE" | "ENDED";
  me: {
    id: string;
    nickname: string;
  };
  partner: {
    id: string;
    nickname: string;
    age: number;
    mode: string;
    online: boolean;
  };
};

type EndedState = null | "self" | "partner" | "blocked";

const REPORT_REASONS = [
  { value: "SPAM", label: "Спам" },
  { value: "HARASSMENT", label: "Оскорбления" },
  { value: "SEXUAL_HARASSMENT", label: "Сексуальные домогательства" },
  { value: "SCAM", label: "Мошенничество" },
  { value: "THREATS", label: "Угрозы" },
  { value: "PERSONAL_INFORMATION", label: "Личные данные" },
  { value: "SUSPECTED_MINOR", label: "Похоже на несовершеннолетнего" },
  { value: "OTHER", label: "Другое" },
];

export default function ChatPage() {
  const params = useParams<{ matchId: string }>();
  const router = useRouter();
  const matchId = params.matchId;

  const [match, setMatch] = useState<MatchMeta | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [typing, setTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [reportReason, setReportReason] = useState("SPAM");
  const [reportText, setReportText] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [ended, setEnded] = useState<EndedState>(null);
  const [stickers, setStickers] = useState<PickerSticker[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`/api/matches/${matchId}/messages`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.pending) {
          router.replace("/match");
          return;
        }
        setError(data.error || "Не удалось загрузить чат");
        return;
      }

      setMessages(data.messages);
      setMatch(data.match);
      if (data.match?.status === "ENDED") setEnded((prev) => prev ?? "partner");
    };

    load();
  }, [matchId, router]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit("join_match", { matchId });

    const onMessage = (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    };

    const onTyping = (state: { typing: boolean }) => {
      setPartnerTyping(state.typing);
    };

    const onEnded = (payload: { matchId: string; reason: "ended" | "blocked" }) => {
      if (payload.matchId !== matchId) return;
      setPartnerTyping(false);
      setTyping(false);
      setError("");
      setPickerOpen(false);
      // If we ended it ourselves, state is already "self" and we're navigating away.
      setEnded((prev) => prev ?? (payload.reason === "blocked" ? "blocked" : "partner"));
    };

    socket.on("new_message", onMessage);
    socket.on("typing", onTyping);
    socket.on("match_ended", onEnded);

    return () => {
      socket.off("new_message", onMessage);
      socket.off("typing", onTyping);
      socket.off("match_ended", onEnded);
      socket.emit("typing", { matchId, typing: false });
    };
  }, [matchId]);

  useEffect(() => {
    if (ended) return;
    const socket = getSocket();
    socket.emit("typing", { matchId, typing });
  }, [typing, matchId, ended]);

  const sorted = useMemo(
    () => [...messages].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    [messages],
  );

  // Keep the newest message in view (also when the partner starts typing or the chat ends).
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [sorted.length, partnerTyping, ended]);

  const handleSendError = (response: { error?: string }) => {
    if (!response?.error) return false;
    if (response.error === "Match is not active.") {
      setEnded((prev) => prev ?? "partner");
    } else {
      setError(response.error);
    }
    return true;
  };

  const send = () => {
    if (ended || !input.trim()) return;
    setError("");
    const socket = getSocket();
    socket.emit("send_message", { matchId, text: input }, (response: { error?: string }) => {
      if (handleSendError(response)) return;
      setInput("");
      setTyping(false);
    });
  };

  const endChat = async () => {
    setMenuOpen(false);
    setEnded("self");
    await fetch(`/api/matches/${matchId}/end`, {
      method: "POST",
      headers: { "x-csrf-token": getCsrfTokenFromCookie() },
    });
    router.push("/match");
  };

  const block = async () => {
    if (!match?.partner.id) return;
    if (!window.confirm("Заблокировать собеседника? Вы больше не встретитесь.")) return;
    setMenuOpen(false);
    setEnded("self");
    await fetch("/api/block", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": getCsrfTokenFromCookie(),
      },
      body: JSON.stringify({ blockedUserId: match.partner.id, matchId }),
    });
    router.push("/match");
  };

  const report = async () => {
    if (!match?.partner.id) return;
    const response = await fetch("/api/report", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": getCsrfTokenFromCookie(),
      },
      body: JSON.stringify({ reportedUserId: match.partner.id, matchId, reason: reportReason, description: reportText }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error || "Не удалось отправить жалобу");
      return;
    }

    setReportText("");
    setReportSent(true);
  };

  const togglePicker = async () => {
    const next = !pickerOpen;
    setPickerOpen(next);
    if (next && stickers === null) {
      const response = await fetch("/api/stickers");
      const data = await response.json().catch(() => ({}));
      setStickers(response.ok ? (data.stickers ?? []) : []);
    }
  };

  const sendSticker = (stickerId: string) => {
    if (ended) return;
    setError("");
    const socket = getSocket();
    socket.emit("send_message", { matchId, stickerId }, (response: { error?: string }) => {
      if (handleSendError(response)) return;
      setPickerOpen(false);
    });
  };

  const deleteMessage = async (messageId: string) => {
    await fetch(`/api/messages/${messageId}`, {
      method: "DELETE",
      headers: { "x-csrf-token": getCsrfTokenFromCookie() },
    });
    setMessages((prev) => prev.map((item) => (item.id === messageId ? { ...item, deletedAt: new Date().toISOString() } : item)));
  };

  return (
    // 100dvh = visible viewport height on phones (excludes the browser toolbar / keyboard area).
    <main className="mx-auto flex h-[100dvh] w-full max-w-3xl flex-col sm:px-6 sm:py-4">
      {/* Header */}
      <header className="relative flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900/95 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:rounded-t-2xl sm:border sm:px-5 sm:py-3">
        <button
          type="button"
          onClick={() => router.push("/match")}
          className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-zinc-300 hover:bg-zinc-800 sm:hidden"
          aria-label="Назад"
        >
          ←
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold sm:text-lg">
            {match?.partner.nickname ?? "Anonymous"}, {match?.partner.age ?? "?"}
            <span className="ml-1 text-xs font-normal text-zinc-400">🎭 {match?.partner.mode}</span>
          </h1>
          <p className="truncate text-xs text-zinc-400">
            {ended ? "⛔ Чат завершён" : partnerTyping ? "печатает…" : match?.partner.online ? "🟢 Online" : "⚪ Offline"}
          </p>
        </div>

        {/* Desktop actions */}
        <div className="hidden shrink-0 gap-2 sm:flex">
          {!ended ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setReportOpen((v) => !v)}>
                Пожаловаться
              </Button>
              <Button variant="danger" size="sm" onClick={block}>
                Заблокировать
              </Button>
              <Button variant="secondary" size="sm" onClick={endChat}>
                Завершить
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setReportOpen((v) => !v)}>
              Пожаловаться
            </Button>
          )}
        </div>

        {/* Mobile menu */}
        <div className="shrink-0 sm:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-2xl leading-none text-zinc-300 hover:bg-zinc-800"
            aria-label="Меню"
            aria-expanded={menuOpen}
          >
            ⋯
          </button>
          {menuOpen ? (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-2 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl">
                <button
                  type="button"
                  className="block w-full px-4 py-3 text-left text-sm hover:bg-zinc-800"
                  onClick={() => {
                    setMenuOpen(false);
                    setReportOpen(true);
                  }}
                >
                  🚩 Пожаловаться
                </button>
                {!ended ? (
                  <>
                    <button type="button" className="block w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-zinc-800" onClick={block}>
                      ⛔ Заблокировать
                    </button>
                    <button type="button" className="block w-full px-4 py-3 text-left text-sm hover:bg-zinc-800" onClick={endChat}>
                      ✖ Завершить чат
                    </button>
                  </>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </header>

      {/* Report panel */}
      {reportOpen ? (
        <section className="shrink-0 border-b border-zinc-800 bg-zinc-900 px-3 py-3 sm:border-x sm:px-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Пожаловаться</h2>
            <button
              type="button"
              onClick={() => {
                setReportOpen(false);
                setReportSent(false);
              }}
              className="h-8 w-8 rounded-full text-zinc-400 hover:bg-zinc-800"
              aria-label="Закрыть"
            >
              ✕
            </button>
          </div>
          {reportSent ? (
            <p className="mt-2 text-sm text-emerald-400">Жалоба отправлена. Спасибо!</p>
          ) : (
            <>
              <select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="select-field mt-2">
                {REPORT_REASONS.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
              <Textarea
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="Описание (необязательно)"
                rows={2}
                maxLength={500}
                className="mt-2"
              />
              <Button onClick={report} className="mt-2 w-full sm:w-auto">
                Отправить жалобу
              </Button>
            </>
          )}
        </section>
      ) : null}

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:border-x sm:border-zinc-800 sm:bg-zinc-900/40 sm:px-5">
        <div className="flex flex-col gap-3">
          {sorted.length === 0 ? <p className="py-8 text-center text-sm text-zinc-500">Начните разговор первым.</p> : null}
          {sorted.map((msg) => {
            const isMine = msg.senderId === match?.me.id;
            const senderName = isMine
              ? `${match?.me.nickname ?? "Ты"} (ты)`
              : match?.partner.nickname ?? "Собеседник";
            const isGif = msg.type === "STICKER";

            return (
              <div key={msg.id} className={`flex max-w-[85%] flex-col sm:max-w-[75%] ${isMine ? "self-end items-end" : "self-start items-start"}`}>
                <span className={`mb-1 px-1 text-xs font-medium ${isMine ? "text-violet-300" : "text-emerald-300"}`}>
                  {senderName}
                </span>
                <div className={`rounded-2xl text-sm ${isGif && !msg.deletedAt ? "p-1.5" : "px-3 py-2"} ${isMine ? "bg-violet-600/30" : "bg-zinc-800"}`}>
                  {msg.deletedAt ? (
                    <p className="italic text-zinc-400">Сообщение удалено</p>
                  ) : isGif ? (
                    msg.sticker ? (
                      <GifMedia
                        url={msg.sticker.url}
                        name={msg.sticker.name}
                        mimeType={msg.sticker.mimeType}
                        className="h-36 w-36 rounded-xl object-contain sm:h-40 sm:w-40"
                      />
                    ) : (
                      <p className="italic text-zinc-400">GIF удалён</p>
                    )
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  )}
                  <div className={`mt-1 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500 ${isGif && !msg.deletedAt ? "px-1.5" : ""}`}>
                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    {isMine && !msg.deletedAt ? (
                      <button onClick={() => deleteMessage(msg.id)} className="py-1 text-zinc-400 underline">
                        удалить
                      </button>
                    ) : null}
                    {!msg.deletedAt && !isGif ? (
                      <button onClick={() => navigator.clipboard?.writeText(msg.text)} className="py-1 text-zinc-400 underline">
                        копировать
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}

          {ended && ended !== "self" ? (
            <div className="mx-auto mt-2 w-full max-w-md rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-center">
              <p className="font-medium">
                {ended === "blocked" ? "Собеседник завершил чат и заблокировал тебя." : "Собеседник завершил чат."}
              </p>
              <p className="mt-1 text-sm text-zinc-400">Отправлять сообщения больше нельзя.</p>
              <Button className="mt-3 w-full" onClick={() => router.push("/match")}>
                Найти нового собеседника
              </Button>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <footer className="shrink-0 border-t border-zinc-800 bg-zinc-900/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:rounded-b-2xl sm:border sm:px-5 sm:pb-3">
        {pickerOpen && !ended ? (
          <div className="mb-2 max-h-[40dvh] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-2">
            {stickers === null ? <p className="p-2 text-sm text-zinc-500">Загрузка…</p> : null}
            {stickers?.length === 0 ? <p className="p-2 text-sm text-zinc-500">GIF пока нет.</p> : null}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {stickers?.map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  title={sticker.name}
                  onClick={() => sendSticker(sticker.id)}
                  className="flex aspect-square items-center justify-center rounded-lg p-1 hover:bg-zinc-800 active:bg-zinc-800"
                >
                  <GifMedia
                    url={sticker.url}
                    name={sticker.name}
                    mimeType={sticker.mimeType}
                    className="pointer-events-none max-h-full max-w-full object-contain"
                  />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <p className="mb-2 text-sm text-red-400">{error}</p> : null}

        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <Button
            type="button"
            variant="secondary"
            onClick={togglePicker}
            disabled={Boolean(ended)}
            aria-label="GIF"
            title="GIF"
            className={`h-11 shrink-0 px-3 sm:h-10 ${pickerOpen ? "bg-violet-600/40" : ""}`}
          >
            GIF
          </Button>
          <Input
            value={input}
            maxLength={500}
            disabled={Boolean(ended)}
            enterKeyHint="send"
            autoComplete="off"
            onChange={(event) => {
              setInput(event.target.value);
              setTyping(event.target.value.length > 0);
            }}
            onFocus={() => setPickerOpen(false)}
            placeholder={ended ? "Чат завершён" : "Сообщение"}
            className="min-w-0 flex-1"
          />
          <Button type="submit" disabled={Boolean(ended) || !input.trim()} className="h-11 shrink-0 px-4 sm:h-10" aria-label="Отправить">
            <span className="sm:hidden">➤</span>
            <span className="hidden sm:inline">Отправить</span>
          </Button>
        </form>
      </footer>
    </main>
  );
}
