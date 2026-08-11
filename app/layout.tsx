import type { Metadata } from "next";
import { Manrope, PT_Serif } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["cyrillic", "latin"],
});

const ptSerif = PT_Serif({
  variable: "--font-pt-serif",
  subsets: ["cyrillic", "latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Статистическая лаборатория",
  description:
    "Интерактивный тренажёр статистики, математических методов и психодиагностики для студентов-психологов.",
  other: {
    "codex-preview": "development",
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className={`${manrope.variable} ${ptSerif.variable}`}>
        {children}
        <footer className="site-footer">
          <div className="footer-brand">
            <span aria-hidden="true">Σ</span>
            <strong>СТАТЛАБ</strong>
          </div>
          <p>
            <a
              href="https://psy-msutf.vercel.app/ru"
              target="_blank"
              rel="noreferrer"
            >
              Научный сектор психологии ТФ МГУ
            </a>
            <span aria-hidden="true"> · </span>
            <span>2026</span>
          </p>
          <a href="https://t.me/speway" target="_blank" rel="noreferrer">
            by spw ↗
          </a>
        </footer>
      </body>
    </html>
  );
}
