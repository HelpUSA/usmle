/*
 * File: src/app/providers.tsx
 *
 * Responsibility:
 * - Centralize global client-side providers for the application.
 * - Wrap the App Router tree with NextAuth SessionProvider.
 *
 * Why this file exists:
 * - App Router layouts are Server Components by default.
 * - SessionProvider is a Client Component.
 * - This wrapper keeps the root layout clean while enabling useSession(),
 *   signIn(), and signOut() across client-side pages/components.
 *
 * Current providers:
 * - NextAuth SessionProvider.
 *
 * Extension point:
 * - Add future global client-side providers here, such as:
 *   - ThemeProvider;
 *   - QueryClientProvider;
 *   - analytics/context providers.
 */

"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";

type ProvidersProps = {
  children: ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  return <SessionProvider>{children}</SessionProvider>;
}