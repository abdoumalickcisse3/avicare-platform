/**
 * Config-driven navigation, in the UVDistribution.Mobile pattern — one source
 * of truth for the bottom tab bar (`TAB_ITEMS`) and the drawer (`DRAWER_ITEMS`,
 * with expandable sub-menus). lucide-react-native icons (same family as the
 * web). Adapted to Jawdi's role model: a platform ADMIN or farm OWNER is
 * "admin-like" and sees everything; other roles are gated by their per-farm
 * `resource:read` permission (same keys as the web sidebar).
 */
import {
  Bird,
  ClipboardList,
  Cog,
  Egg,
  FileText,
  HeartPulse,
  Home,
  LayoutGrid,
  Menu as MenuIcon,
  PackageOpen,
  Receipt,
  ShoppingCart,
  Sprout,
  Truck,
  Users,
  Wallet,
  Wheat,
  type LucideIcon,
} from 'lucide-react-native';

export type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Full expo-router route. Absent for pure groups (only children navigate). */
  route?: string;
  requiredPermission?: string;
  adminOnly?: boolean;
  /** Eligible for the bottom tab bar. */
  tab?: boolean;
  /** Screen built yet? Unbuilt items render disabled ("Bientôt"). */
  ready?: boolean;
  children?: NavItem[];
};

/** Bottom tab-bar destinations. */
export const TAB_ITEMS: NavItem[] = [
  { id: 'home', label: 'Accueil', icon: Home, route: '/(field)/(tabs)/home', tab: true, ready: true },
  { id: 'elevage', label: 'Élevage', icon: Bird, route: '/(field)/(tabs)/elevage', requiredPermission: 'poultry:read', tab: true, ready: true },
  { id: 'commerce', label: 'Commerce', icon: ShoppingCart, route: '/(field)/(tabs)/commerce', requiredPermission: 'commercial:read', tab: true, ready: true },
  { id: 'stocks', label: 'Stocks', icon: PackageOpen, route: '/(field)/(tabs)/stocks', requiredPermission: 'inventory:read', tab: true, ready: true },
  { id: 'menu', label: 'Menu', icon: MenuIcon, route: '/(field)/(tabs)/menu', tab: true, ready: true },
];

/** Drawer sections (admin-like tier), mirroring the web sidebar with sub-menus. */
export const DRAWER_ITEMS: NavItem[] = [
  { id: 'home', label: 'Accueil', icon: Home, route: '/(field)/(tabs)/home', ready: true },
  {
    id: 'elevage',
    label: 'Élevage',
    icon: Bird,
    requiredPermission: 'poultry:read',
    children: [
      { id: 'lots', label: 'Poulets de chair', icon: Bird, route: '/(field)/(tabs)/elevage', requiredPermission: 'poultry:read', ready: true },
      { id: 'oeufs', label: 'Œufs (ponte)', icon: Egg, route: '/(field)/oeufs', requiredPermission: 'poultry:read', ready: true },
      { id: 'sanitaire', label: 'Sanitaire', icon: HeartPulse, route: '/(field)/sanitaire', requiredPermission: 'health:read', ready: true },
    ],
  },
  {
    id: 'commerce',
    label: 'Commerce',
    icon: ShoppingCart,
    requiredPermission: 'commercial:read',
    children: [
      { id: 'clients', label: 'Clients', icon: Users, route: '/(field)/(tabs)/commerce', requiredPermission: 'commercial:read', ready: true },
      { id: 'ventes', label: 'Vente rapide', icon: Receipt, route: '/(field)/commerce/vente', requiredPermission: 'commercial:read', ready: true },
      { id: 'factures', label: 'Factures', icon: FileText, requiredPermission: 'commercial:read', ready: false },
    ],
  },
  {
    id: 'stocks',
    label: 'Stocks',
    icon: PackageOpen,
    requiredPermission: 'inventory:read',
    children: [
      { id: 'articles', label: 'Articles', icon: PackageOpen, route: '/(field)/(tabs)/stocks', requiredPermission: 'inventory:read', ready: true },
      { id: 'fournisseurs', label: 'Fournisseurs', icon: Truck, requiredPermission: 'inventory:read', ready: false },
      { id: 'formules', label: "Formules d'aliment", icon: Wheat, requiredPermission: 'inventory:read', ready: false },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: Wallet,
    requiredPermission: 'finance:read',
    children: [
      { id: 'depenses', label: 'Dépenses', icon: Receipt, requiredPermission: 'finance:read', ready: false },
      { id: 'analytique', label: 'Analytique', icon: ClipboardList, requiredPermission: 'finance:read', ready: false },
      { id: 'salaires', label: 'Salaires', icon: Users, requiredPermission: 'finance:read', ready: false },
    ],
  },
  { id: 'fermes', label: 'Fermes', icon: LayoutGrid, route: '/(field)', adminOnly: true, ready: true },
  { id: 'reglages', label: 'Réglages', icon: Cog, requiredPermission: 'settings:read', ready: false },
];

function isVisible(item: NavItem, isAdmin: boolean, can: (p: string) => boolean): boolean {
  if (item.adminOnly) return isAdmin;
  if (item.requiredPermission) return can(item.requiredPermission);
  return true;
}

/** Tab-bar destinations for the current access level (home first, capped at 5). */
export function getVisibleTabs(isAdmin: boolean, can: (p: string) => boolean): NavItem[] {
  const tabs = TAB_ITEMS.filter((i) => (i.id === 'menu' ? !isAdmin : isVisible(i, isAdmin, can)));
  return tabs.slice(0, 5);
}

/** Drawer sections for the current access level, with children filtered too. */
export function getDrawerItems(isAdmin: boolean, can: (p: string) => boolean): NavItem[] {
  return DRAWER_ITEMS.filter((i) => isVisible(i, isAdmin, can))
    .map((i) => (i.children ? { ...i, children: i.children.filter((c) => isVisible(c, isAdmin, can)) } : i))
    .filter((i) => !i.children || i.children.length > 0);
}

/** A detail screen keeps its parent tab highlighted (UVDistribution SCREEN_TO_TAB). */
export const SCREEN_TO_TAB: Record<string, string> = {
  lots: 'elevage',
  mortalite: 'elevage',
  oeufs: 'elevage',
  pesee: 'elevage',
  journalier: 'elevage',
  sanitaire: 'elevage',
  vaccination: 'elevage',
  observation: 'elevage',
  vente: 'commerce',
  '[clientId]': 'commerce',
  file: 'home',
};

/** Unused today but kept for parity with UVDistribution's leaf icon. */
export const LEAF_ICON: LucideIcon = Sprout;
