"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCsrfTokenFromCookie } from "@/lib/utils";
import { getSocket } from "@/lib/socket-client";

type Proposal = {
  id: string;
  status: "ACTIVE" | "ENDED";
  confirmed: boolean;
  meAccepted: boolean;
  partnerAccepted: boolean;
  expiresAt: number;
  partner: { nickname: string; age: number | null; mode: string | null; interests: string[] };
};

export default function MatchPage() {
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Matchmaking only considers users with an open socket (online = true).
  // Without this, a user who opened /match directly is invisible to others.
  useEffect(() => {
    getSocket();
  }, []);

  // Resume a pending proposal after reload.
  useEffect(() => {
    fetch("/api/matchmaking/current")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.matchId) setProposalId(data.matchId);
      })
      .catch(() => {});
  }, []);

  // Poll proposal state until both confirm or someone declines.
  useEffect(() => {
    if (!proposalId) return;
    let timer: NodeJS.Timeout | null = null;
    let active = true;

    const poll = async () => {
      const response = await fetch(`/api/matches/${proposalId}/accept`);
      const data: Proposal | null = await response.json().catch(() => null);
      if (!active) return;

      if (!response.ok || !data) {
        setProposalId(null);
        setProposal(null);
        return;
      }
      if (data.confirmed && data.status === "ACTIVE") {
        router.push(`/chat/${data.id}`);
        return;
      }
      if (data.status === "ENDED") {
        setProposalId(null);
        setProposal(null);
        setStatusText(data.meAccepted ? "😔 Собеседник отказался или не ответил" : "Предложение отменено");
        return;
      }
      setProposal(data);
      timer = setTimeout(poll, 1500);
    };

    poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [proposalId, router]);

  useEffect(() => {
    if (!proposal) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [proposal]);

  const accept = async () => {
    if (!proposalId) return;
    const response = await fetch(`/api/matches/${proposalId}/accept`, {
      method: "POST",
      headers: { "x-csrf-token": getCsrfTokenFromCookie() },
    });
    const data: Proposal | null = await response.json().catch(() => null);
    if (data?.confirmed && data.status === "ACTIVE") router.push(`/chat/${data.id}`);
    else if (data) setProposal(data);
  };

  const decline = async () => {
    if (!proposalId) return;
    await fetch(`/api/matches/${proposalId}/end`, {
      method: "POST",
      headers: { "x-csrf-token": getCsrfTokenFromCookie() },
    });
    setProposalId(null);
    setProposal(null);
    setStatusText("Ты отказался. Можно искать дальше.");
  };

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    const poll = async () => {
      const response = await fetch("/api/matchmaking/start", {
        method: "POST",
        headers: { "x-csrf-token": getCsrfTokenFromCookie() },
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Ошибка поиска.");
        setSearching(false);
        return;
      }

      if (data.matchId) {
        setSearching(false);
        setStatusText("");
        setProposalId(data.matchId);
        return;
      }

      setStatusText("🔎 Ищем тебе собеседника…");
      timer = setTimeout(poll, 2000);
    };

    if (searching) {
      poll();
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [searching]);

  const cancel = async () => {
    await fetch("/api/matchmaking/cancel", {
      method: "POST",
      headers: { "x-csrf-token": getCsrfTokenFromCookie() },
    });
    setSearching(false);
    setStatusText("Поиск остановлен");
  };

  if (proposalId && proposal) {
    const secondsLeft = Math.max(0, Math.ceil((proposal.expiresAt - now) / 1000));
    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-xl items-center px-3 py-6 sm:px-4">
        <Card className="w-full text-center">
          <p className="text-sm text-violet-200">🎉 Собеседник найден</p>
          <h1 className="mt-3 break-words text-2xl font-semibold sm:text-3xl">{proposal.partner.nickname}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {proposal.partner.age ? `${proposal.partner.age} лет` : null}
            {proposal.partner.mode ? ` · ${proposal.partner.mode}` : null}
          </p>
          {proposal.partner.interests.length ? (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {proposal.partner.interests.map((interest) => (
                <span key={interest} className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                  {interest}
                </span>
              ))}
            </div>
          ) : null}
          <p className="mt-5 text-sm text-zinc-400">
            {proposal.meAccepted
              ? "⏳ Ждём подтверждения собеседника…"
              : proposal.partnerAccepted
                ? "✅ Собеседник уже согласен. Начать чат?"
                : "Начать чат с этим собеседником?"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Осталось {secondsLeft} с</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            {!proposal.meAccepted ? (
              <Button size="lg" className="w-full sm:w-auto" onClick={accept}>
                Начать чат
              </Button>
            ) : null}
            <Button variant="secondary" size="lg" className="w-full sm:w-auto" onClick={decline}>
              {proposal.meAccepted ? "Отменить" : "Отказаться"}
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-xl items-center px-3 py-6 sm:px-4">
      <Card className="w-full text-center">
        <h1 className="text-xl font-semibold sm:text-2xl">Что ты хочешь сейчас?</h1>
        <p className="mt-2 text-sm text-zinc-400 sm:text-base">Выбери собеседника по интересам и настроению.</p>
        <div className="mt-6 flex justify-center gap-3">
          {!searching ? (
            <Button
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => {
                setError("");
                setStatusText("🔎 Ищем тебе собеседника…");
                setSearching(true);
              }}
            >
              Найти собеседника
            </Button>
          ) : (
            <Button variant="secondary" size="lg" className="w-full sm:w-auto" onClick={cancel}>
              Отменить поиск
            </Button>
          )}
        </div>
        {statusText ? <p className="mt-4 text-sm text-violet-200">{statusText}</p> : null}
        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
        {!searching && !statusText ? (
          <p className="mt-6 text-sm text-zinc-500">Пока никого нет рядом? Попробуем найти кого-нибудь ещё.</p>
        ) : null}
      </Card>
    </main>
  );
}
