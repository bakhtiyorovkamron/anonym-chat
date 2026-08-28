"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCsrfTokenFromCookie } from "@/lib/utils";

export default function MatchPage() {
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");

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
        setStatusText("🎉 Собеседник найден");
        router.push(`/chat/${data.matchId}`);
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
  }, [searching, router]);

  const cancel = async () => {
    await fetch("/api/matchmaking/cancel", {
      method: "POST",
      headers: { "x-csrf-token": getCsrfTokenFromCookie() },
    });
    setSearching(false);
    setStatusText("Поиск остановлен");
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4">
      <Card className="w-full text-center">
        <h1 className="text-2xl font-semibold">Что ты хочешь сейчас?</h1>
        <p className="mt-2 text-zinc-400">Выбери собеседника по интересам и настроению.</p>
        <div className="mt-6 flex justify-center gap-3">
          {!searching ? (
            <Button
              size="lg"
              onClick={() => {
                setError("");
                setStatusText("🔎 Ищем тебе собеседника…");
                setSearching(true);
              }}
            >
              Найти собеседника
            </Button>
          ) : (
            <Button variant="secondary" size="lg" onClick={cancel}>
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
