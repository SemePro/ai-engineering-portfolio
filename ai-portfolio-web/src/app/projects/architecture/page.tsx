import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Github, CheckCircle, XCircle, AlertTriangle, Lightbulb, Database, Cpu, GitBranch, Ban } from "lucide-react";
import Link from "next/link";

const decisionFactors = [
  { factor: "Latency < 100ms + Regulated Data", recommendation: "Rules / No-AI", icon: GitBranch },
  { factor: "Existing Documents + Q&A Use Case", recommendation: "RAG", icon: Database },
  { factor: "Specialized Domain Language", recommendation: "Fine-Tuning", icon: Cpu },
  { factor: "Vague Requirements", recommendation: "Refuse to Recommend", icon: Ban },
];

const failureModes = [
  { mode: "Recommending AI when rules suffice", solution: "Explicit 'no_ai' and 'rules' recommendations" },
  { mode: "Ignoring compliance requirements", solution: "Compliance flags block inappropriate recommendations" },
  { mode: "Guessing without data", solution: "Strict mode refusal when data_availability is 'none'" },
  { mode: "Vague requirements proceeding", solution: "Feasibility check rejects insufficient problem statements" },
  { mode: "No consideration of alternatives", solution: "Required 'alternatives_considered' in every decision" },
];

export default function ArchitectureProjectPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-12">
          <Badge variant="secondary" className="mb-4">Portfolio Project</Badge>
          <h1 className="text-4xl font-bold tracking-tight mb-4">AI Solution Architecture Review</h1>
          <p className="text-xl text-muted-foreground mb-6">
            A decision support system that analyzes requirements and recommends appropriate AI architectures — including when AI should NOT be used.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/demo/architecture">
                Try Live Demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <a href="https://github.com/SemePro/ai-engineering-portfolio" target="_blank" rel="noopener noreferrer">
                <Github className="mr-2 h-4 w-4" />
                View Source
              </a>
            </Button>
          </div>
        </div>

        {/* This is NOT a Chatbot */}
        <Card className="mb-8 border-yellow-500/30 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              This is NOT a Chatbot
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              This system produces <strong>decisions, explanations, and constraints</strong> — not conversational responses.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  What It Does
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Translates requirements into architecture decisions</li>
                  <li>• Explains tradeoffs clearly with evidence</li>
                  <li>• Evaluates feasibility, cost, and constraints</li>
                  <li>• Refuses when information is insufficient</li>
                  <li>• Keeps humans in control at all times</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  What It Does NOT Do
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Generate code or implementation</li>
                  <li>• Have conversations</li>
                  <li>• Speculate without evidence</li>
                  <li>• Override human decisions</li>
                  <li>• Auto-generate diagrams without explanation</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Decision Logic */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Decision Logic</CardTitle>
            <CardDescription>How the system determines the right approach</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {decisionFactors.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.factor}</p>
                    <p className="text-xs text-muted-foreground">→ {item.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Architecture Diagram */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>System Architecture</CardTitle>
            <CardDescription>How the architecture review works</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto mb-4">
              <pre className="text-xs text-green-400 font-mono whitespace-pre">
{`┌─────────────────────────────────────────────────────────────────┐
│                 AI Solution Architecture Review                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────┐     ┌──────────────────────────────────┐  │
│   │ Problem Statement│────▶│       Feasibility Check          │  │
│   │ + Constraints   │     │  • Problem quality validation    │  │
│   └─────────────────┘     │  • Constraint conflict detection │  │
│                           │  • Data availability check       │  │
│                           └───────────────┬──────────────────┘  │
│                                           │                      │
│                                     Pass? │ Fail → REFUSE       │
│                                           ▼                      │
│   ┌───────────────────────────────────────────────────────────┐ │
│   │                Pattern Matching (RAG)                      │ │
│   │  • Search similar architecture patterns                   │ │
│   │  • Retrieve past decisions                                │ │
│   │  • Find relevant constraints                              │ │
│   └────────────────────────────┬──────────────────────────────┘ │
│                                │                                 │
│                                ▼                                 │
│   ┌───────────────────────────────────────────────────────────┐ │
│   │              Decision Generation (LLM)                     │ │
│   │  • Recommend: rag | fine_tuning | rules | hybrid | no_ai │ │
│   │  • Explain rationale                                      │ │
│   │  • List tradeoffs and risks                               │ │
│   │  • Cite alternatives considered                           │ │
│   │  • Assign confidence score                                │ │
│   └────────────────────────────┬──────────────────────────────┘ │
│                                │                                 │
│                                ▼                                 │
│   ┌─────────────────┐    ┌───────────────┐   ┌───────────────┐ │
│   │  Architecture   │    │   Tradeoffs   │   │    Human      │ │
│   │   Decision      │    │   & Risks     │   │   Feedback    │ │
│   └─────────────────┘    └───────────────┘   └───────────────┘ │
└─────────────────────────────────────────────────────────────────┘`}
              </pre>
            </div>
            <p className="text-sm text-muted-foreground">
              The system first validates input feasibility, then uses RAG to find similar patterns, 
              and finally generates a structured decision with the LLM. Human feedback is collected 
              for all decisions.
            </p>
          </CardContent>
        </Card>

        {/* Failure Modes */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Failure Modes Addressed</CardTitle>
            <CardDescription>How the system prevents common architecture decision failures</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {failureModes.map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <XCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.mode}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs text-green-400">{item.solution}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tech Stack */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Technical Implementation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-semibold mb-2">Backend</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Python 3.11</Badge>
                  <Badge variant="secondary">FastAPI</Badge>
                  <Badge variant="secondary">Pydantic</Badge>
                  <Badge variant="secondary">ChromaDB</Badge>
                  <Badge variant="secondary">OpenAI</Badge>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Frontend</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Next.js 14</Badge>
                  <Badge variant="secondary">TypeScript</Badge>
                  <Badge variant="secondary">TailwindCSS</Badge>
                  <Badge variant="secondary">shadcn/ui</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Endpoints */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>API Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { method: "POST", path: "/architecture/review", desc: "Perform architecture review" },
                { method: "GET", path: "/architecture/reviews", desc: "List past reviews" },
                { method: "GET", path: "/architecture/reviews/{id}", desc: "Get review details" },
                { method: "POST", path: "/architecture/reviews/{id}/feedback", desc: "Submit human feedback" },
              ].map((endpoint, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded bg-muted/30">
                  <Badge variant={endpoint.method === "POST" ? "default" : "outline"} className="w-16 justify-center">
                    {endpoint.method}
                  </Badge>
                  <code className="text-sm font-mono text-primary">{endpoint.path}</code>
                  <span className="text-sm text-muted-foreground">— {endpoint.desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <Card className="bg-muted/30">
          <CardContent className="pt-6 text-center">
            <h3 className="text-xl font-semibold mb-2">Try the Architecture Review</h3>
            <p className="text-muted-foreground mb-6">
              See how the system analyzes requirements and recommends architectures.
            </p>
            <Button asChild size="lg">
              <Link href="/demo/architecture">
                Open Demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
