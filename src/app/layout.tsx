import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import {
  ACCENT_COOKIE,
  MODE_COOKIE,
  MODE_SCRIPT,
  THEME_COLORS,
  parseAccent,
  parseMode,
} from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wasted",
  description: "Tus gastos e ingresos en segundos.",
  appleWebApp: { capable: true, title: "Wasted", statusBarStyle: "default" },
  icons: { apple: "/icons/180" },
};

export async function generateViewport(): Promise<Viewport> {
  // Barra de estado del color del fondo: fija si elegiste Claro u Oscuro.
  const mode = parseMode((await cookies()).get(MODE_COOKIE)?.value);
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    interactiveWidget: "resizes-content",
    themeColor:
      mode === "system"
        ? [
            { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
            { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
          ]
        : THEME_COLORS[mode],
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Acento y modo llegan en el primer HTML. data-theme lo pone solo MODE_SCRIPT,
  // antes de pintar: si React lo manejara, lo borraría al volver a renderizar.
  const jar = await cookies();
  const accent = parseAccent(jar.get(ACCENT_COOKIE)?.value);
  const mode = parseMode(jar.get(MODE_COOKIE)?.value);

  return (
    <html
      lang="es-CO"
      data-accent={accent}
      data-mode={mode}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: MODE_SCRIPT }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
