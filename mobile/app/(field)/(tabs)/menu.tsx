/**
 * Menu tab — profile, the sections the user may reach, sync state and logout.
 * For non-admin roles this is where profile/logout live (they have no drawer);
 * admins can also reach it, though they usually use the drawer. lucide icons,
 * config-driven from `constants/navigation`.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { ChevronRight, LogOut, User, Wifi, WifiOff } from 'lucide-react-native';
import { tokens } from '@/theme';
import { AppHeader } from '@/components/AppHeader';
import { Card, PrimaryButton } from '@/components/ui';
import { useListFarmsQuery } from '@/store/api/farmsApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { useFarmAccess } from '@/auth/useSession';
import { getDrawerItems } from '@/constants/navigation';
import { useSyncStatus } from '@/sync/useSyncStatus';
import { clearTokens } from '@/auth/tokens';

export default function MenuScreen() {
  const router = useRouter();
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { data: farms } = useListFarmsQuery();
  const { isAdmin, can } = useFarmAccess();
  const sync = useSyncStatus();
  const selectedFarm = farms?.find((f) => f.id === selectedFarmId);
  const farmName = selectedFarm?.name ?? 'Ferme';
  const sections = getDrawerItems(isAdmin, can, selectedFarm?.productionFocus ?? []);

  const logout = async () => {
    await clearTokens();
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
        </Card>

        <View style={styles.logout}>
          <PrimaryButton label="Déconnexion" icon={LogOut} role="danger" size="primary" onPress={logout} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
