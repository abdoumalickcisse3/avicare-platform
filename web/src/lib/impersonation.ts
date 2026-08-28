/**
 * Support-session marker.
 *
 * Kept in `sessionStorage`, not `localStorage`, and deliberately: a support session must not
 * survive the tab being closed. It also stashes the staff member's own token, so leaving the
 * session restores the console instead of stranding them logged out.
 */
const FLAG_KEY = "jawdi_impersonation";

export interface ImpersonationState {
  /** Who is being acted as, for the banner. */
  targetLabel: string;
  targetUserId: number;
  /** The farmer token that was in place before, if any, to put back on exit. */
  previousAccess: string | null;
  previousRefresh: string | null;
}

export const impersonation = {
  /**
   * The raw marker, as stored. Returned as a STRING because `useSyncExternalStore` compares
   * snapshots by reference: handing it a freshly parsed object on every call would re-render
   * forever.
   */
  raw(): string | null {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem(FLAG_KEY);
  },
  parse(raw: string | null): ImpersonationState | null {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ImpersonationState;
    } catch {
      // A corrupted marker must not strand anyone in an unlabelled support session.
      return null;
    }
  },
  read(): ImpersonationState | null {
    return impersonation.parse(impersonation.raw());
  },
  set(state: ImpersonationState): void {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(FLAG_KEY, JSON.stringify(state));
  },
  clear(): void {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(FLAG_KEY);
  },
};
