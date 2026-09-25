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
		<main className="mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col px-3 py-4 sm:px-8 sm:py-10">
			<section className="rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-5 sm:p-12">
				<Badge className="mb-4">18+ only</Badge>
				<h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-5xl">
					Будь кем угодно. Никто не обязан знать, кто ты.
				</h1>
				<p className="mt-4 max-w-2xl text-sm text-zinc-300 sm:mt-5 sm:text-base">
					Поговори с кем-нибудь, не раскрывая себя. Анонимные знакомства и разговоры с людьми, которых ты никогда
					ранее не встречал.
				</p>
				<div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
					<Link href="/onboarding" className="w-full sm:w-auto">
						<Button size="lg" className="w-full">
							Начать анонимно
						</Button>
					</Link>
					<Link href="/onboarding" className="w-full sm:w-auto">
						<Button size="lg" variant="secondary" className="w-full">
							Начать
						</Button>
					</Link>
				</div>
			</section>

			<section className="mt-4 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4">
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
