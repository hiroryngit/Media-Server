# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run ESLint
npm run lint

# Database commands (Prisma)
npx prisma generate    # Generate Prisma Client after schema changes
npx prisma migrate dev # Create and apply migrations in development
npx prisma studio      # Open database GUI
```

## Architecture Overview

This is a Next.js 16 media server application using the App Router with React 19 and React Compiler enabled.

### Tech Stack
- **Framework**: Next.js 16 with App Router (`src/app/`)
- **Database**: SQLite via Prisma ORM
- **Styling**: Sass (SCSS modules)
- **Auth**: Session-based with bcryptjs for password hashing, cookies for session storage

### Project Structure
- `src/app/` - Next.js App Router pages and layouts
- `src/app/lib/db.ts` - Prisma client singleton (use this for all database access)
- `src/app/actions.ts` - Server Actions for login
- `src/app/signup/actions.ts` - Server Actions for user registration
- `prisma/schema.prisma` - Database schema definition
- `prisma/dev.db` - SQLite development database

### Key Patterns
- Server Actions (`'use server'`) for form handling and mutations
- Client components (`'use client'`) use `useActionState` for form state management
- Path alias: `@/*` maps to `./src/*`
