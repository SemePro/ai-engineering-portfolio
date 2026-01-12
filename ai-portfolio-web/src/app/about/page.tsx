import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle, Github } from "lucide-react";
import Link from "next/link";

const principles = [
  {
    title: "Reliability-first AI behavior",
    description: "Systems that work correctly and predictably, with graceful degradation when things go wrong.",
  },
  {
    title: "Evidence and citations",
    description: "Every claim is grounded in retrieved evidence. No unsupported statements in production outputs.",
  },
  {
    title: "Strict refusal when uncertain",
    description: "When confidence is low or evidence is insufficient, the system refuses rather than guesses.",
  },
  {
    title: "Guardrails (security + privacy)",
    description: "Defense in depth with rate limiting, PII redaction, and prompt injection detection.",
  },
  {
    title: "Automated evaluation and regression testing",
    description: "Continuous quality gates that catch regressions before they reach production.",
  },
];

const skills = {
  "AI/ML": ["RAG Systems", "LLM Evaluation", "Prompt Engineering", "Vector Databases", "Embeddings"],
  "Backend": ["Python", "FastAPI", "Pydantic", "Async/Await", "REST APIs"],
  "Infrastructure": ["Docker", "GitHub Actions", "Railway", "Vercel", "CI/CD"],
  "Frontend": ["TypeScript", "Next.js", "React", "TailwindCSS"],
  "Testing": ["pytest", "Unit Testing", "Integration Testing", "Regression Testing"],
};

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold tracking-tight mb-4">About This Portfolio</h1>
          <p className="text-muted-foreground text-lg">
            Production-minded AI systems for real engineering workflows
          </p>
        </div>

        {/* Main Narrative */}
        <Card className="mb-12">
          <CardContent className="pt-6">
            <p className="text-lg leading-relaxed mb-6">
              This Applied AI Engineering Portfolio showcases systems I built to explore how AI should behave in production environments.
            </p>
            <p className="text-lg leading-relaxed mb-6">
              The focus is on reliability, explainability, evaluation, security, and human-in-the-loop design — not demos or prompt experiments.
            </p>
            <p className="text-lg leading-relaxed">
              Each project reflects real engineering workflows such as incident response, DevOps risk analysis, and automated quality validation.
            </p>
          </CardContent>
        </Card>

        {/* Core Principles */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Core Principles</h2>
          <div className="space-y-4">
            {principles.map((principle, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    {principle.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{principle.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Skills */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Technical Skills</h2>
          <div className="space-y-4">
            {Object.entries(skills).map(([category, items]) => (
              <div key={category}>
                <h3 className="font-semibold mb-2">{category}</h3>
                <div className="flex flex-wrap gap-2">
                  {items.map((skill) => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <Card className="bg-muted/30">
          <CardContent className="pt-6 text-center">
            <h3 className="text-xl font-semibold mb-2">Explore the Portfolio</h3>
            <p className="text-muted-foreground mb-6">
              See these principles in action through the live demos and project documentation.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild>
                <Link href="/demo">
                  View All Demos
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                  <Github className="mr-2 h-4 w-4" />
                  View on GitHub
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
