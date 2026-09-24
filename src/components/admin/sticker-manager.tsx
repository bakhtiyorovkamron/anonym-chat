"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GifMedia } from "@/components/ui/gif-media";
import { getCsrfTokenFromCookie } from "@/lib/utils";

type AdminSticker = {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  active: boolean;
  sortOrder: number;
  uses: number;
};

async function fetchStickers(): Promise<AdminSticker[] | null> {
  const response = await fetch("/api/admin/stickers");
  if (!response.ok) return null;
  const data = await response.json().catch(() => ({}));
  return data.stickers ?? [];
}

export function StickerManager() {
  const [stickers, setStickers] = useState<AdminSticker[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const list = await fetchStickers();
    if (list) setStickers(list);
  }, []);

  useEffect(() => {
    let active = true;
    fetchStickers().then((list) => {
      if (active && list) setStickers(list);
    });
    return () => {
      active = false;
    };
  }, []);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setMessage("");
    setErrors([]);

    const form = new FormData();
    for (const file of Array.from(files)) form.append("files", file);

    const response = await fetch("/api/admin/stickers", {
      method: "POST",
      headers: { "x-csrf-token": getCsrfTokenFromCookie() },
      body: form,
    });
    const data = await response.json().catch(() => ({}));

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (data.created) setMessage(`Добавлено: ${data.created}`);
    setErrors(data.errors ?? (response.ok ? [] : [data.error ?? "Ошибка загрузки"]));
    load();
  };

  const patch = async (id: string, body: Partial<Pick<AdminSticker, "name" | "active" | "sortOrder">>) => {
    await fetch(`/api/admin/stickers/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-csrf-token": getCsrfTokenFromCookie() },
      body: JSON.stringify(body),
    });
    load();
  };

  const remove = async (sticker: AdminSticker) => {
    const warning = sticker.uses > 0 ? ` Он использован в ${sticker.uses} сообщ., там появится «GIF удалён».` : "";
    if (!window.confirm(`Удалить «${sticker.name}»?${warning} Чтобы просто скрыть, лучше выключить.`)) return;
    await fetch(`/api/admin/stickers/${sticker.id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": getCsrfTokenFromCookie() },
    });
    load();
  };

  // Swap with the neighbour, then store every sticker's position as its list index
  // so the order stays consistent even if older sortOrder values were uneven.
  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= stickers.length) return;
    const next = [...stickers];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setStickers(next);

    await Promise.all(
      next
        .map((sticker, position) => ({ sticker, position }))
        .filter(({ sticker, position }) => sticker.sortOrder !== position)
        .map(({ sticker, position }) =>
          fetch(`/api/admin/stickers/${sticker.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json", "x-csrf-token": getCsrfTokenFromCookie() },
            body: JSON.stringify({ sortOrder: position }),
          }),
        ),
    );
    load();
  };

  return (
    <section className="mt-8 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">GIF ({stickers.length})</h2>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/gif,video/mp4,.gif,.mp4"
            className="hidden"
            onChange={(event) => upload(event.target.files)}
          />
          <Button disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? "Загрузка…" : "Загрузить GIF"}
          </Button>
        </div>
      </div>
      <p className="text-xs text-zinc-500">GIF или MP4 (показывается как GIF, без звука), до 5 МБ. Можно выбрать сразу несколько файлов.</p>
      {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
      {errors.map((error) => (
        <p key={error} className="text-sm text-red-400">
          {error}
        </p>
      ))}

      {stickers.length === 0 ? <Card className="text-sm text-zinc-500">GIF пока нет.</Card> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stickers.map((sticker, index) => (
          <Card key={sticker.id} className={`space-y-2 ${sticker.active ? "" : "opacity-50"}`}>
            <div className="flex h-28 items-center justify-center rounded-xl bg-zinc-950">
              <GifMedia url={sticker.url} name={sticker.name} mimeType={sticker.mimeType} className="max-h-24 max-w-full object-contain" />
            </div>
            <Input
              defaultValue={sticker.name}
              maxLength={60}
              onBlur={(event) => {
                const name = event.target.value.trim();
                if (name && name !== sticker.name) patch(sticker.id, { name });
              }}
            />
            <p className="text-[11px] text-zinc-500">
              {sticker.mimeType.split("/")[1]?.toUpperCase()} · {Math.round(sticker.size / 1024)} КБ · отправлен {sticker.uses} раз
            </p>
            {sticker.mimeType !== "image/gif" && sticker.mimeType !== "video/mp4" ? (
              <p className="text-[11px] text-amber-400">Не GIF: в чате не показывается. Можно удалить.</p>
            ) : null}
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => move(index, -1)}>
                ←
              </Button>
              <Button size="sm" variant="ghost" disabled={index === stickers.length - 1} onClick={() => move(index, 1)}>
                →
              </Button>
              <Button size="sm" variant="secondary" onClick={() => patch(sticker.id, { active: !sticker.active })}>
                {sticker.active ? "Выключить" : "Включить"}
              </Button>
              <Button size="sm" variant="danger" onClick={() => remove(sticker)}>
                Удалить
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
