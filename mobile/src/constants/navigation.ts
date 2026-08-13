/**
 * Config-driven navigation — a faithful port of the web sidebar
 * (`web/src/components/layout/Sidebar.tsx`). One source of truth for the bottom
 * tab bar (`TAB_ITEMS`) and the drawer / Menu tab (`DRAWER_ITEMS`).
 *
 * Model (like the web): the four **modules** — Élevage, Stocks, Commercial,
 * Finance — are collapsible GROUPS, each gated by a `requiredPermission` and
 * expanding into its actual pages (the real "menus"). Élevage leaves are also
 * filtered by the farm's production `focusToken` (broiler/layer, Décision 17).
 * Leaves (Tableau de bord, Fermes [OWNER], Réglages) always render.
 *
 * Module gating (`requiredModule`) is kept for parity with the web, but under
 * ADR-009 every farm auto-gets all V1 modules, so it is not evaluated here
 * (all modules active) — only permission + focus + ownerOnly gate the tree.
 *
 * `ready: false` pages render disabled ("Bientôt"), exactly like the web's
 * "bientôt" leaves — flipped on as each mobile screen is built.
 */
import {
  BookOpen,
  ClipboardList,
  Cog,
  Egg,
  FileText,
  HeartPulse,
  Home,
  LayoutGrid,
  Bird,
  Menu as MenuIcon,
  PackageOpen,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Sprout,
  TrendingUp,
  Truck,
  User,
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
  /** Parity with the web; not evaluated (ADR-009: all V1 modules active). */
  requiredModule?: string;
  requiredPermission?: string;
  /** Visible only to a platform ADMIN / farm OWNER (Fermes). */
  adminOnly?: boolean;
  /** Élevage focus filter: hidden unless the farm's focus includes this token. */
  focusToken?: 'broiler' | 'layer';
  /** Eligible for the bottom tab bar. */
  tab?: boolean;
  /** Screen built yet? Unbuilt items render disabled ("Bientôt"). */
  ready?: boolean;
  children?: NavItem[];
};

/**
 * All possible bottom-tab destinations, keyed by id. The bottom bar is NOT the
 * union of these — each role shows its own fixed set (`ROLE_TAB_IDS`); anything
 * else a role can reach lives in the Profil/drawer (getDrawerItems), so extra
 * grants never crowd the bar.
 */
export const TAB_ITEMS: NavItem[] = [
  { id: 'home', label: 'Accueil', icon: Home, route: '/(field)/(tabs)/home', tab: true, ready: true },
  { id: 'fermes', label: 'Fermes', icon: LayoutGrid, route: '/(field)/fermes', tab: true, ready: true },
  { id: 'elevage', label: 'Poulets', icon: Bird, route: '/(field)/(tabs)/elevage', tab: true, ready: true },
  { id: 'oeufs', label: 'Œufs', icon: Egg, route: '/(field)/oeufs', tab: true, ready: true },
  { id: 'sanitaire', label: 'Sanitaire', icon: HeartPulse, route: '/(field)/sanitaire', tab: true, ready: true },
  { id: 'commerce', label: 'Commerce', icon: ShoppingCart, route: '/(field)/(tabs)/commerce', tab: true, ready: true },
  { id: 'stocks', label: 'Stock', icon: PackageOpen, route: '/(field)/(tabs)/stocks', tab: true, ready: true },
  { id: 'finance', label: 'Finance', icon: Wallet, route: '/(field)/finance', tab: true, ready: true },
  { id: 'reglages', label: 'Réglages', icon: Cog, route: '/(field)/reglages', tab: true, ready: true },
  { id: 'profil', label: 'Profil', icon: User, route: '/(field)/(tabs)/menu', tab: true, ready: true },
];

const TAB_BY_ID: Record<string, NavItem> = Object.fromEntries(TAB_ITEMS.map((t) => [t.id, t]));

/**
 * Fixed bottom-bar set per farm role (the user's spec). Anything a role can also
 * reach shows up in the drawer, not the bar. Platform ADMIN / farm OWNER share
 * the OWNER set and reach the drawer via the header hamburger (so no Profil tab);
 * the other roles carry a Profil tab for drawer/settings access.
 */
const ROLE_TAB_IDS: Record<string, string[]> = {
  OWNER: ['home', 'fermes', 'stocks', 'finance', 'reglages'],
  MANAGER: ['home', 'stocks', 'commerce', 'finance', 'profil'],
  FARMER: ['home', 'elevage', 'oeufs', 'sanitaire', 'profil'],
  VETERINARIAN: ['home', 'elevage', 'sanitaire', 'profil'],
};

/**
 * Drawer / Menu sections — a 1:1 mirror of the web sidebar `NAV`. Module groups
 * expand into their pages; unbuilt pages are `ready: false`.
 */
