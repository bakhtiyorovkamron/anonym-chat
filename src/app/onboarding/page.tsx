"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INTERESTS, LANGUAGE_OPTIONS, MODE_OPTIONS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCsrfTokenFromCookie } from "@/lib/utils";

const genders = [
  { value: "MALE", label: "Мужчина" },
  { value: "FEMALE", label: "Женщина" },
  { value: "OTHER", label: "Другое" },
  { value: "UNSPECIFIED", label: "Не указывать" },
] as const;

const preferred = [
  { value: "MALE", label: "Мужчины" },
  { value: "FEMALE", label: "Женщины" },
  { value: "ANY", label: "Любой" },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [age, setAge] = useState("18");
  const [gender, setGender] = useState("UNSPECIFIED");
  const [preferredGender, setPreferredGender] = useState("ANY");
  const [language, setLanguage] = useState("RUSSIAN");
  const [mode, setMode] = useState("TALK");
  const [interests, setInterests] = useState<string[]>(["Общение"]);
  const [adult, setAdult] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((item) => item !== interest) : [...prev, interest],
    );
  };

  const submit = async () => {
    setError("");
    if (!adult) {
      setError("Подтвердите, что вам исполнилось 18 лет.");
      return;
    }

    setLoading(true);

    const response = await fetch("/api/persona", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": getCsrfTokenFromCookie(),
      },
      body: JSON.stringify({
        nickname,
        age: Number(age),
        gender,
        preferredGender,
        language,
        interests,
        mode,
        isAdultConfirmed: adult,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Не удалось сохранить анкету.");
      setLoading(false);
      return;
    }

    router.push("/match");
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Card>
        <h1 className="text-2xl font-semibold">Создай анонимную маску</h1>
        <p className="mt-2 text-sm text-zinc-400">Минимум данных, максимум приватности.</p>

        <div className="mt-5 space-y-4">
          <label className="block text-sm">
            Псевдоним
            <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Luna" maxLength={24} className="mt-1" />
          </label>

          <label className="block text-sm">
            Возраст (18-99)
            <Input value={age} onChange={(e) => setAge(e.target.value)} type="number" min={18} max={99} className="mt-1" />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Пол
              <select value={gender} onChange={(e) => setGender(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3">
                {genders.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              Кого ищу
              <select value={preferredGender} onChange={(e) => setPreferredGender(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3">
                {preferred.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm">
            Язык
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3">
              {LANGUAGE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            Что ты хочешь сейчас?
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3">
              {MODE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <div>
            <p className="text-sm">Интересы</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {INTERESTS.map((interest) => (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggleInterest(interest)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    interests.includes(interest)
                      ? "border-violet-400 bg-violet-500/20 text-violet-100"
                      : "border-zinc-700 text-zinc-400"
                  }`}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="size-4" />
            Мне исполнилось 18 лет
          </label>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <Button disabled={loading} onClick={submit} className="w-full">
            {loading ? "Сохраняем..." : "Продолжить"}
          </Button>
        </div>
      </Card>
    </main>
  );
}
