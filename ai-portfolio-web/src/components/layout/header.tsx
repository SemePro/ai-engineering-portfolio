"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Github, Menu, X } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Incident Agent", href: "/projects/incident-agent" },
  { name: "Projects", href: "/projects" },
  { name: "Demos", href: "/demo" },
  { name: "Architecture", href: "/architecture" },
  { name: "Testing", href: "/testing" },
  { name: "About", href: "/about" },
  { name: "Contact", href: "/contact" },
];

import { PROFILE } from "@/lib/profile";

const GITHUB_URL = PROFILE.github;

function isActive(pathname: string, href: string) {
  if (href === "/projects" && pathname.startsWith("/projects/incident-agent")) return false;
  return pathname === href || pathname.startsWith(href + "/");
}

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileNavId = useId();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav
        className="container mx-auto flex h-16 items-center justify-between px-4"
        aria-label="Main"
      >
        <Link href="/" className="flex items-center space-x-3" aria-label="Home">
          <Image
            src="/logo.png"
            alt=""
            width={48}
            height={48}
            className="rounded-md"
          />
          <span className="hidden font-semibold sm:inline-block">
            {PROFILE.name}
            <span className="text-muted-foreground font-normal"> · AI Engineering</span>
          </span>
        </Link>

        <div className="hidden md:flex md:items-center md:space-x-6">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                isActive(pathname, item.href)
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              {item.name}
            </Link>
          ))}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary transition-colors"
            aria-label="GitHub repository (opens in new tab)"
          >
            <Github className="h-5 w-5" aria-hidden />
          </a>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-expanded={mobileMenuOpen}
          aria-controls={mobileNavId}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" aria-hidden />
          ) : (
            <Menu className="h-5 w-5" aria-hidden />
          )}
        </Button>
      </nav>

      {mobileMenuOpen && (
        <div
          id={mobileNavId}
          className="md:hidden border-t bg-background"
          role="region"
          aria-label="Mobile navigation"
        >
          <div className="container mx-auto px-4 py-4 space-y-3">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "block py-2 text-sm font-medium transition-colors",
                  isActive(pathname, item.href)
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 py-2 text-sm font-medium text-muted-foreground hover:text-primary"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Github className="h-5 w-5 shrink-0" aria-hidden />
              GitHub
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
