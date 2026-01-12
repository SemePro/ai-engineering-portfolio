import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Bot, Shield, LineChart, Workflow, Github, ExternalLink } from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "RAG systems with grounded answers and citations",
    description: "Enterprise-grade retrieval-augmented generation with strict mode for safety",
  },
  {
    icon: LineChart,
    title: "Automated LLM evaluation and regression testing",
    description: "Catch regressions before they reach production with comprehensive test suites",
  },
  {
    icon: Shield,
    title: "Secure AI gateways with guardrails and cost controls",
    description: "Rate limiting, PII redaction, prompt injection detection, and cost tracking",
  },
  {
    icon: Workflow,
    title: "CI/CD pipelines for AI systems",
    description: "Automated testing and deployment workflows for reliable AI delivery",
  },
];

const projects = [
  {
    id: "rag",
    title: "AI Knowledge Retrieval (RAG System)",
    description: "Evidence-based answers with citations and strict refusal.",
    tech: ["FastAPI", "ChromaDB", "OpenAI", "Python"],
    demoUrl: "/demo/rag",
    githubUrl: "https://github.com/SemePro/ai-engineering-portfolio",
  },
  {
    id: "eval",
    title: "LLM Evaluation & Regression Testing",
    description: "Automated quality gates for LLM outputs in CI/CD.",
    tech: ["FastAPI", "Pydantic", "GitHub Actions", "Python"],
    demoUrl: "/demo/eval",
    githubUrl: "https://github.com/SemePro/ai-engineering-portfolio",
  },
  {
    id: "gateway",
    title: "Secure AI Gateway",
    description: "PII redaction, prompt injection defense, rate limiting, and cost tracking.",
    tech: ["FastAPI", "Token Bucket", "Regex", "Python"],
    demoUrl: "/demo/gateway",
    githubUrl: "https://github.com/SemePro/ai-engineering-portfolio",
  },
  {
    id: "incident",
    title: "AI Incident Investigation",
    description: "Timeline reconstruction and root-cause analysis with evidence and human feedback.",
    tech: ["FastAPI", "ChromaDB", "OpenAI", "Python"],
    demoUrl: "/demo/incident",
    githubUrl: "https://github.com/SemePro/ai-engineering-portfolio",
  },
  {
    id: "devops",
    title: "AI-Assisted DevOps Risk Analysis",
    description: "Pre-deployment risk scoring, rollout recommendations, and change impact analysis.",
    tech: ["FastAPI", "ChromaDB", "OpenAI", "Python"],
    demoUrl: "/demo/devops",
    githubUrl: "https://github.com/SemePro/ai-engineering-portfolio",
  },
  {
    id: "architecture",
    title: "AI Solution Architecture Review",
    description: "Architecture recommendations with tradeoffs — including when AI should NOT be used.",
    tech: ["FastAPI", "ChromaDB", "OpenAI", "Python"],
    demoUrl: "/demo/architecture",
    githubUrl: "https://github.com/SemePro/ai-engineering-portfolio",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-muted/50 to-background">
        <div className="container mx-auto px-4 py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Applied AI Engineering Portfolio
            </h1>
            <p className="mt-6 text-xl text-muted-foreground md:text-2xl font-medium">
              Building reliable, evidence-driven AI systems for real engineering workflows.
            </p>
            <p className="mt-4 text-base text-muted-foreground md:text-lg max-w-2xl mx-auto">
              A collection of production-minded AI systems focused on reliability, evaluation, security, incident response, and DevOps decision support.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/demo">
                  View Live Demos
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/architecture">
                  View Architecture
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                  <Github className="mr-2 h-4 w-4" />
                  View Code on GitHub
                </a>
              </Button>
            </div>
          </div>
        </div>
        
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl" />
        </div>
      </section>

      {/* Value Propositions */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight">
              What I Build
            </h2>
            <p className="mt-4 text-muted-foreground">
              Production systems that go beyond demos and prototypes
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <Card key={index} className="border-muted bg-muted/30">
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Projects Section */}
      <section className="border-t bg-muted/30 py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight">
              Featured Projects
            </h2>
            <p className="mt-4 text-muted-foreground">
              Each project demonstrates real production patterns
            </p>
          </div>
          <div className="grid gap-8 lg:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle>{project.title}</CardTitle>
                  <CardDescription className="min-h-[60px]">
                    {project.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="flex flex-wrap gap-2 mb-6">
                    {project.tech.map((tech) => (
                      <Badge key={tech} variant="secondary">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <Button size="sm" asChild>
                      <Link href={project.demoUrl}>
                        Live Demo
                        <ExternalLink className="ml-2 h-3 w-3" />
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">
                        <Github className="mr-2 h-3 w-3" />
                        Code
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Button variant="outline" size="lg" asChild>
              <Link href="/projects">
                View All Projects
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Architecture Overview */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight">
              System Architecture
            </h2>
            <p className="mt-4 text-muted-foreground">
              How the components work together
            </p>
          </div>
          <div className="mx-auto max-w-4xl">
            <Card className="p-8">
              <div className="aspect-video rounded-lg border bg-muted/50 flex items-center justify-center">
                <div className="text-center p-8">
                  <p className="text-muted-foreground mb-4">Architecture Diagram</p>
                  <div className="flex flex-col items-center space-y-4 text-sm">
                    <div className="flex items-center space-x-4">
                      <Badge>Web Frontend</Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="secondary">Secure Gateway</Badge>
                    </div>
                    <div className="flex items-center space-x-8">
                      <div className="flex flex-col items-center space-y-2">
                        <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                        <Badge variant="outline">RAG Service</Badge>
                      </div>
                      <div className="flex flex-col items-center space-y-2">
                        <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                        <Badge variant="outline">Eval Service</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-6 text-sm text-muted-foreground text-center">
                Web → Gateway → Backend Services. All traffic flows through the secure gateway
                for rate limiting, security checks, and observability.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-muted/30 py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            Explore the Systems
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Try the live demos to see how these production patterns work together.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/demo">
                View All Demos
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/architecture">
                View Architecture
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
