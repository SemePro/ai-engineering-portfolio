import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

const inter = Inter({ subsets: ["latin"], variable: "--font-geist-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

const description =
  "Seme Semeglo — Senior AI Engineer building reliable agentic and production AI systems: tool-using agents, a secure AI gateway, and evaluation and failure-injection harnesses.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.semefit.com"),
  title: { default: "Seme Semeglo — Senior AI Engineer", template: "%s · Seme Semeglo" },
  description,
  openGraph: { title: "Seme Semeglo — Senior AI Engineer", description, type: "website", url: "https://www.semefit.com" },
  twitter: { card: "summary", title: "Seme Semeglo — Senior AI Engineer", description },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${mono.variable} font-sans antialiased`}>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring">
          Skip to content
        </a>
        <div className="relative flex min-h-screen flex-col">
          <Header />
          <main id="main" className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
