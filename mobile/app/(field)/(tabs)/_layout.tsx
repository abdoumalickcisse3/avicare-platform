/**
 * Tabs router — UVDistribution.Mobile pattern. The native tab bar is hidden
 * (`tabBarStyle: display none`); the VISIBLE bar is the custom `<BottomNavBar/>`
 * rendered by the parent `(field)/_layout`, which shows a fixed set per role
 * (see `getVisibleTabs`). Here we only register the physical `(tabs)/` screen
 * files and null out the `href` of any a role can't reach, so they can't be
 * deep-linked. Role destinations that live OUTSIDE `(tabs)` (Œufs, Sanitaire)
 * are Stack screens of `(field)` — the bar routes to them directly.
 */
import { Tabs } from 'expo-router';
import { useFarmAccess } from '@/auth/useSession';

/** The physical files under `app/(field)/(tabs)/`, with the permission that reaches each. */
const TAB_FILES: { name: string; permission?: string }[] = [
  { name: 'home' },
  { name: 'elevage', permission: 'poultry:read' },
  { name: 'commerce', permission: 'commercial:read' },
  { name: 'stocks', permission: 'inventory:read' },
  { name: 'menu' },
];

export default function TabsLayout() {
  const { isAdmin, can } = useFarmAccess();

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' }, animation: 'shift' }}>
      {TAB_FILES.map((t) => {
        const reachable = isAdmin || !t.permission || can(t.permission);
        return <Tabs.Screen key={t.name} name={t.name} options={{ href: reachable ? undefined : null }} />;
      })}
    </Tabs>
  );
}
