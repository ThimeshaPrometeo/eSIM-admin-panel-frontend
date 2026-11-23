"use client";

/**
 * The one app context (spec 3, CONVENTIONS §3): signed-in user, role,
 * effective permissions, data mode, demo role switcher, unread
 * notifications, wallet summary, signIn / signOut / refresh.
 *
 * `dataVersion` goes up after every change; views that load data with
 * `useResource` refetch when it does. In demo mode every write to the store
 * bumps it, so an action on one page shows everywhere at once.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authApi, type LoginResult } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { IS_DEMO } from "@/lib/api/mode";
import { notificationsApi } from "@/lib/api/notifications";
import { getWalletSummary } from "@/lib/api/wallet-summary";
import { subscribe } from "@/lib/demo/store";
import type { Me, Role, WalletSummary } from "@/lib/platform/types";

type Status = "loading" | "signed_out" | "signed_in";

type PlatformValue = {
  status: Status;
  me: Me | null;
  isDemo: boolean;
  dataVersion: number;
  unread: number;
  wallet: WalletSummary | null;
  refresh: () => void;
  /** Reads the signed-in user again (after profile or 2FA changes; signed out if the session ended). */
  reloadMe: () => Promise<Me | null>;
  signIn: (username: string, password: string) => Promise<LoginResult>;
  verifyMfa: (code: string, method: "totp" | "recovery") => Promise<Me>;
  signInWithPasskey: () => Promise<Me>;
  signOut: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<Me>;
  switchRole: (role: Role) => Promise<Me>;
  resetDemo: () => Promise<void>;
};

const PlatformContext = createContext<PlatformValue | null>(null);

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<{ status: Status; me: Me | null }>({ status: "loading", me: null });
  const [dataVersion, setDataVersion] = useState(0);
  const [extras, setExtras] = useState<{ unread: number; wallet: WalletSummary | null }>({ unread: 0, wallet: null });

  const refresh = useCallback(() => setDataVersion((v) => v + 1), []);

  // demo store changes → refetch everywhere
  useEffect(() => (IS_DEMO ? subscribe(() => setDataVersion((v) => v + 1)) : undefined), []);

  const loadMe = useCallback(async () => {
    try {
      const me = await authApi.getMe();
      setAuth({ status: "signed_in", me });
      return me;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) setAuth({ status: "signed_out", me: null });
      else setAuth((a) => (a.status === "loading" ? { status: "signed_out", me: null } : a));
      return null;
    }
  }, []);

  // first load: who is signed in (state is set in the callbacks)
  useEffect(() => {
    authApi.getMe().then(
      (me) => setAuth({ status: "signed_in", me }),
      () => setAuth({ status: "signed_out", me: null }),
    );
  }, []);

  // unread count and wallet summary follow the data
  const signedIn = auth.status === "signed_in";
  const meId = auth.me?.id;
  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    Promise.all([notificationsApi.unreadCount().catch(() => 0), getWalletSummary().catch(() => null)]).then(([unread, wallet]) => {
      if (alive) setExtras({ unread, wallet });
    });
    return () => {
      alive = false;
    };
  }, [signedIn, meId, dataVersion]);

  const value = useMemo<PlatformValue>(
    () => ({
      status: auth.status,
      me: auth.me,
      isDemo: IS_DEMO,
      dataVersion,
      unread: signedIn ? extras.unread : 0,
      wallet: signedIn ? extras.wallet : null,
      refresh,
      reloadMe: loadMe,
      signIn: async (username, password) => {
        const r = await authApi.login({ username, password });
        if (!r.mfaRequired) setAuth({ status: "signed_in", me: r.me });
        return r;
      },
      verifyMfa: async (code, method) => {
        const me = await authApi.verifyMfa({ code, method });
        setAuth({ status: "signed_in", me });
        return me;
      },
      signInWithPasskey: async () => {
        const me = await authApi.passkeyLogin();
        setAuth({ status: "signed_in", me });
        return me;
      },
      signOut: async () => {
        await authApi.logout().catch(() => undefined);
        setAuth({ status: "signed_out", me: null });
      },
      changePassword: async (currentPassword, newPassword) => {
        const me = await authApi.changePassword({ currentPassword, newPassword });
        setAuth({ status: "signed_in", me });
        return me;
      },
      switchRole: async (role) => {
        const me = await authApi.switchDemoRole(role);
        setAuth({ status: "signed_in", me });
        refresh();
        return me;
      },
      resetDemo: async () => {
        await authApi.resetDemo();
        await loadMe();
        refresh();
      },
    }),
    [auth, dataVersion, extras, signedIn, refresh, loadMe],
  );

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform() {
  const v = useContext(PlatformContext);
  if (!v) throw new Error("usePlatform must be used inside PlatformProvider");
  return v;
}
