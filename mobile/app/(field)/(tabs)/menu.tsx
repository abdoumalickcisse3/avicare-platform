/**
 * Menu tab — profile, the sections the user may reach, sync state and logout.
 * For non-admin roles this is where profile/logout live (they have no drawer);
 * admins can also reach it, though they usually use the drawer. lucide icons,
 * config-driven from `constants/navigation`.
 *
 * The account card is the mobile mirror of the web account menu, and the only
 * account surface a FARMER can reach: Réglages is gated by `settings:read`,
 * which their role does not carry. So « Mon profil » and « Mes avances » hang
 * here rather than under Réglages.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { ChevronRight, HandCoins, LogOut, User, UserCog, Wifi, WifiOff } from 'lucide-react-native';
import { fontFamily, tokens } from '@/theme';
import { AppHeader } from '@/components/AppHeader';
import { Card, PrimaryButton } from '@/components/ui';
import { useListFarmsQuery } from '@/store/api/farmsApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { useFarmAccess } from '@/auth/useSession';
import { getDrawerItems } from '@/constants/navigation';
import { useSyncStatus } from '@/sync/useSyncStatus';
import { signOut } from '@/auth/signOut';
import { MyAdvancesSheet } from '@/finance/MyAdvancesSheet';

export default function MenuScreen() {
  const router = useRouter();
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { data: farms } = useListFarmsQuery();
  const { isAdmin, can } = useFarmAccess();
  const sync = useSyncStatus();
  const [advancesOpen, setAdvancesOpen] = useState(false);
  const selectedFarm = farms?.find((f) => f.id === selectedFarmId);
  const farmName = selectedFarm?.name ?? 'Ferme';
  const sections = getDrawerItems(isAdmin, can, selectedFarm?.productionFocus ?? []);

  const logout = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.profile}>
          <View style={styles.avatar}><User size={28} color={tokens.colors.primary[700]} /></View>
          <View>
            <Text style={styles.profileName}>Mon compte</Text>
            <Text style={styles.profileSub}>{farmName}</Text>
          </View>
        </Card>

        <Card padded={false}>
          <Pressable
            onPress={() => router.push('/(field)/reglages/profil')}
            style={styles.row}
            accessibilityRole="button"
            accessibilityLabel="Mon profil"
          >
            <UserCog size={22} color={tokens.colors.primary[600]} />
            <Text style={styles.rowLabel}>Mon profil</Text>
            <ChevronRight size={20} color={tokens.colors.neutral[400]} />
          </Pressable>
          {/* Asking for an advance is the field worker's own act, and the field worker has
              nothing but this phone. The farm side of the decision lives in Finance. */}
          <Pressable
            disabled={selectedFarmId === null}
            onPress={() => setAdvancesOpen(true)}
            style={[styles.row, styles.rowBorder]}
            accessibilityRole="button"
            accessibilityLabel="Mes avances"
          >
            <HandCoins
              size={22}
              color={selectedFarmId === null ? tokens.colors.neutral[400] : tokens.colors.primary[600]}
            />
            <Text style={[styles.rowLabel, selectedFarmId === null && styles.disabled]}>
              Mes avances
            </Text>
            <ChevronRight size={20} color={tokens.colors.neutral[400]} />
          </Pressable>
        </Card>

        <Text style={styles.groupLabel}>NAVIGATION</Text>
        <Card padded={false}>
          {sections.map((s, i) => {
            const Icon = s.icon;
            // A group with no route of its own navigates to its first ready child.
            const route = s.route ?? s.children?.find((c) => c.ready)?.route;
            const ready = s.ready ?? s.children?.some((c) => c.ready) ?? false;
            return (
              <Pressable
                key={s.id}
                disabled={!ready || !route}
                onPress={() => route && ready && router.push(route as never)}
                style={[styles.row, i > 0 && styles.rowBorder]}
                accessibilityRole="button"
                accessibilityLabel={s.label}
              >
                <Icon size={22} color={ready ? tokens.colors.primary[600] : tokens.colors.neutral[400]} />
                <Text style={[styles.rowLabel, !ready && styles.disabled]}>{s.label}</Text>
                {ready ? <ChevronRight size={20} color={tokens.colors.neutral[400]} /> : <Text style={styles.soon}>Bientôt</Text>}
              </Pressable>
            );
          })}
        </Card>

        <Text style={styles.groupLabel}>SYNCHRONISATION</Text>
        <Card>
          <View style={styles.syncRow}>
            {sync.online ? <Wifi size={20} color={tokens.colors.success} /> : <WifiOff size={20} color={tokens.colors.warning} />}
            <Text style={styles.syncText}>{sync.online ? 'En ligne' : 'Hors ligne'}</Text>
          </View>
          <Text style={styles.syncMeta}>
            {sync.pending > 0 ? `${sync.pending} saisie${sync.pending > 1 ? 's' : ''} en attente` : 'Tout est synchronisé'}
            {sync.failed > 0 ? ` · ${sync.failed} à corriger` : ''}
          </Text>
          {/* The queue screen was built, tested, and reachable from nowhere: a farmer whose entry
              failed for good had no way to see it, let alone fix it. That is data-loss-shaped, so
              the row is always here — not only when something is already wrong. */}
          <Pressable
            onPress={() => router.push('/(field)/file')}
            style={styles.queueRow}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir la file d'attente"
          >
            <Text style={[styles.queueText, sync.failed > 0 && styles.queueTextAlert]}>
              {sync.failed > 0 ? 'Corriger les saisies en échec' : "Voir la file d'attente"}
            </Text>
            <ChevronRight
              size={20}
              color={sync.failed > 0 ? tokens.colors.error : tokens.colors.field.textMuted}
            />
          </Pressable>
        </Card>

        <View style={styles.logout}>
          <PrimaryButton label="Déconnexion" icon={LogOut} role="danger" size="primary" onPress={logout} />
        </View>
      </ScrollView>

      {selectedFarmId !== null && (
        <MyAdvancesSheet
          farmId={selectedFarmId}
          open={advancesOpen}
          onClose={() => setAdvancesOpen(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: tokens.touch.button,
    marginTop: tokens.spacing[2],
  },
  queueText: {
    ...tokens.typography.bodyMd,
    color: tokens.colors.field.text,
  },
  queueTextAlert: {
    color: tokens.colors.error,
    fontFamily: fontFamily.sansSemiBold,
  },
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.spacing[16], gap: tokens.spacing[3] },
  profile: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3] },
  avatar: { width: 48, height: 48, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.primary[100], alignItems: 'center', justifyContent: 'center' },
  profileName: { ...tokens.typography.headingMd, color: tokens.colors.field.text },
  profileSub: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted },
  groupLabel: { ...tokens.typography.label, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[3], marginBottom: tokens.spacing[1] },
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3], paddingHorizontal: tokens.spacing[4], paddingVertical: tokens.spacing[4] },
  rowBorder: { borderTopWidth: 1, borderTopColor: tokens.colors.neutral[100] },
  rowLabel: { ...tokens.typography.bodyLg, color: tokens.colors.field.text, flex: 1 },
  disabled: { color: tokens.colors.neutral[400] },
  soon: { ...tokens.typography.bodySm, color: tokens.colors.neutral[400] },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  syncText: { ...tokens.typography.headingMd, color: tokens.colors.field.text },
  syncMeta: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[1] },
  logout: { marginTop: tokens.spacing[4] },
});
