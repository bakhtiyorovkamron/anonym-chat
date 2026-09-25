import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/providers/session-provider";

export const metadata: Metadata = {
  title: "Anonym Chat",
  description: "Анонимные знакомства и разговоры 18+",
};

// viewportFit=cover lets the layout use env(safe-area-inset-*) on phones with a notch / home bar.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09090b",
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
