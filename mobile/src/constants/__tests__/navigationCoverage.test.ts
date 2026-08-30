/**
 * Every screen must be reachable, and must keep its navigation bar.
 *
 * These are two different guarantees, and conflating them is exactly how `(field)/file.tsx`
 * — the queue screen, complete and tested — sat unreachable for months while appearing in
 * `SCREEN_TO_TAB`. That map only keeps the bottom bar highlighted; it links to nothing.
 *
 * So this file asserts both:
 *
 * 1. **Reachability** — a screen is listed in the tabs or the drawer, or some other screen
 *    navigates to it, or it is explicitly excused below with a reason.
 * 2. **Bar continuity** — a `(field)` stack screen absent from `SCREEN_TO_TAB` renders with
 *    no bottom bar at all, stranding whoever lands on it.
 *
 * The parity effort adds many screens. Without this, the same omission repeats in series.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { DRAWER_ITEMS, SCREEN_TO_TAB, TAB_ITEMS, type NavItem } from '../navigation';

const MOBILE_ROOT = join(__dirname, '..', '..', '..');
const FIELD_ROOT = join(MOBILE_ROOT, 'app', '(field)');

/**
 * Screens nothing links to, on purpose. Each entry states why, so an exception stays an
 * argued decision rather than a silent omission — which is the failure this file exists for.
 */
const INTENTIONALLY_UNLISTED: Record<string, string> = {
  '/(field)':
    'Farm selector (index). Reached by redirect from the splash and from any screen that finds no farm selected.',
};

/**
 * Screens that deliberately render without the bottom bar. Both are destinations you leave
 * by going back, not places you navigate onward from — a bar there would offer a way out
 * that discards what the screen is for.
 */
const INTENTIONALLY_BARLESS: Record<string, string> = {
  '/(field)':
    'Farm selector: shown before entering the app, when no farm is chosen and the bar has nothing to point at.',
  '/(field)/assistant':
    'Full-screen assistant: a conversation with a live microphone, where a stray tab tap would drop the turn in progress.',
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === '__tests__' ? [] : walk(full);
    }
    return entry.endsWith('.tsx') && entry !== '_layout.tsx' ? [full] : [];
  });
}

/**
 * `app/(field)/lots/[unitId]/pesee.tsx` → `/(field)/lots/[unitId]/pesee`
 *
 * Expo Router serves `index.tsx` at its folder's route, so `lots/index.tsx` is `/lots` —
 * that is the string a `router.push` will carry.
 */
function routeOf(file: string): string {
  const rel = relative(join(MOBILE_ROOT, 'app'), file).replace(/\.tsx$/, '');
  return `/${rel}`.replace(/\/index$/, '');
}

function flattenNav(items: NavItem[]): NavItem[] {
  return items.flatMap((item) => [item, ...flattenNav(item.children ?? [])]);
}

const NAV_ROUTES = new Set(
  [...TAB_ITEMS, ...flattenNav(DRAWER_ITEMS)].map((item) => item.route).filter(Boolean),
);

/** Every source file that could hold a navigation call. */
const SOURCES = [walk(join(MOBILE_ROOT, 'app')), walk(join(MOBILE_ROOT, 'src'))]
  .flat()
  .concat(
    readdirSync(join(MOBILE_ROOT, 'src', 'constants'))
      .filter((f) => f.endsWith('.ts'))
      .map((f) => join(MOBILE_ROOT, 'src', 'constants', f)),
  )
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');

/**
 * A route with `[param]` segments is pushed as a template literal, so match the shape rather
 * than the literal string: `/(field)/lots/[unitId]/pesee` matches
 * `` router.push(`/(field)/lots/${unitId}/pesee`) ``.
 */
function isNavigatedTo(route: string): boolean {
  const pattern = route
    .split('/')
    .map((segment) =>
      segment.startsWith('[')
        ? '[^/`\'"]+'
        : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('/');
  if (new RegExp(pattern).test(SOURCES)) return true;

  // A folder pushed with a computed last segment — `router.push(`/(field)/reglages/${slug}`)`
  // — reaches every static child of that folder, because Expo Router resolves a static file
  // before the `[param]` sibling. Matching only the literal string would call those screens
  // unreachable while a farmer opens them daily.
  const parent = route.slice(0, route.lastIndexOf('/'));
  if (!parent) return false;
  const escapedParent = parent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escapedParent}/\\$\\{`).test(SOURCES);
}

const SCREENS = walk(FIELD_ROOT).map(routeOf);

describe('navigation coverage', () => {
  it('finds the field screens (a sweep that matched nothing would pass forever)', () => {
    expect(SCREENS.length).toBeGreaterThan(20);
    expect(SCREENS).toContain('/(field)/file');
    expect(SCREENS).toContain('/(field)/lots');
  });

  it.each(SCREENS)('%s is reachable', (route) => {
    const reason = INTENTIONALLY_UNLISTED[route];
    if (reason) {
      expect(reason.length).toBeGreaterThan(20);
      return;
    }

    const listed = NAV_ROUTES.has(route);
    const linked = isNavigatedTo(route);

    // A screen nobody can open is a screen that does not exist — however complete it is.
    expect(listed || linked).toBe(true);
  });

  it.each(SCREENS)('%s keeps a navigation bar', (route) => {
    const reason = INTENTIONALLY_BARLESS[route];
    if (reason) {
      expect(reason.length).toBeGreaterThan(20);
      return;
    }

    const segments = route.split('/').filter(Boolean);
    const inTabs = segments.includes('(tabs)');
    const mapped = segments.some((segment) => segment in SCREEN_TO_TAB);

    // `BottomNavBar` computes its visibility exactly this way; an unmapped stack screen
    // renders with no bar and strands whoever lands on it.
    expect(inTabs || mapped).toBe(true);
  });

  it('excuses only screens that still exist', () => {
    // An allowlist outliving its screen quietly weakens the guard.
    for (const route of [
      ...Object.keys(INTENTIONALLY_UNLISTED),
      ...Object.keys(INTENTIONALLY_BARLESS),
    ]) {
      expect(SCREENS).toContain(route);
    }
  });
});
