import { Button } from "@/components/ui/button";
import { ArrowRight, Github, CheckCircle } from "lucide-react";
import Link from "next/link";

const principles = [
  "Reliability-first AI behavior",
  "Evidence and citations where applicable",
  "Strict refusal when uncertainty is high",
  "Guardrails (security + privacy)",
  "Automated evaluation and regression testing",
  "Human-in-the-loop decision making",
];

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <h1 className="text-4xl font-bold tracking-tight mb-12">About</h1>

        {/* Section 1: Career Context */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            Career Context
          </h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              I'm a Senior Software Engineer with over a decade of experience 
              working across quality engineering, automation, DevOps, and platform 
              reliability. I started my career focused on how systems fail — not 
              just how they succeed — which shaped how I approach software 
              engineering today.
            </p>
            <p>
              Over time, my work expanded from test automation into system-level 
              validation, CI/CD pipelines, and cloud-based platforms. This 
              background gave me a deep appreciation for reliability, observability, 
              and the importance of understanding failure modes in distributed systems.
            </p>
          </div>
        </section>

        {/* Section 2: How I Think About AI */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            How I Think About AI
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            As AI systems became part of everyday engineering workflows, I noticed 
            a gap: many AI solutions focused on capability, but very few focused on 
            reliability, evaluation, or operational safety. This portfolio exists 
            to explore that gap.
          </p>
        </section>

        {/* Section 3: What This Portfolio Represents */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            What This Portfolio Represents
          </h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              The projects here are not demos. They are applied AI systems designed 
              for real engineering environments — with strict evaluation, clear 
              refusal paths, security controls, and human-in-the-loop decision-making. 
              I believe AI should support engineers, not replace judgment, and that 
              production AI systems should be explainable, observable, and safe by default.
            </p>
            <p>
              This portfolio reflects how I think about AI: as a system that must 
              earn trust through evidence, not assumptions.
            </p>
          </div>

          {/* Principles List */}
          <ul className="mt-8 space-y-3">
            {principles.map((principle, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <span className="text-muted-foreground">{principle}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <div className="pt-8 border-t border-border">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Button asChild>
              <Link href="/demo">
                Explore the Demos
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <a 
                href="https://github.com/SemePro/ai-engineering-portfolio" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Github className="mr-2 h-4 w-4" />
                View Code on GitHub
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
