import Link from "next/link";
import Image from "next/image";
import { ContactLinks } from "@/components/contact-links";
import { PROFILE } from "@/lib/profile";
import { TESTING_NAV_ITEMS } from "@/lib/testing-nav";

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Image
                src="/logo.png"
                alt=""
                width={48}
                height={48}
                className="rounded-md"
              />
              <span className="font-semibold">{PROFILE.name}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {PROFILE.title} · agentic systems, LLM platforms, AI evaluation.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Projects</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/projects/incident-agent" className="hover:text-primary transition-colors">
                  Incident Response Engine
                </Link>
              </li>
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
                  Incident Investigator v1
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
            <h4 className="font-semibold mb-4">Testing</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {TESTING_NAV_ITEMS.map(({ href, footerLabel }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="hover:text-primary transition-colors"
                  >
                    {footerLabel}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Connect</h4>
            <ContactLinks size="sm" />
          </div>
        </div>

        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {PROFILE.name}</p>
        </div>
      </div>
    </footer>
  );
}
