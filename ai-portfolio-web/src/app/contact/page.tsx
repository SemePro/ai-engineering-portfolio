import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Github, Linkedin, ExternalLink } from "lucide-react";

const links = [
  {
    name: "GitHub",
    description: "View source code and project repositories",
    icon: Github,
    href: "https://github.com/SemePro/ai-engineering-portfolio",
  },
  {
    name: "LinkedIn",
    description: "Connect professionally",
    icon: Linkedin,
    href: "https://www.linkedin.com/in/kodjo-semeglo-7993969a/",
  },
];

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Contact</h1>
          <p className="text-muted-foreground text-lg">
            For roles in AI platform engineering, reliability, and DevOps-integrated AI systems.
          </p>
        </div>

        {/* Contact Cards */}
        <div className="space-y-4 mb-12">
          {links.map((link) => (
            <Card key={link.name} className="hover:bg-muted/30 transition-colors">
              <a href={link.href} target="_blank" rel="noopener noreferrer" className="block">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <link.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{link.name}</CardTitle>
                        <CardDescription>{link.description}</CardDescription>
                      </div>
                    </div>
                    <ExternalLink className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
              </a>
            </Card>
          ))}
        </div>

        {/* Additional Info */}
        <Card className="bg-muted/30">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-6">
              Available for remote opportunities in applied AI engineering, platform reliability, and production ML systems.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild>
                <a href="https://github.com/SemePro/ai-engineering-portfolio" target="_blank" rel="noopener noreferrer">
                  <Github className="mr-2 h-4 w-4" />
                  GitHub
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="https://www.linkedin.com/in/kodjo-semeglo-7993969a/" target="_blank" rel="noopener noreferrer">
                  <Linkedin className="mr-2 h-4 w-4" />
                  LinkedIn
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
