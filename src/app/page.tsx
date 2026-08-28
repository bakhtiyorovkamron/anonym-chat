import Link from "next/link";
import { ShieldCheck, UserRoundSearch, Lock, MessageCircleHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    title: "Без настоящего имени",
    text: "Твоя реальная личность остаётся отдельно.",
    icon: Lock,
  },
  {
    title: "Новые люди",
    text: "Находи людей по интересам и настроению.",
    icon: UserRoundSearch,
  },
  {
    title: "Приватные разговоры",
    text: "Общайся один на один в реальном времени.",
    icon: MessageCircleHeart,
  },
  {
    title: "Ты контролируешь разговор",
    text: "В любой момент можно выйти, заблокировать или пожаловаться.",
    icon: ShieldCheck,
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-10 sm:px-8">
      <section className="rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-8 sm:p-12">
        <Badge className="mb-4">18+ only</Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Будь кем угодно. Никто не обязан знать, кто ты.</h1>
        <p className="mt-5 max-w-2xl text-zinc-300">
          Поговори с кем-нибудь, не раскрывая себя. Анонимные знакомства и разговоры с людьми, которых ты никогда раньше не встречал.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/onboarding">
            <Button size="lg">Начать анонимно</Button>
          </Link>
          <Link href="/onboarding">
            <Button size="lg" variant="secondary">
              Начать
            </Button>
          </Link>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card key={feature.title}>
              <Icon className="mb-3 h-6 w-6 text-violet-300" />
              <h2 className="text-lg font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm text-zinc-400">{feature.text}</p>
            </Card>
          );
        })}
      </section>
    </main>
  );
}
