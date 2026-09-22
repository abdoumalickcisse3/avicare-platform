/**
 * Custom bottom navigation bar, in the UVDistribution.Mobile pattern: the
 * visible tab bar (the native expo-router tab bar is hidden). Role-aware — it
 * renders only the destinations the current access level grants, via
 * `getVisibleTabs`. A detail screen keeps its parent tab active (SCREEN_TO_TAB).
 *
 * Hidden on the farm selector (before entering the tabs).
 */
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useSegments } from 'expo-router';
import { tokens } from '@/theme';
import { useFarmAccess } from '@/auth/useSession';
import { getVisibleTabs, SCREEN_TO_TAB, TAB_ITEMS } from '@/constants/navigation';

export function BottomNavBar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const segments = useSegments() as string[];
  const { isAdmin, farmRole } = useFarmAccess();

  const tabs = getVisibleTabs(farmRole, isAdmin);

  // Active tab: a tab id in the path, or a detail screen mapped to its tab.
  let active = '';
  for (const s of segments) {
    if (TAB_ITEMS.some((i) => i.id === s)) {
      active = s;
      break;
    }
    if (SCREEN_TO_TAB[s]) {
      active = SCREEN_TO_TAB[s];
      break;
    }
  }

  // Not inside the tabbed area (farm selector, auth) → no bar.
  const inTabs = segments.includes('(tabs)') || segments.some((s) => SCREEN_TO_TAB[s]);
  if (!inTabs) return null;

  const bottom = Math.max(insets.bottom, 8);

  return (
    <BlurView intensity={88} tint="systemChromeMaterialLight" style={[styles.bar, { paddingBottom: bottom }]}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        const Icon = tab.icon;
        const color = isActive ? tokens.colors.primary[600] : tokens.colors.neutral[500];
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.item}
            onPress={() => router.replace(tab.route as never)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            {/* Lucide has no separate filled glyph — the heavier stroke on the active tab is
                the closest analogue to iOS's outline→filled SF Symbol swap. */}
            <Icon size={24} color={color} strokeWidth={isActive ? 2.5 : 2} />
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60,60,67,0.29)',
    paddingTop: tokens.spacing[2],
    overflow: 'hidden',
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { ...tokens.typography.bodySm, fontSize: 11, fontWeight: '600' },
});
