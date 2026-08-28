"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getCsrfTokenFromCookie } from "@/lib/utils";

type ChatMessage = {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
  deletedAt: string | null;
  replyToId: string | null;
};

type MatchMeta = {
  id: string;
  partner: {
    id: string;
    nickname: string;
    age: number;
    mode: string;
    online: boolean;
  };
};

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

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`/api/matches/${matchId}/messages`);
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Не удалось загрузить чат");
        return;
      }

      setMessages(data.messages);
      setMatch(data.match);
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

    socket.on("new_message", onMessage);
    socket.on("typing", onTyping);

    return () => {
      socket.off("new_message", onMessage);
      socket.off("typing", onTyping);
      socket.emit("typing", { matchId, typing: false });
    };
  }, [matchId]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit("typing", { matchId, typing });
  }, [typing, matchId]);

  const send = () => {
    setError("");
    const socket = getSocket();
    socket.emit("send_message", { matchId, text: input }, (response: { error?: string }) => {
      if (response?.error) {
        setError(response.error);
        return;
      }
      setInput("");
      setTyping(false);
    });
  };

  const endChat = async () => {
    await fetch(`/api/matches/${matchId}/end`, {
      method: "POST",
      headers: { "x-csrf-token": getCsrfTokenFromCookie() },
    });
    router.push("/match");
  };

  const block = async () => {
    if (!match?.partner.id) return;
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
      const data = await response.json();
      setError(data.error || "Не удалось отправить жалобу");
      return;
    }

    setReportText("");
  };

  const sorted = useMemo(
    () => [...messages].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    [messages],
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-3 py-4 sm:px-6">
      <Card className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            {match?.partner.nickname ?? "Anonymous"}, {match?.partner.age ?? "?"} 🎭 {match?.partner.mode}
          </h1>
          <p className="text-xs text-zinc-400">{match?.partner.online ? "🟢 Online" : "⚪ Offline"}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="danger" size="sm" onClick={block}>
            Заблокировать
          </Button>
          <Button variant="secondary" size="sm" onClick={endChat}>
            Завершить чат
          </Button>
        </div>
      </Card>

      <Card className="flex-1 overflow-y-auto">
        <div className="space-y-3">
          {sorted.length === 0 ? <p className="text-sm text-zinc-500">Начните разговор первым.</p> : null}
          {sorted.map((msg) => (
            <div key={msg.id} className="rounded-xl bg-zinc-800 p-3 text-sm">
              <p>{msg.deletedAt ? "Сообщение удалено" : msg.text}</p>
              <div className="mt-1 flex gap-2 text-[11px] text-zinc-500">
                <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                {msg.replyToId ? <span>reply</span> : null}
                {!msg.deletedAt ? (
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
                    delete own
                  </button>
                ) : null}
                <button onClick={() => navigator.clipboard.writeText(msg.text)} className="text-zinc-400 underline">
                  copy
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {partnerTyping ? <p className="text-xs text-zinc-400">Собеседник печатает…</p> : null}

      <Card>
        <div className="flex gap-2">
          <Input
            value={input}
            maxLength={500}
            onChange={(event) => {
              setInput(event.target.value);
              setTyping(event.target.value.length > 0);
            }}
            placeholder="Напиши сообщение"
          />
          <Button onClick={send}>Отправить</Button>
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
