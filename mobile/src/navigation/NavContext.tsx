/**
 * Shares the drawer opener and the role/permission helpers from the tab layout
 * down to the screens' headers, so a screen can render the admin hamburger
 * without re-deriving the session.
 */
import { createContext, useContext } from 'react';

export type NavContextValue = {
  isAdmin: boolean;
  can: (permission: string) => boolean;
  openDrawer: () => void;
};

const NavContext = createContext<NavContextValue>({
  isAdmin: false,
  can: () => false,
  openDrawer: () => undefined,
});

export const NavProvider = NavContext.Provider;

export function useNav(): NavContextValue {
  return useContext(NavContext);
}
