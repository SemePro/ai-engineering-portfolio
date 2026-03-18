"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { TESTING_NAV_ITEMS } from "@/lib/testing-nav";

export function TestingAreaNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "flex flex-wrap gap-2 border-b border-border pb-4 mb-10",
        className
      )}
      aria-label="Testing sections"
    >
      {TESTING_NAV_ITEMS.map(({ href, navLabel }) => {
        const active =
          href === "/testing"
            ? pathname === "/testing"
            : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {navLabel}
          </Link>
        );
      })}
    </nav>
  );
}
