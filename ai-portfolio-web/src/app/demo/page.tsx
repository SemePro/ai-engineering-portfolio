import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Gauge, Shield, ArrowRight, Search, Zap, Lightbulb } from "lucide-react";

const demos = [
  {
    id: "rag",
    title: "AI Knowledge Retrieval (RAG System)",
    description: "Evidence-based answers with citations and strict refusal when uncertain.",
    icon: Bot,
    features: [
      "Vector search with ChromaDB",
      "Answers with source citations",
      "Strict mode for safety",
      "Confidence scoring",
    ],
    href: "/demo/rag",
  },
  {
    id: "eval",
    title: "LLM Evaluation & Regression Testing",
    description: "Automated quality gates for LLM outputs in CI/CD pipelines.",
    icon: Gauge,
    features: [
      "JSON schema validation",
      "Citation detection",
      "Consistency testing",
      "Regression detection",
    ],
    href: "/demo/eval",
  },
  {
    id: "gateway",
    title: "Secure AI Gateway",
    description: "PII redaction, prompt injection defense, rate limiting, and cost tracking.",
    icon: Shield,
    features: [
      "Rate limiting feedback",
      "PII auto-redaction",
      "Injection detection",
      "Cost estimation",
    ],
    href: "/demo/gateway",
  },
  {
    id: "incident",
    title: "AI Incident Investigation",
    description: "Timeline reconstruction and root-cause analysis with evidence and human feedback.",
    icon: Search,
    features: [
      "Timeline reconstruction",
      "Evidence-based hypotheses",
      "Strict mode refusal",
      "Human feedback support",
    ],
    href: "/demo/incident",
  },
  {
    id: "devops",
    title: "AI-Assisted DevOps Risk Analysis",
    description: "Pre-deployment risk scoring, rollout recommendations, and change impact analysis.",
    icon: Zap,
    features: [
      "Risk scoring",
      "Historical comparison",
      "Rollout recommendations",
      "Incident integration",
    ],
    href: "/demo/devops",
  },
  {
    id: "architecture",
    title: "AI Solution Architecture Review",
    description: "Architecture recommendations with tradeoffs — including when AI should NOT be used.",
    icon: Lightbulb,
    features: [
      "RAG vs Fine-tuning vs Rules",
      "Constraint analysis",
      "Strict refusal mode",
      "Human feedback",
    ],
    href: "/demo/architecture",
  },
];

export default function DemoPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-4xl">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">Interactive Demos</Badge>
          <h1 className="text-4xl font-bold tracking-tight mb-4">Live Demonstrations</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Interactive demonstrations of production AI patterns. 
            Each demo connects to real backend services.
          </p>
        </div>

        <div className="space-y-6">
          {demos.map((demo) => (
            <Card key={demo.id} className="overflow-hidden">
              <div className="flex flex-col md:flex-row">
                <div className="flex-1 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <demo.icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{demo.title}</CardTitle>
                  </div>
                  <CardDescription className="mb-4 text-base">
                    {demo.description}
                  </CardDescription>
                  <div className="flex flex-wrap gap-2">
                    {demo.features.map((feature, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-center p-6 bg-muted/30 md:w-48">
                  <Button asChild>
                    <Link href={demo.href}>
                      Try Demo
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Production: demos are live. Development: show setup note */}
        {process.env.NODE_ENV === "development" ? (
          <Card className="mt-12 bg-muted/30">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground mb-4">
                <strong>Local Development:</strong> These demos require the backend services to be running.
                Run <code className="bg-muted px-1 rounded">docker compose up</code> to start all services.
              </p>
              <Button variant="outline" asChild>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                  View Setup Instructions
                </a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-12 bg-primary/5 border-primary/20">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">
                All demos are connected to live backend services. Try them out!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
