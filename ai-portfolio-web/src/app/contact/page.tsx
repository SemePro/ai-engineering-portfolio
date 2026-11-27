import type { Metadata } from "next";
import Link from "next/link";
import { ContactLinks } from "@/components/contact-links";
import { PROFILE } from "@/lib/profile";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Contact</h1>
        <p className="mt-4 text-muted-foreground">
          {PROFILE.name} · {PROFILE.title}. Open to Senior AI Engineer, Applied AI, AI Platform and agent engineering
          roles, remote or hybrid.
        </p>
        <ContactLinks className="mt-8" />
        <div className="mt-12 border-t pt-8 text-sm text-muted-foreground space-y-2">
          <p>Short on time? These three pages show the most:</p>
          <ul className="space-y-1">
            <li><Link href="/projects/incident-agent" className="text-primary hover:underline underline-offset-4">Incident Response Engine — case study</Link></li>
            <li><Link href="/projects/incident-agent/trace" className="text-primary hover:underline underline-offset-4">A recorded investigation, step by step</Link></li>
            <li><Link href="/projects/incident-agent/evals" className="text-primary hover:underline underline-offset-4">Evaluation results and methodology</Link></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
