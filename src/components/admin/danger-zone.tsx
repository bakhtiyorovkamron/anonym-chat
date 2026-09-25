"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { getCsrfTokenFromCookie } from "@/lib/utils";

const PHRASE = "УДАЛИТЬ ВСЁ";

export function DangerZone() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [pending, startTransition] = useTransition();

  const reset = () => {
    startTransition(async () => {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": getCsrfTokenFromCookie() },
        body: JSON.stringify({ confirm: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult(data.error || "Ошибка сброса");
        return;
      }
      const d = data.deleted;
      setResult(
        `Удалено: пользователей ${d.users}, чатов ${d.matches}, сообщений ${d.messages}, жалоб ${d.reports}.`,
      );
      setText("");
      setOpen(false);
      setTimeout(() => window.location.reload(), 1500);
    });
  };

  return (
    <section className="mt-10 rounded-2xl border border-red-900/60 bg-red-950/20 p-4">
      <h2 className="text-lg font-semibold text-red-400">⚠️ Опасная зона</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Полный сброс: удаляет всех пользователей, профили, чаты, сообщения, жалобы и блокировки. GIF-ки остаются.
        Действие необратимо.
      </p>

      {!open ? (
        <Button className="mt-3" size="sm" variant="danger" onClick={() => setOpen(true)}>
          Сбросить всё
        </Button>
      ) : (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Введи: ${PHRASE}`}
            className="w-full rounded-lg border border-red-900 bg-zinc-900 px-3 py-2 text-sm sm:w-64"
          />
          <Button size="sm" variant="danger" disabled={pending || text !== PHRASE} onClick={reset}>
            {pending ? "Удаляем…" : "Подтвердить сброс"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setOpen(false);
              setText("");
            }}
          >
            Отмена
          </Button>
        </div>
      )}
      {result ? <p className="mt-2 text-sm text-zinc-300">{result}</p> : null}
    </section>
  );
}
