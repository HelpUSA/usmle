"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type UserSettings = {
  confirmBeforeLeavingSession?: boolean;
};

type SessionsListResponse = {
  sessions?: Array<{
    session_id?: string;
    status?: string;
  }>;
};

const SETTINGS_STORAGE_KEY = "usmle_user_settings_v1";
const ACTIVE_SESSION_WARNING =
  "You have an active study session. Leave this page and abandon the current flow?";

function loadUserSettings(): UserSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { confirmBeforeLeavingSession: true };
    }

    const parsed = JSON.parse(raw) as UserSettings;
    return {
      confirmBeforeLeavingSession:
        typeof parsed?.confirmBeforeLeavingSession === "boolean"
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
    const sessions = Array.isArray(data?.sessions) ? data.sessions : [];

    return sessions.some((session) => session?.status === "in_progress");
  } catch {
    return false;
  }
}

export type ProtectedNavLinkProps = Omit<
  React.ComponentProps<typeof Link>,
  "onClick"
> & {
  children: React.ReactNode;
  confirmMessage?: string;
  requireSessionLeaveConfirm?: boolean;
  onAfterConfirmed?: () => void;
};

export default function ProtectedNavLink({
  children,
  href,
  confirmMessage = ACTIVE_SESSION_WARNING,
  requireSessionLeaveConfirm = true,
  onAfterConfirmed,
  ...props
}: ProtectedNavLinkProps) {
  const router = useRouter();
  const [isChecking, setIsChecking] = React.useState(false);

  const handleClick = React.useCallback(
    async (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (!requireSessionLeaveConfirm) {
        return;
      }

      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const settings = loadUserSettings();
      if (!settings.confirmBeforeLeavingSession) {
        return;
      }

      event.preventDefault();

      if (isChecking) {
        return;
      }

      setIsChecking(true);

      try {
        const shouldWarn = await hasActiveSession();

        if (!shouldWarn) {
          onAfterConfirmed?.();
          router.push(String(href));
          return;
        }

        const confirmed = window.confirm(confirmMessage);
        if (!confirmed) {
          return;
        }

        onAfterConfirmed?.();
        router.push(String(href));
      } finally {
        setIsChecking(false);
      }
    },
    [
      confirmMessage,
      href,
      isChecking,
      onAfterConfirmed,
      requireSessionLeaveConfirm,
      router,
    ]
  );

  return (
    <Link href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}