---
trigger: always_on
---

# Antigravity Instruction: Next.js + Turborepo Project Guidelines

You are an expert AI assistant tasked with building and maintaining a Next.js web application. You MUST strictly adhere to the following technological stack, architecture, and coding conventions when writing, refactoring, or reviewing code.

## 1. Technological Stack

- **Framework:** Next.js (App Router, version 16+)
- **Language:** TypeScript (`strict` typechecking)
- **Styling:** Tailwind CSS v4, PostCSS, Radix UI Primitives (`@radix-ui/*`), `lucide-react` for icons. UI elements often compiled inside `components/ui/` natively (e.g. shadcn/ui approach).
- **State Management:** Jotai (for atom-based global state)
- **Data Fetching:** `@tanstack/react-query` for client-side state, Next.js native `fetch` config for SSR.
- **Internationalization (i18n):** `next-intl`
- **Markdown Rendering:** `react-markdown`, `remark-*`, `rehype-*` ecosystem (GFM, katex, prism/highlight.js).
- **Charts:** `recharts`
- **Process Management:** PM2 (for production deployment).
- **Workspace:** Monorepo using `Turborepo` (dependencies often prefixed with `@repo/*` such as `@repo/ui`, `@repo/axios`).

## 2. Directory Structure & Architecture

Maintain exactly this directory structure for the Next.js app:

```text
/
├── apis/            # Shared, client-side, and external fetch wrappers (e.g. axios calls).
├── app/             # Next.js App Router (Pages, Layouts, Server Configs).
│   ├── actions/     # Next.js Server Actions (for mutations and server-only logics).
│   ├── api/         # Next.js Route Handlers (for REST endpoints responding to client/external).
│   └── [routes]/    # Page and layout components (e.g. `blog/`, `dashboard/`).
├── components/      # Reusable UI/View components. Grouped by domain or feature (UI atoms go in `components/ui/`).
├── hooks/           # Custom React hooks.
├── lib/             # Third-party library initializations and core light wrappers (e.g., `utils.ts` for `cn` logic).
├── utils/           # Business logic, helpers, formatting (e.g. `breakpoints.ts`, `mouseevents.ts`).
├── types/           # Global TypeScript type definitions and interfaces.
├── i18n/            # Internationalization setup configurations.
├── messages/        # Translation JSON dictionaries (e.g. `en.json`, `ko.json`).
├── styles/          # Global styles (e.g. `globals.css`).
├── public/          # Static assets (images, fonts).
└── docs/            # Project-specific documentation.
```

## 3. Naming Conventions & Rules

When creating new files or modifying existing ones, rigorously follow these naming conventions:

- **React Components:** PascalCase for component files (e.g., `TableOfContents.tsx`, `MainPage.tsx`), though lower-case kebab-case is acceptable for highly generic UI elements (e.g., `nav-main.tsx`). Check the exact domain before deciding.
- **Hooks:** CamelCase with a `.hook.ts` suffix (e.g., `useTrailingCursor.hook.ts`, `useIsMobile.hook.ts`).
- **React Query Clients:** `.query.client.ts` suffix (e.g., `useFinancialData.query.client.ts`).
- **API Fetchers:** `.api.ts` suffix for real APIs, `.mock.api.ts` for mock APIs (e.g., `getFinancialData.mock.api.ts`).
- **Environment Variables:** Must be explicitly mapped and validated, usually backed by an `env.schema.ts`.
- **Path Aliasing:** Always use `@/*` to resolve imports from the root (configured in `tsconfig.json`). Never use long relative paths (e.g., `../../components`). Example: `import { cn } from '@/lib/utils'`.

## 4. Component Rules

- Default to **Server Components**. Only use `"use client"` when interactivity (hooks, state, browser APIs) or client-side libraries (like `framer-motion` or Context providers) are strictly required.
- Do not bloat Server Components with direct API requests that block rendering unnecessarily. Use appropriate `Suspense` boundaries for data fetching.
- Use `Jotai` for client side shared state where React Context is too heavy. Keep atoms small and segmented.
- Wrap complex client fetching logic in custom hooks leveraging `useQuery` or `useMutation` from React Query inside the `hooks/` directory.

## 5. Styling Rules

- Use generic Tailwind CSS v4 patterns.
- Merge classes using the `cn` utility (combining `clsx` and `tailwind-merge`) exported from `@/lib/utils`.
- Rely entirely on CSS Variables provided in `tailwind.config.ts` mapping to `@/styles/globals.css` for semantic themes, particularly dark mode (`darkMode: 'class'`).
