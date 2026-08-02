/**
 * Full-menu drawer — rebuilt to match UVDistribution.Mobile's DrawerOverlay:
 * an animated slide-in with a profile header (initials avatar + name + role +
 * close), a scrollable list of sections with EXPANDABLE sub-menus (chevron,
 * indented children, rounded icon boxes), and a version footer. A plain
 * Animated overlay — no @react-navigation/drawer (lighter for low-end Android).
 *
 * Shown only to the admin-like tier via the header hamburger. Colours are
 * mapped onto Jawdi's brand tokens; icons are lucide-react-native.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { ChevronDown, ChevronRight, X } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useFarmAccess } from '@/auth/useSession';
import { getDrawerItems, type NavItem } from '@/constants/navigation';
import { roleLabel } from '@/constants/roles';
import { useListFarmsQuery } from '@/store/api/farmsApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 340);

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'JW'
  );
}

export function DrawerOverlay({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { isAdmin, can, farmRole } = useFarmAccess();
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { data: farms } = useListFarmsQuery();
  const selectedFarm = farms?.find((f) => f.id === selectedFarmId);
  const farmName = selectedFarm?.name ?? 'Ferme';

  const items = getDrawerItems(isAdmin, can, selectedFarm?.productionFocus ?? []);
  const [expanded, setExpanded] = useState<string[]>([]);

  const slide = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, { toValue: visible ? 0 : -DRAWER_WIDTH, duration: 250, useNativeDriver: true }),
      Animated.timing(fade, { toValue: visible ? 1 : 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [visible, slide, fade]);

  const toggleExpand = (id: string) => setExpanded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const navigateTo = (route?: string, ready?: boolean) => {
    if (!route || !ready) return;
    onClose();
    router.push(route as never);
  };

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const hasChildren = !!item.children && item.children.length > 0;
    const isExpanded = expanded.includes(item.id);
    return (
      <View key={item.id}>
        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.6}
          onPress={() => (hasChildren ? toggleExpand(item.id) : navigateTo(item.route, item.ready))}
          accessibilityRole="button"
          accessibilityLabel={item.label}
        >
          <View style={styles.menuIconBox}>
            <Icon size={20} color={tokens.colors.neutral[700]} />
          </View>
          <Text style={styles.menuLabel}>{item.label}</Text>
          {hasChildren ? (
            isExpanded ? <ChevronDown size={16} color={tokens.colors.neutral[500]} /> : <ChevronRight size={16} color={tokens.colors.neutral[500]} />
          ) : !item.ready ? (
            <Text style={styles.soon}>Bientôt</Text>
          ) : null}
        </TouchableOpacity>

        {hasChildren && isExpanded && (
          <View style={styles.childrenContainer}>
            {item.children!.map((child) => {
              const ChildIcon = child.icon;
              return (
                <TouchableOpacity
                  key={child.id}
                  style={styles.childItem}
                  activeOpacity={0.6}
                  disabled={!child.ready}
                  onPress={() => navigateTo(child.route, child.ready)}
                  accessibilityRole="button"
                  accessibilityLabel={child.label}
                >
                  <ChildIcon size={16} color={child.ready ? tokens.colors.primary[600] : tokens.colors.neutral[400]} />
                  <Text style={[styles.childLabel, !child.ready && styles.disabled]}>{child.label}</Text>
                  {!child.ready && <Text style={styles.soon}>Bientôt</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: fade }]} />
      </TouchableWithoutFeedback>

      <Animated.View style={[styles.drawer, { width: DRAWER_WIDTH, transform: [{ translateX: slide }] }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.profileRow}
            activeOpacity={0.7}
            onPress={() => {
              onClose();
              router.push('/(field)/(tabs)/menu');
            }}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initialsOf(farmName)}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>{farmName}</Text>
              <Text style={styles.profileRole}>{roleLabel(farmRole, isAdmin)}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Fermer">
            <X size={20} color={tokens.colors.neutral[600]} />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <ScrollView contentContainerStyle={styles.menuList} showsVerticalScrollIndicator={false}>
          {items.map(renderItem)}
        </ScrollView>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Jawdi Mobile v1.0.0</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(12,10,9,0.45)' },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    paddingTop: Platform.OS === 'ios' ? 52 : 28,
    backgroundColor: tokens.colors.neutral[0],
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.15, shadowRadius: 12 },
      android: { elevation: 16 },
    }),
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: tokens.spacing[4], paddingVertical: tokens.spacing[4] },
  profileRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.primary[700], alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...tokens.typography.headingMd, color: tokens.colors.neutral[0], fontSize: 16, fontWeight: '700' },
  profileInfo: { marginLeft: tokens.spacing[3], flex: 1 },
  profileName: { ...tokens.typography.headingMd, fontSize: 15, color: tokens.colors.field.text },
  profileRole: { ...tokens.typography.bodySm, color: tokens.colors.neutral[600], marginTop: 1 },
  closeBtn: { width: 32, height: 32, borderRadius: tokens.radii.md, backgroundColor: tokens.colors.neutral[100], alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, backgroundColor: tokens.colors.neutral[100] },
  menuList: { paddingHorizontal: tokens.spacing[3], paddingBottom: tokens.spacing[5] },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: tokens.spacing[3], paddingHorizontal: tokens.spacing[2], borderRadius: tokens.radii.md },
  menuIconBox: { width: 36, height: 36, borderRadius: tokens.radii.md, backgroundColor: tokens.colors.neutral[100], alignItems: 'center', justifyContent: 'center', marginRight: tokens.spacing[3] },
  menuLabel: { flex: 1, ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.field.text },
  childrenContainer: { paddingLeft: 56, paddingBottom: 4 },
  childItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 10 },
  childLabel: { flex: 1, ...tokens.typography.bodyMd, color: tokens.colors.neutral[700] },
  disabled: { color: tokens.colors.neutral[400] },
  soon: { ...tokens.typography.bodySm, color: tokens.colors.neutral[400] },
  footer: { borderTopWidth: 1, borderTopColor: tokens.colors.neutral[100], paddingVertical: tokens.spacing[3], alignItems: 'center' },
  footerText: { ...tokens.typography.bodySm, color: tokens.colors.neutral[400] },
});
