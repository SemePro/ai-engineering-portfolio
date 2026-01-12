"use client";

import { useState, FormEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, FileText, AlertCircle, Loader2 } from "lucide-react";

interface Citation {
  source: string;
  chunk_id: string;
  relevance_score: number;
  excerpt: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  confidence?: number;
  strict_mode_triggered?: boolean;
  processing_time_ms?: number;
}

const sampleQuestions = [
  "What is the vacation policy?",
  "How do I request remote work?",
  "What are the code review guidelines?",
  "How do we handle security incidents?",
];

export default function RAGDemoPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [strictMode, setStrictMode] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const question = input.trim();
    setInput("");
    setError(null);
    
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setIsLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:8000"}/rag/ask`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            strict_mode: strictMode,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail?.error || errorData.detail || "Failed to get response");
      }

      const data = await response.json();
      
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          citations: data.citations,
          confidence: data.confidence_score,
          strict_mode_triggered: data.strict_mode_triggered,
          processing_time_ms: data.gateway?.latency_ms || data.processing_time_ms,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSampleQuestion(question: string) {
    setInput(question);
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">RAG Knowledge Assistant</h1>
          <p className="text-muted-foreground">
            Ask questions about company policies and documentation. Answers include citations and confidence scores.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Chat Area */}
          <div className="lg:col-span-2">
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Chat</CardTitle>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">Strict Mode</span>
                    <button
                      onClick={() => setStrictMode(!strictMode)}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        strictMode ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        strictMode ? "translate-x-6" : "translate-x-0.5"
                      }`} />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto space-y-4 pb-4">
                {messages.length === 0 && (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        Ask a question to get started
                      </p>
                    </div>
                  </div>
                )}
                
                {messages.map((message, i) => (
                  <div
                    key={i}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-4 py-2 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      
                      {message.role === "assistant" && (
                        <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                          {message.strict_mode_triggered && (
                            <Badge variant="warning" className="text-xs">
                              Strict mode: Low confidence
                            </Badge>
                          )}
                          
                          {message.confidence !== undefined && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Confidence: {(message.confidence * 100).toFixed(0)}%</span>
                              {message.processing_time_ms && (
                                <span>• {message.processing_time_ms.toFixed(0)}ms</span>
                              )}
                            </div>
                          )}
                          
                          {message.citations && message.citations.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">Sources:</p>
                              {message.citations.map((citation, j) => (
                                <div key={j} className="text-xs text-muted-foreground">
                                  <FileText className="inline h-3 w-3 mr-1" />
                                  {citation.source} ({(citation.relevance_score * 100).toFixed(0)}%)
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-4 py-2">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
              </CardContent>
              
              {error && (
                <div className="px-4 pb-2">
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                </div>
              )}
              
              <div className="p-4 border-t">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask a question..."
                    disabled={isLoading}
                  />
                  <Button type="submit" disabled={isLoading || !input.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sample Questions</CardTitle>
                <CardDescription>Click to try these examples</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {sampleQuestions.map((question, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-left h-auto py-2 whitespace-normal break-words"
                    onClick={() => handleSampleQuestion(question)}
                  >
                    {question}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">How It Works</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p>
                  <strong>1. Retrieval:</strong> Your question is embedded and matched against document chunks using vector similarity.
                </p>
                <p>
                  <strong>2. Context:</strong> Top-k relevant chunks are passed to the LLM as context.
                </p>
                <p>
                  <strong>3. Generation:</strong> The LLM generates an answer based only on the provided context.
                </p>
                <p>
                  <strong>4. Citations:</strong> Source documents are included for verification.
                </p>
                <p>
                  <strong>Strict Mode:</strong> When enabled, low-confidence answers return "I don't know" instead of guessing.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
