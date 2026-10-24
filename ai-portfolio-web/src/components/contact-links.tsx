import { FileText, Github, Linkedin, Mail } from "lucide-react";
import { PROFILE } from "@/lib/profile";
import { cn } from "@/lib/utils";

/** Résumé / GitHub / LinkedIn / email. Links that are not configured are not rendered. */
export function ContactLinks({ className, size = "md" }: { className?: string; size?: "sm" | "md" }) {
  const links = [
    PROFILE.resume && { href: PROFILE.resume, label: "Résumé", icon: FileText, external: PROFILE.resume.startsWith("http") },
    { href: PROFILE.github, label: "GitHub", icon: Github, external: true },
    PROFILE.linkedin && { href: PROFILE.linkedin, label: "LinkedIn", icon: Linkedin, external: true },
    PROFILE.email && { href: `mailto:${PROFILE.email}`, label: "Email", icon: Mail, external: false },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Github; external: boolean }[];

  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {links.map(({ href, label, icon: Icon, external }) => (
        <li key={label}>
          <a
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className={cn(
              "inline-flex items-center gap-2 rounded-md border border-border hover:border-foreground/40 hover:bg-muted/40 transition-colors",
              size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
            {external && <span className="sr-only">(opens in new tab)</span>}
          </a>
        </li>
      ))}
    </ul>
  );
}
