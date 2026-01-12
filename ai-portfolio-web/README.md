# AI Portfolio Website

Public-facing portfolio website showcasing AI engineering projects with live demos.

## Overview

A professional portfolio built with Next.js 14 (App Router), TypeScript, and TailwindCSS. Features live demos that connect to the backend AI services.

## Architecture

```
┌─────────────────────────────────────┐
│         Next.js Frontend            │
│  ┌─────────────────────────────┐    │
│  │  App Router                 │    │
│  │  • /           Home         │    │
│  │  • /projects   Project list │    │
│  │  • /demo/rag   RAG chat     │    │
│  │  • /demo/eval  Eval dash    │    │
│  │  • /demo/gateway Playground │    │
│  │  • /about      Career story │    │
│  │  • /contact    Links        │    │
│  └─────────────────────────────┘    │
│                 │                   │
│                 ▼                   │
│  ┌─────────────────────────────┐    │
│  │  API Client (fetch)         │───▶│ Gateway/Backend
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

## Key Features

### Pages
- **Home**: Hero with value propositions and project cards
- **Projects**: Detailed breakdown of each project
- **RAG Demo**: Interactive chat with citations
- **Eval Demo**: Dashboard showing test results
- **Gateway Demo**: API playground with security feedback
- **About**: Career narrative and skills
- **Contact**: GitHub and LinkedIn links

### UI Components
- shadcn/ui-style components (Button, Card, Badge, Input)
- Responsive design (mobile-first)
- Dark mode by default
- Clean, professional aesthetic

## Why This Matters

A portfolio isn't just code—it's communication:
- **Demonstrates full-stack capability**: Not just backend
- **Shows attention to UX**: Clean, functional interfaces
- **Provides live interaction**: Recruiters can try the demos
- **Contextualizes the work**: Explains why each project matters

## Pages Structure

```
src/app/
├── layout.tsx          # Root layout with header/footer
├── page.tsx            # Home page
├── globals.css         # Tailwind styles
├── projects/
│   └── page.tsx        # Projects listing
├── demo/
│   ├── rag/
│   │   └── page.tsx    # RAG chat demo
│   ├── eval/
│   │   └── page.tsx    # Eval dashboard
│   └── gateway/
│       └── page.tsx    # Gateway playground
├── about/
│   └── page.tsx        # About/career page
└── contact/
    └── page.tsx        # Contact links
```

## Component Structure

```
src/components/
├── layout/
│   ├── header.tsx      # Navigation header
│   └── footer.tsx      # Site footer
└── ui/
    ├── button.tsx      # Button component
    ├── card.tsx        # Card component
    ├── badge.tsx       # Badge component
    └── input.tsx       # Input component
```

## Homepage Copy

The homepage features specific copy designed to communicate value:

**Hero Title**: "I Build Reliable, Production-Grade AI Systems"

**Hero Subtitle**: "Applied LLM engineering with a focus on reliability, evaluation, security, and real-world deployment."

**Value Bullets**:
- RAG systems with grounded answers and citations
- Automated LLM evaluation and regression testing
- Secure AI gateways with guardrails and cost controls
- CI/CD pipelines for AI systems

## Tradeoffs & Design Decisions

### Simplified (for portfolio)
- **Client-side API calls**: Could use Next.js API routes as proxy
- **No auth**: Live demos are public
- **Minimal animations**: Focus on functionality over flash

### Would Improve in Production
- **Server components for SEO**: Currently client-heavy demos
- **Error boundaries**: Better error handling UX
- **Analytics integration**: Track demo usage
- **CMS for content**: Currently hardcoded

## Local Setup

### With Docker
```bash
docker build -t ai-portfolio-web .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_GATEWAY_URL=http://localhost:8000 \
  ai-portfolio-web
```

### Without Docker
```bash
npm install
cp .env.example .env.local
# Configure API URLs
npm run dev
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_GATEWAY_URL` | Gateway API URL | `http://localhost:8000` |
| `NEXT_PUBLIC_RAG_URL` | RAG API URL | `http://localhost:8001` |
| `NEXT_PUBLIC_EVAL_URL` | Eval API URL | `http://localhost:8002` |

## Deployment Notes

### Vercel
1. Import from GitHub
2. Set environment variables for production API URLs
3. Deploy automatically on push to main

### Environment-Specific URLs
- **Development**: localhost URLs
- **Production**: Railway-hosted API URLs

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```
