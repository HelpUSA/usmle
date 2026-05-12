/*
 * File: src/app/ProtectedNavLink.tsx
 *
 * Responsibility:
 * - Provide a protected internal navigation link for the global app shell.
 * - Respect the user's local confirmBeforeLeavingSession preference.
 * - Warn before leaving an active session route when there is an in_progress session.
 *
 * Important behavior:
 * - External links should not use this component.
 * - Normal browser behaviors are preserved:
 *   - open in new tab;
 *   - ctrl/cmd click;
 *   - shift click;
 *   - already-prevented events.
 * - The warning is intentionally limited to current routes under /session.
 */

"use client";

import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type LinkHref = ComponentProps<typeof Link>["href"];

type UserSettings = {
  confirmBeforeLeavingSession?: boolean;
};

type SessionsListResponse = {
  sessions?: Array<{
    session_id?: string;
    status?: string;
  }>;
};

export type ProtectedNavLinkProps = Omit<ComponentProps<typeof Link>, "onClick"> & {
  children: ReactNode;
  confirmMessage?: string;
  requireSessionLeaveConfirm?: boolean;
  onAfterConfirmed?: () => void;
};

const SETTINGS_STORAGE_KEY = "usmle_user_settings_v1";

const ACTIVE_SESSION_WARNING =
  "You have an active study session. Leave this page and abandon the current flow?";

function loadUserSettings(): UserSettings {
  if (typeof window === "undefined") {
    return { confirmBeforeLeavingSession: true };
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);

    if (!raw) {
      return { confirmBeforeLeavingSession: true };
    }

    const parsed = JSON.parse(raw) as UserSettings;

    return {
      confirmBeforeLeavingSession:
        typeof parsed.confirmBeforeLeavingSession === "boolean"
          ? parsed.confirmBeforeLeavingSession
          : true,
    };
  } catch {
    return { confirmBeforeLeavingSession: true };
  }
}

async function hasActiveSession(): Promise<boolean> {
  try {
    const res = await fetch("/api/sessions", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      credentials: "same-origin",
      cache: "no-store",
    });

    if (!res.ok) {
      return false;
    }

    const data = (await res.json()) as SessionsListResponse;
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];

    return sessions.some((session) => session.status === "in_progress");
  } catch {
    return false;
  }
}

function isModifiedNavigationClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

function isSessionRoute(pathname: string | null): boolean {
  return Boolean(pathname && pathname.startsWith("/session/"));
}

function normalizeHref(href: LinkHref): string {
  if (typeof href === "string") {
    return href;
  }

  const pathname = href.pathname ?? "";

  const queryParams = new URLSearchParams();

  if (href.query) {
    for (const [key, value] of Object.entries(href.query)) {
      if (value === undefined) {
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          queryParams.append(key, String(item));
        }
      } else {
        queryParams.set(key, String(value));
      }
    }
  }

  const query = queryParams.toString();
  const hash = href.hash
    ? href.hash.startsWith("#")
      ? href.hash
      : `#${href.hash}`
    : "";

  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

export default function ProtectedNavLink({
  children,
  href,
  confirmMessage = ACTIVE_SESSION_WARNING,
  requireSessionLeaveConfirm = true,
  onAfterConfirmed,
  ...props
}: ProtectedNavLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(false);

  const targetHref = useMemo(() => normalizeHref(href), [href]);

  const shouldProtectCurrentRoute = useMemo(() => {
    return requireSessionLeaveConfirm && isSessionRoute(pathname);
  }, [pathname, requireSessionLeaveConfirm]);

  const handleClick = useCallback(
    async (event: MouseEvent<HTMLAnchorElement>) => {
      if (!shouldProtectCurrentRoute) {
        return;
      }

      if (isModifiedNavigationClick(event)) {
        return;
      }

      const settings = loadUserSettings();

      if (!settings.confirmBeforeLeavingSession) {
        return;
      }

      if (pathname === targetHref) {
        return;
      }

      event.preventDefault();

      if (isChecking) {
        return;
      }

      setIsChecking(true);

      try {
        const shouldWarn = await hasActiveSession();

        if (shouldWarn) {
          const confirmed = window.confirm(confirmMessage);

          if (!confirmed) {
            return;
          }
        }

        onAfterConfirmed?.();
        router.push(targetHref);
      } finally {
        setIsChecking(false);
      }
    },
    [
      confirmMessage,
      isChecking,
      onAfterConfirmed,
      pathname,
      router,
      shouldProtectCurrentRoute,
      targetHref,
    ]
  );

  return (
    <Link
      href={href}
      onClick={handleClick}
      aria-disabled={isChecking ? true : undefined}
      {...props}
    >
      {children}
    </Link>
  );
}