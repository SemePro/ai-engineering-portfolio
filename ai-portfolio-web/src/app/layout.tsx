import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

const inter = Inter({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "Applied AI Engineering Portfolio",
  description:
    "Building reliable, evidence-driven AI systems for real engineering workflows.",
  openGraph: {
    title: "Applied AI Engineering Portfolio",
    description: "Building reliable, evidence-driven AI systems for real engineering workflows.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Applied AI Engineering Portfolio",
    description: "Building reliable, evidence-driven AI systems for real engineering workflows.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <div className="relative flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
