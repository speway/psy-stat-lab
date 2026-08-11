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
  metadataBase: new URL("https://psy-stat-lab.vercel.app"),
  applicationName: "СтатЛаб",
  title: "СтатЛаб — статистика для психологов",
  description:
    "Интерактивный тренажёр: выбор статистического критерия, ANOVA, регрессия, психометрика, SPSS и практические задачи.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "СтатЛаб — статистика для психологов",
    description:
      "Интерактивный тренажёр по статистике: от выбора критерия и проверки гипотез до психометрики и чтения результатов SPSS.",
    url: "/",
    siteName: "СтатЛаб",
    locale: "ru_RU",
    type: "website",
    images: [
      {
        url: "/og-statlab-v3.png",
        width: 1200,
        height: 630,
        alt: "СтатЛаб — интерактивный тренажёр по статистике для психологов",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "СтатЛаб — статистика для психологов",
    description:
      "Критерии, модели, психометрика и практика — в одной интерактивной лаборатории.",
    images: ["/og-statlab-v3.png"],
  },
  other: {
    "codex-preview": "development",
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg?v=2", type: "image/svg+xml" },
      { url: "/favicon-32x32.png?v=2", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png?v=2", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.ico?v=2",
    apple: [{ url: "/apple-touch-icon.png?v=2", sizes: "180x180", type: "image/png" }],
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
