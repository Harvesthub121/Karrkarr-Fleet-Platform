'use client';

import { useContext, createContext, type ReactNode, useState, useEffect } from 'react';
import { ROLE_PERMISSIONS, type Permission } from '@karrkarr/shared';
import type { AdminRoleName, AuthedAdmin } from '@karrkarr/shared';

// ---------------------------------------------------------------------------
// Session context
// ---------------------------------------------------------------------------

interface SessionCtx {
  user: AuthedAdmin | null;
  setUser: (u: AuthedAdmin | null) => void;
}

export const SessionContext = createContext<SessionCtx>({
  user: null,
  setUser: () => {},
});

// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the given role has the given permission.
 * This is a pure function so it can be used outside React (e.g. middleware mock).
 */
export function roleHasPermission(role: AdminRoleName, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}

/**
 * Hook: returns whether the current session user has a permission.
 * Defaults to false when no session exists.
 */
export function useCan(permission: Permission): boolean {
  const { user } = useContext(SessionContext);
  if (!user) return false;
  return roleHasPermission(user.role, permission);
}

/**
 * Hook: returns all permissions for the current user.
 */
export function usePermissions(): Permission[] {
  const { user } = useContext(SessionContext);
  if (!user) return [];
  return (ROLE_PERMISSIONS[user.role] ?? []) as Permission[];
}

// ---------------------------------------------------------------------------
// Can component — declarative gate
// ---------------------------------------------------------------------------

interface CanProps {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}

export function Can({ permission, children, fallback = null }: CanProps) {
  const allowed = useCan(permission);
  return allowed ? (children as React.ReactElement) : (fallback as React.ReactElement | null);
}

// ---------------------------------------------------------------------------
// Session provider
// ---------------------------------------------------------------------------

interface SessionProviderProps {
  children: ReactNode;
  initial?: AuthedAdmin | null;
}

export function SessionProvider({ children, initial = null }: SessionProviderProps) {
  const [user, setUser] = useState<AuthedAdmin | null>(initial);
  return (
    <SessionContext.Provider value={{ user, setUser }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
