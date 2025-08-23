# Agent Guidelines for r2-explorer

## Build/Lint/Test Commands
- **Start development**: `pnpm start` (Electron Forge dev server)
- **Build**: `pnpm package` (package app), `pnpm make` (create distributable)
- **Lint**: `pnpm lint` (uses oxlint)
- **Format**: `pnpm format` (uses Biome formatter)
- **No test framework currently configured**

## Code Style & Standards
- **Formatter**: Biome with 2-space indentation, 100 char line width, single quotes
- **Semicolons**: As needed (ASI), trailing commas ES5 style
- **TypeScript**: Strict mode enabled (`noImplicitAny: true`)
- **Path aliases**: Use `@/*` for `src/*` imports
- **File extensions**: Use `.ts` for TypeScript files

## Project Structure
- Main process code: `src/main/`
- Renderer process code: `src/renderer.ts`
- Database schema: `src/main/db/`
- Configuration files use consistent formatting

## Dependencies & Libraries
- **Infrastructure**: Use Alchemy for infrastructure as code (mainly Cloudflare bucket management)
- **Backend**: Use Effect for backend code (main process), NOT for frontend/renderer
- **Frontend**: Follow React patterns in RULES.MD
- **Database**: Drizzle ORM with libSQL
- **UI**: TailwindCSS PostCSS
