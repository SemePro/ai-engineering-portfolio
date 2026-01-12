import Link from "next/link";
import { Github, Linkedin, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
                AI
              </div>
              <span className="font-semibold">Applied AI Engineering Portfolio</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Building reliable, evidence-driven AI systems for real engineering workflows.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Projects</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/projects#rag" className="hover:text-primary transition-colors">
                  AI Knowledge Retrieval
                </Link>
              </li>
              <li>
                <Link href="/projects#eval" className="hover:text-primary transition-colors">
                  LLM Evaluation & Testing
                </Link>
              </li>
              <li>
                <Link href="/projects#gateway" className="hover:text-primary transition-colors">
                  Secure AI Gateway
                </Link>
              </li>
              <li>
                <Link href="/projects#incident" className="hover:text-primary transition-colors">
                  AI Incident Investigation
                </Link>
              </li>
              <li>
                <Link href="/projects#devops" className="hover:text-primary transition-colors">
                  AI-Assisted DevOps
                </Link>
              </li>
              <li>
                <Link href="/projects#architecture" className="hover:text-primary transition-colors">
                  Architecture Review
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Live Demos</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/demo/rag" className="hover:text-primary transition-colors">
                  Knowledge Retrieval Demo
                </Link>
              </li>
              <li>
                <Link href="/demo/eval" className="hover:text-primary transition-colors">
                  Evaluation Dashboard
                </Link>
              </li>
              <li>
                <Link href="/demo/gateway" className="hover:text-primary transition-colors">
                  Gateway Playground
                </Link>
              </li>
              <li>
                <Link href="/demo/incident" className="hover:text-primary transition-colors">
                  Incident Investigation
                </Link>
              </li>
              <li>
                <Link href="/demo/devops" className="hover:text-primary transition-colors">
                  DevOps Risk Analysis
                </Link>
              </li>
              <li>
                <Link href="/demo/architecture" className="hover:text-primary transition-colors">
                  Architecture Review
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Connect</h4>
            <div className="flex space-x-4">
              <a
                href="https://github.com/SemePro/ai-engineering-portfolio"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <Github className="h-5 w-5" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <Linkedin className="h-5 w-5" />
              </a>
              <a
                href="mailto:contact@example.com"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Applied AI Engineering Portfolio</p>
        </div>
      </div>
    </footer>
  );
}
