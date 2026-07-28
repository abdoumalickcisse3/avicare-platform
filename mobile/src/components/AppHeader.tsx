/**
 * Shared header for the tabbed field app. Mirrors the web top bar:
 *  - admin-like users get a hamburger (top-left) opening the full-menu drawer;
 *  - the farm switcher is an inline DROPDOWN (not a navigation) — tapping it
 *    lists the user's farms and switching one updates the selection in place
 *    and refetches, without leaving the screen;
 *  - a bell on the right.
 * lucide-react-native icons throughout.
 */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { Bell, Check, ChevronDown, Menu, User } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useNav } from '@/navigation/NavContext';
import { useListFarmsQuery } from '@/store/api/farmsApi';
import { baseApi } from '@/store/api/baseApi';
import { selectSelectedFarmId, setSelectedFarmId } from '@/store/slices/selectionSlice';

export function AppHeader() {
  const { isAdmin, openDrawer } = useNav();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { data: farms } = useListFarmsQuery();
  const [open, setOpen] = useState(false);

  const farmName = farms?.find((f) => f.id === selectedFarmId)?.name ?? 'Ferme';
  const multiFarm = (farms?.length ?? 0) > 1;

  const switchFarm = (id: number) => {
    setOpen(false);
    if (id === selectedFarmId) return;
    // Live switch: wipe the in-memory cache so nothing from the old farm
    // lingers, then select — the screens refetch for the new farm.
    dispatch(baseApi.util.resetApiState());
    dispatch(setSelectedFarmId(id));
  };

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        {isAdmin && (
          <Pressable onPress={openDrawer} accessibilityRole="button" accessibilityLabel="Ouvrir le menu" hitSlop={8} style={styles.burger}>
            <Menu size={26} color={tokens.colors.field.text} />
          </Pressable>
        )}
        <Pressable
          style={styles.farmPick}
          onPress={() => multiFarm && setOpen(true)}
          disabled={!multiFarm}
          accessibilityRole="button"
          accessibilityLabel="Changer de ferme"
        >
          <View style={styles.avatar}>
            <User size={20} color={tokens.colors.primary[700]} />
          </View>
          <Text style={styles.farmName} numberOfLines={1}>{farmName}</Text>
          {multiFarm && <ChevronDown size={20} color={tokens.colors.primary[600]} />}
        </Pressable>
      </View>
      <Bell size={24} color={tokens.colors.field.text} />

      {/* Farm dropdown */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { marginTop: insets.top + 52 }]}>
            <Text style={styles.menuLabel}>VOS FERMES</Text>
            {(farms ?? []).map((f) => {
              const active = f.id === selectedFarmId;
              return (
                <Pressable key={f.id} style={styles.menuRow} onPress={() => switchFarm(f.id)} accessibilityRole="button" accessibilityLabel={f.name}>
                  <Text style={[styles.menuRowText, active && styles.menuRowActive]} numberOfLines={1}>{f.name}</Text>
                  {active && <Check size={18} color={tokens.colors.primary[600]} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.layout.screenPadding,
    paddingVertical: tokens.spacing[3],
    gap: tokens.spacing[3],
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2], flex: 1 },
  burger: { padding: tokens.spacing[1] },
  farmPick: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2], flexShrink: 1 },
  avatar: { width: 34, height: 34, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.primary[100], alignItems: 'center', justifyContent: 'center' },
  farmName: { ...tokens.typography.headingMd, color: tokens.colors.primary[700], flexShrink: 1 },
  scrim: { flex: 1, backgroundColor: 'rgba(12,10,9,0.2)' },
  menu: {
    marginHorizontal: tokens.spacing[4],
    backgroundColor: tokens.colors.neutral[0],
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    paddingVertical: tokens.spacing[2],
    alignSelf: 'flex-start',
    minWidth: 220,
    shadowColor: '#1C1917',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  menuLabel: { ...tokens.typography.label, fontSize: 11, color: tokens.colors.field.textMuted, paddingHorizontal: tokens.spacing[4], paddingVertical: tokens.spacing[1] },
  menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacing[3], paddingHorizontal: tokens.spacing[4], paddingVertical: tokens.spacing[3] },
  menuRowText: { ...tokens.typography.bodyLg, color: tokens.colors.field.text, flexShrink: 1 },
  menuRowActive: { fontWeight: '700', color: tokens.colors.primary[700] },
});
