import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Database, Shield, Gauge, Search, Zap, Globe } from "lucide-react";
import Link from "next/link";

const services = [
  {
    name: "Web Frontend",
    port: "3000",
    tech: "Next.js",
    description: "User interface for all demos and documentation",
    icon: Globe,
  },
  {
    name: "Secure AI Gateway",
    port: "8000",
    tech: "FastAPI",
    description: "Central entry point with security middleware",
    icon: Shield,
  },
  {
    name: "Knowledge Retrieval",
    port: "8001",
    tech: "FastAPI + ChromaDB",
    description: "RAG system with document chunking and citations",
    icon: Database,
  },
  {
    name: "Evaluation Service",
    port: "8002",
    tech: "FastAPI",
    description: "LLM testing and regression detection",
    icon: Gauge,
  },
  {
    name: "Incident Investigation",
    port: "8003",
    tech: "FastAPI + ChromaDB",
    description: "Root cause analysis with evidence retrieval",
    icon: Search,
  },
  {
    name: "DevOps Risk Analysis",
    port: "8004",
    tech: "FastAPI + ChromaDB",
    description: "Deployment risk scoring and recommendations",
    icon: Zap,
  },
];

export default function ArchitecturePage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">System Design</Badge>
          <h1 className="text-4xl font-bold tracking-tight mb-4">Architecture</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            A microservices architecture with a secure gateway as the single entry point for all AI operations.
          </p>
        </div>

        {/* Architecture Diagram */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle>System Overview</CardTitle>
            <CardDescription>
              All traffic flows through the Secure AI Gateway for rate limiting, security checks, and observability.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* TODO: Replace with actual diagram image from /public/architecture-diagram.png when available */}
            <div className="bg-slate-900 rounded-lg p-6 overflow-x-auto">
              <pre className="text-xs text-green-400 font-mono whitespace-pre">
{`┌─────────────────────────────────────────────────────────────────────────────┐
│                         Applied AI Engineering Portfolio                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│    ┌──────────────┐                                                          │
│    │  Web (Next.js)│                                                          │
│    │   Port 3000   │                                                          │
│    └───────┬───────┘                                                          │
│            │                                                                  │
│            ▼                                                                  │
│    ┌────────────────────────────────────────────────────────────────┐        │
│    │                   Secure AI Gateway (8000)                      │        │
│    │  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │        │
│    │  │   Rate   │  │   PII    │  │  Prompt   │  │    Cost      │  │        │
│    │  │  Limit   │─▶│  Redact  │─▶│ Injection │─▶│  Estimation  │  │        │
│    │  └──────────┘  └──────────┘  └───────────┘  └──────────────┘  │        │
│    └────────────────────────────┬───────────────────────────────────┘        │
│                                 │                                             │
│         ┌───────────────────────┼───────────────────────┐                    │
│         │                       │                       │                    │
│         ▼                       ▼                       ▼                    │
│  ┌─────────────┐        ┌─────────────┐        ┌─────────────┐              │
│  │     RAG     │        │    Eval     │        │  Incident   │              │
│  │   (8001)    │        │   (8002)    │        │   (8003)    │              │
│  │ + ChromaDB  │        │             │        │ + ChromaDB  │              │
│  └─────────────┘        └─────────────┘        └─────────────┘              │
│         │                                              │                     │
│         │                       ┌──────────────────────┘                    │
│         │                       ▼                                            │
│         │               ┌─────────────┐                                     │
│         │               │   DevOps    │                                     │
│         │               │   (8004)    │◀─── Cross-service incident lookup   │
│         │               │ + ChromaDB  │                                     │
│         │               └─────────────┘                                     │
│         │                       │                                            │
│         ▼                       ▼                                            │
│    ┌─────────────────────────────────────────────────────────────┐          │
│    │                    OpenAI API (External)                     │          │
│    │         Embeddings (text-embedding-3-small)                  │          │
│    │         Chat Completions (gpt-4o-mini)                       │          │
│    └─────────────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Request Flow */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle>Request Flow</CardTitle>
            <CardDescription>
              How requests are processed through the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 shrink-0">
                  <span className="text-sm font-semibold text-primary">1</span>
                </div>
                <div>
                  <h4 className="font-semibold">Web Frontend (Next.js)</h4>
                  <p className="text-sm text-muted-foreground">
                    User interacts with the portfolio website. All API calls are made to the Secure Gateway.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 shrink-0">
                  <span className="text-sm font-semibold text-primary">2</span>
                </div>
                <div>
                  <h4 className="font-semibold">Secure AI Gateway</h4>
                  <p className="text-sm text-muted-foreground">
                    Applies rate limiting, PII redaction, prompt injection detection, and cost estimation before routing to backend services.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 shrink-0">
                  <span className="text-sm font-semibold text-primary">3</span>
                </div>
                <div>
                  <h4 className="font-semibold">Backend Services</h4>
                  <p className="text-sm text-muted-foreground">
                    RAG, Eval, Incident, and DevOps services process requests using ChromaDB for vector storage and OpenAI for embeddings/completions.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 shrink-0">
                  <span className="text-sm font-semibold text-primary">4</span>
                </div>
                <div>
                  <h4 className="font-semibold">Response with Metadata</h4>
                  <p className="text-sm text-muted-foreground">
                    Responses are enriched with gateway metadata (request_id, latency, cost estimates) before returning to the client.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Services Grid */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Services</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {services.map((service) => (
              <Card key={service.name}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <service.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{service.name}</CardTitle>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">:{service.port}</Badge>
                        <Badge variant="secondary" className="text-xs">{service.tech}</Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{service.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Design Decisions */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle>Design Decisions</CardTitle>
            <CardDescription>Key architectural choices and tradeoffs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-1">Gateway Pattern</h4>
                <p className="text-sm text-muted-foreground">
                  All traffic flows through a single gateway, enabling centralized security, observability, and rate limiting without duplicating logic in each service.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Service Isolation</h4>
                <p className="text-sm text-muted-foreground">
                  Each AI capability runs as an independent service with its own data store, allowing independent scaling and deployment.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Evidence-Based AI</h4>
                <p className="text-sm text-muted-foreground">
                  All LLM outputs require evidence citations. Strict mode enables refusal when confidence is low, preventing hallucination in production.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Local-First Development</h4>
                <p className="text-sm text-muted-foreground">
                  Docker Compose enables full-stack local development. ChromaDB provides vector storage without external dependencies.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <Card className="bg-muted/30">
          <CardContent className="pt-6 text-center">
            <h3 className="text-xl font-semibold mb-2">Explore the Systems</h3>
            <p className="text-muted-foreground mb-6">
              See these architectural patterns in action through the live demos.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild>
                <Link href="/demo">
                  View All Demos
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/projects">
                  View Projects
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
