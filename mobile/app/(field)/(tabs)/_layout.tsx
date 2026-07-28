/**
 * Tabs router — UVDistribution.Mobile pattern. The native tab bar is hidden
 * (`tabBarStyle: display none`); the VISIBLE bar is the custom `<BottomNavBar/>`
 * rendered by the parent `(field)/_layout`. Tabs are role-filtered via
 * `href: null`, so a role that can't reach a section can't deep-link to it.
 */
import { Tabs } from 'expo-router';
import { useFarmAccess } from '@/auth/useSession';
import { getVisibleTabs, TAB_ITEMS } from '@/constants/navigation';

export default function TabsLayout() {
  const { isAdmin, can } = useFarmAccess();
  const visible = getVisibleTabs(isAdmin, can).map((t) => t.id);

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' }, animation: 'shift' }}>
      {TAB_ITEMS.map((t) => (
        <Tabs.Screen key={t.id} name={t.id} options={{ href: visible.includes(t.id) ? undefined : null }} />
      ))}
    </Tabs>
  );
}