export const DRAWER_ITEMS: NavItem[] = [
  { id: 'home', label: 'Tableau de bord', icon: Home, route: '/(field)/(tabs)/home', ready: true },
  { id: 'fermes', label: 'Fermes', icon: LayoutGrid, route: '/(field)/fermes', adminOnly: true, ready: true },
  {
    id: 'elevage',
    label: 'Élevage',
    icon: Bird,
    requiredModule: 'module.poultry.broiler',
    requiredPermission: 'poultry:read',
    children: [
      { id: 'lots', label: 'Poulets de chair', icon: Bird, route: '/(field)/(tabs)/elevage', requiredModule: 'module.poultry.broiler', requiredPermission: 'poultry:read', focusToken: 'broiler', ready: true },
      { id: 'oeufs', label: 'Œufs', icon: Egg, route: '/(field)/oeufs', requiredModule: 'module.poultry.layer', requiredPermission: 'poultry:read', focusToken: 'layer', ready: true },
      { id: 'sanitaire', label: 'Sanitaire', icon: HeartPulse, route: '/(field)/sanitaire', requiredPermission: 'health:read', ready: true },
    ],
  },
  {
    id: 'stocks',
    label: 'Stocks',
    icon: PackageOpen,
    requiredModule: 'module.inventory',
    requiredPermission: 'inventory:read',
    children: [
      { id: 'stocks-overview', label: "Vue d'ensemble", icon: LayoutGrid, route: '/(field)/(tabs)/stocks', requiredPermission: 'inventory:read', ready: true },
      { id: 'articles', label: 'Bibliothèque', icon: BookOpen, route: '/(field)/stocks/bibliotheque', requiredPermission: 'inventory:read', ready: true },
      { id: 'fournisseurs', label: 'Fournisseurs', icon: Truck, route: '/(field)/stocks/fournisseurs', requiredPermission: 'inventory:read', ready: true },
      { id: 'achats', label: "Bons d'achat", icon: ClipboardList, route: '/(field)/stocks/achats', requiredPermission: 'inventory:read', ready: true },
      { id: 'formules', label: "Formules d'aliment", icon: Wheat, route: '/(field)/stocks/formules', requiredPermission: 'inventory:read', ready: true },
    ],
  },
  {
    id: 'commercial',
    label: 'Commercial',
    icon: ShoppingCart,
    requiredModule: 'module.commercial.basic',
    requiredPermission: 'commercial:read',
    children: [
      { id: 'clients', label: 'Clients', icon: Users, route: '/(field)/(tabs)/commerce', requiredPermission: 'commercial:read', ready: true },
      { id: 'commandes', label: 'Commandes', icon: ShoppingBag, route: '/(field)/commerce/commandes', requiredPermission: 'commercial:read', ready: true },
      { id: 'ventes', label: 'Ventes', icon: Receipt, route: '/(field)/commerce/ventes', requiredPermission: 'commercial:read', ready: true },
      { id: 'factures', label: 'Factures', icon: FileText, route: '/(field)/commerce/factures', requiredPermission: 'commercial:read', ready: true },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: Wallet,
    requiredModule: 'module.finance',
    requiredPermission: 'finance:read',
    children: [
      { id: 'depenses', label: 'Dépenses', icon: Receipt, route: '/(field)/finance', requiredPermission: 'finance:read', ready: true },
      { id: 'salaires', label: 'Salaires', icon: Users, route: '/(field)/finance', requiredPermission: 'finance:read', ready: true },
      { id: 'analytique', label: 'Analytique', icon: TrendingUp, requiredPermission: 'finance:read', ready: false },
    ],
  },
  { id: 'reglages', label: 'Réglages', icon: Cog, route: '/(field)/reglages', requiredPermission: 'settings:read', ready: true },
];

/** Web `childVisible`: permission + focus (module always active per ADR-009). */
function isVisible(item: NavItem, isAdmin: boolean, can: (p: string) => boolean, focus: string[]): boolean {
  if (item.adminOnly) return isAdmin;
  if (item.requiredPermission && !can(item.requiredPermission)) return false;
  if (item.focusToken && focus.length > 0 && !focus.includes(item.focusToken)) return false;
  return true;
}

/**
 * The fixed bottom-bar set for the current farm role (the user's per-role spec).
 * Platform ADMIN / farm OWNER get the OWNER set; unknown roles fall back to
 * FARMER. Tabs whose screen isn't built yet (`ready:false`) are filtered out
 * until they ship. Capped at 5.
 */
export function getVisibleTabs(farmRole: string | undefined, isAdmin: boolean): NavItem[] {
  const roleKey = isAdmin ? 'OWNER' : farmRole && ROLE_TAB_IDS[farmRole] ? farmRole : 'FARMER';
  const ids = ROLE_TAB_IDS[roleKey] ?? ROLE_TAB_IDS.FARMER!;
  return ids
    .map((id) => TAB_BY_ID[id])
    .filter((t): t is NavItem => !!t && t.ready !== false)
    .slice(0, 5);
}

/** Drawer sections for the current access level, with children filtered too (permission + focus). */
export function getDrawerItems(
  isAdmin: boolean,
  can: (p: string) => boolean,
  focus: string[] = [],
): NavItem[] {
  return DRAWER_ITEMS.filter((i) => isVisible(i, isAdmin, can, focus))
    .map((i) => (i.children ? { ...i, children: i.children.filter((c) => isVisible(c, isAdmin, can, focus)) } : i))
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
  ventes: 'commerce',
  fournisseurs: 'stocks',
  achats: 'stocks',
  'achat-nouveau': 'stocks',
  bibliotheque: 'stocks',
  formules: 'stocks',
  factures: 'commerce',
  commandes: 'commerce',
  'commande-nouvelle': 'commerce',
  finance: 'finance',
  fermes: 'fermes',
  reglages: 'reglages',
  '[category]': 'reglages',
  '[clientId]': 'commerce',
  '[id]': 'commerce',
  file: 'home',
};

/** Unused today but kept for parity with UVDistribution's leaf icon. */
export const LEAF_ICON: LucideIcon = Sprout;
