import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Providers } from "./providers";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: { default: "eSIM platform", template: "%s · eSIM platform" },
  description: "eSIM management for the company and its resellers.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#050a14" },
    { media: "(prefers-color-scheme: light)", color: "#f5f8fc" },
  ],
};

// Dark is the primary design (spec 7.1). A saved choice is applied before the
// first paint so there is no flash. Inline, so nothing is fetched (CSP 'self').
const themeScript = `try{var t=localStorage.getItem("esim-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" data-theme="dark" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
