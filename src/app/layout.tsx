import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/providers/session-provider";

export const metadata: Metadata = {
  title: "Anonym Chat",
  description: "Анонимные знакомства и разговоры 18+",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full bg-zinc-950 text-zinc-100">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
