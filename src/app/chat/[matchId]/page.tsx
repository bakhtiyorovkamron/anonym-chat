"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  const [ended, setEnded] = useState<EndedState>(null);
  const [stickers, setStickers] = useState<PickerSticker[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`/api/matches/${matchId}/messages`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Не удалось загрузить чат");
        return;
      }

      setMessages(data.messages);
      setMatch(data.match);
      if (data.match?.status === "ENDED") setEnded((prev) => prev ?? "partner");
    };

    load();
  }, [matchId]);

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

  const send = () => {
    if (ended) return;
    setError("");
    const socket = getSocket();
    socket.emit("send_message", { matchId, text: input }, (response: { error?: string }) => {
      if (response?.error) {
        if (response.error === "Match is not active.") {
          setEnded((prev) => prev ?? "partner");
          return;
        }
        setError(response.error);
        return;
      }
      setInput("");
      setTyping(false);
    });
  };

  const endChat = async () => {
    setEnded("self");
    await fetch(`/api/matches/${matchId}/end`, {
      method: "POST",
      headers: { "x-csrf-token": getCsrfTokenFromCookie() },
    });
    router.push("/match");
  };

  const block = async () => {
    if (!match?.partner.id) return;
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
  };

  const sorted = useMemo(
    () => [...messages].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    [messages],
  );

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
      if (response?.error) {
        if (response.error === "Match is not active.") {
          setEnded((prev) => prev ?? "partner");
          return;
        }
        setError(response.error);
        return;
      }
      setPickerOpen(false);
    });
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-3 py-4 sm:px-6">
      <Card className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            {match?.partner.nickname ?? "Anonymous"}, {match?.partner.age ?? "?"} 🎭 {match?.partner.mode}
          </h1>
          <p className="text-xs text-zinc-400">
            {ended ? "⛔ Чат завершён" : match?.partner.online ? "🟢 Online" : "⚪ Offline"}
          </p>
        </div>
        {!ended ? (
          <div className="flex gap-2">
            <Button variant="danger" size="sm" onClick={block}>
              Заблокировать
            </Button>
            <Button variant="secondary" size="sm" onClick={endChat}>
              Завершить чат
            </Button>
          </div>
        ) : null}
      </Card>

      {ended && ended !== "self" ? (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <p className="font-medium">
            {ended === "blocked" ? "Собеседник завершил чат и заблокировал тебя." : "Собеседник завершил чат."}
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            Отправлять сообщения больше нельзя. Можно пожаловаться ниже или найти нового собеседника.
          </p>
          <Button className="mt-3" onClick={() => router.push("/match")}>
            Найти нового собеседника
          </Button>
        </Card>
      ) : null}

      <Card className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3">
          {sorted.length === 0 ? <p className="text-sm text-zinc-500">Начните разговор первым.</p> : null}
          {sorted.map((msg) => {
            const isMine = msg.senderId === match?.me.id;
            const senderName = isMine
              ? `${match?.me.nickname ?? "Ты"} (ты)`
              : match?.partner.nickname ?? "Собеседник";

            return (
              <div key={msg.id} className={`flex max-w-[80%] flex-col ${isMine ? "self-end items-end" : "self-start items-start"}`}>
                <span className={`mb-1 px-1 text-xs font-medium ${isMine ? "text-violet-300" : "text-emerald-300"}`}>
                  {senderName}
                </span>
                <div className={`rounded-xl p-3 text-sm ${isMine ? "bg-violet-600/30" : "bg-zinc-800"}`}>
                  {msg.deletedAt ? (
                    <p>Сообщение удалено</p>
                  ) : msg.type === "STICKER" ? (
                    msg.sticker ? (
                      <GifMedia
                        url={msg.sticker.url}
                        name={msg.sticker.name}
                        mimeType={msg.sticker.mimeType}
                        className="h-32 w-32 rounded-lg object-contain"
                      />
                    ) : (
                      <p className="italic text-zinc-400">GIF удалён</p>
                    )
                  ) : (
                    <p className="break-words">{msg.text}</p>
                  )}
                  <div className="mt-1 flex gap-2 text-[11px] text-zinc-500">
                    <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                    {msg.replyToId ? <span>reply</span> : null}
                    {isMine && !msg.deletedAt ? (
                      <button
                        onClick={async () => {
                          await fetch(`/api/messages/${msg.id}`, {
                            method: "DELETE",
                            headers: { "x-csrf-token": getCsrfTokenFromCookie() },
                          });
                          setMessages((prev) => prev.map((item) => (item.id === msg.id ? { ...item, deletedAt: new Date().toISOString() } : item)));
                        }}
                        className="text-zinc-400 underline"
                      >
                        удалить
                      </button>
                    ) : null}
                    {!msg.deletedAt && msg.type !== "STICKER" ? (
                      <button onClick={() => navigator.clipboard.writeText(msg.text)} className="text-zinc-400 underline">
                        копировать
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {partnerTyping && !ended ? <p className="text-xs text-zinc-400">Собеседник печатает…</p> : null}

      <Card>
        {pickerOpen && !ended ? (
          <div className="mb-3 max-h-64 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-2">
            {stickers === null ? <p className="p-2 text-sm text-zinc-500">Загрузка…</p> : null}
            {stickers?.length === 0 ? <p className="p-2 text-sm text-zinc-500">GIF пока нет.</p> : null}
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {stickers?.map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  title={sticker.name}
                  onClick={() => sendSticker(sticker.id)}
                  className="flex aspect-square items-center justify-center rounded-lg p-1 hover:bg-zinc-800"
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
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={togglePicker}
            disabled={Boolean(ended)}
            aria-label="GIF"
            title="GIF"
          >
            GIF
          </Button>
          <Input
            value={input}
            maxLength={500}
            disabled={Boolean(ended)}
            onChange={(event) => {
              setInput(event.target.value);
              setTyping(event.target.value.length > 0);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            placeholder={ended ? "Чат завершён" : "Напиши сообщение"}
          />
          <Button onClick={send} disabled={Boolean(ended)}>
            Отправить
          </Button>
        </div>
        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      </Card>

      <Card>
        <h2 className="text-sm font-medium">Пожаловаться</h2>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="h-10 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm">
            <option value="SPAM">Spam</option>
            <option value="HARASSMENT">Harassment</option>
            <option value="SEXUAL_HARASSMENT">Sexual harassment</option>
            <option value="SCAM">Scam</option>
            <option value="THREATS">Threats</option>
            <option value="PERSONAL_INFORMATION">Personal information</option>
            <option value="SUSPECTED_MINOR">Suspected minor</option>
            <option value="OTHER">Other</option>
          </select>
          <Button onClick={report}>Отправить Report</Button>
        </div>
        <Textarea value={reportText} onChange={(e) => setReportText(e.target.value)} placeholder="Описание (optional)" className="mt-2" />
      </Card>
    </main>
  );
}
