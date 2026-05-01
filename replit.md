# Ortogonex

## Overview

AI-powered trading analysis application — Ortogonex, based on the Belkhayate method. Users share TradingView screens live; the app captures frames, sends to GPT-4 Vision, and displays structured trading signals. Supports Solo mode (1 screen, individual Belkhayate analysis) and Octogone mode (2 screens simultaneous, full 8-market inter-market analysis: DX, BTC, ZN, 6J + ES, CL, GC, HG).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/belkhayate-trader)
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **AI**: OpenAI GPT-5.2 with vision (via Replit AI Integrations)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Architecture

- `artifacts/belkhayate-trader/` — React + Vite frontend (dark trading terminal UI)
- `artifacts/api-server/` — Express 5 API server
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `lib/api-client-react/` — Generated React Query hooks
- `lib/api-zod/` — Generated Zod validation schemas
- `lib/db/src/schema/analyses.ts` — Analyses table schema
- `lib/integrations-openai-ai-server/` — OpenAI client integration

## Features

- Upload TradingView chart screenshots (drag & drop or click)
- AI analysis with Belkhayate method (3 indicators: Énergie, Direction, Pivots)
- Structured analysis result: Energy state, Direction trend, Pivot levels
- Trading signals: BUY, SELL, WAIT, NO_SIGNAL with entry/SL/TP levels
- Analysis history with delete functionality
- Statistics dashboard (signal breakdown, daily count)

## Belkhayate Method

The app implements strict Belkhayate rules:
1. **Énergie**: Blue bars = sell pressure, Gray bars = buy pressure, Flat = no signal
2. **Direction**: Green points = bullish, Red points = bearish — never trade against direction
3. **Pivots**: DO/RÉ/MI/FA/SOL/LA/SI — musical scale of support/resistance levels

See the `attached_assets/` folder for the complete system prompt used for AI analysis.
