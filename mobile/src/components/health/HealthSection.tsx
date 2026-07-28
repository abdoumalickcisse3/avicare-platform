/**
 * Sanitaire tab content, shared by the broiler and layer lot details (mirrors
 * the web `HealthTab`, trimmed to the two reads that aren't behind the advanced
 * module): the unit's vaccinations and observations. Treatments / vet visits
 * are an advanced-module feature — shown as a locked note, like the web.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, Lock, ShieldCheck, Syringe } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useGetObservationsQuery, useGetVaccinationsQuery } from '@/store/api/healthApi';
import { useFarmAccess } from '@/auth/useSession';
import { formatNumber } from '@/lib/format';
import type { HealthObservation, Vaccination } from '@/types';

const MS_PER_DAY = 86_400_000;
/** Days between an ISO date and now (used for the recent-critical window). */
function daysSince(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Infinity : Math.floor((Date.now() - t) / MS_PER_DAY);
}

function severityStyle(sev: string): { bg: string; fg: string } {
  const s = sev.toUpperCase();
  if (s.includes('CRIT') || s.includes('SEV') || s.includes('HIGH')) return { bg: tokens.colors.errorLight, fg: tokens.colors.errorDark };
  if (s.includes('WARN') || s.includes('MOD') || s.includes('MED')) return { bg: tokens.colors.warningLight, fg: tokens.colors.warningDark };
  return { bg: tokens.colors.infoLight, fg: tokens.colors.infoDark };
}

export function HealthSection({ farmId, unitId }: { farmId: number; unitId: number }) {
  const router = useRouter();
  const { can } = useFarmAccess();
  const canWrite = can('health:write');
  const { data: vaccinations } = useGetVaccinationsQuery({ farmId, unitId });
  const { data: observations } = useGetObservationsQuery({ farmId, unitId });

  // Lot health status (mirrors the web HealthLotKpis logic — derived from the
  // health module's own data; mortality lives in the production tabs).
  const recentCritical = (observations ?? []).filter(
    (o) => (o.severity.toUpperCase().includes('CRIT') || o.severity.toUpperCase().includes('WARN')) && daysSince(o.observationDate) <= 7,
  ).length;
  const healthy = recentCritical === 0;

  return (
    <View style={{ gap: tokens.spacing[4] }}>
      {/* Lot-level KPI tiles (parity with the web HealthLotKpis). */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiTile}>
          <View style={styles.kpiHead}>
            <Syringe size={16} color={tokens.colors.primary[600]} />
            <Text style={styles.kpiLabel}>Vaccinations</Text>
          </View>
          <Text style={styles.kpiVal}>{formatNumber(vaccinations?.length ?? 0)}</Text>
        </View>
        <View style={styles.kpiTile}>
          <View style={styles.kpiHead}>
            <Eye size={16} color={tokens.colors.warning} />
            <Text style={styles.kpiLabel}>Observations</Text>
          </View>
          <Text style={styles.kpiVal}>{formatNumber(observations?.length ?? 0)}</Text>
        </View>
        <View style={styles.kpiTile}>
          <View style={styles.kpiHead}>
            <ShieldCheck size={16} color={healthy ? tokens.colors.success : tokens.colors.warning} />
            <Text style={styles.kpiLabel}>État</Text>
          </View>
          <View style={[styles.statusChip, { backgroundColor: healthy ? tokens.colors.successLight : tokens.colors.warningLight }]}>
            <Text style={[styles.statusText, { color: healthy ? tokens.colors.successDark : tokens.colors.warningDark }]}>{healthy ? 'SAIN' : 'VIGILANCE'}</Text>
          </View>
        </View>
      </View>

      {/* Record actions (basic module) — gated by health:write. */}
      {canWrite && (
        <View style={styles.actions}>
          <Pressable style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]} onPress={() => router.push(`/(field)/lots/${unitId}/vaccination`)} accessibilityRole="button" accessibilityLabel="Nouvelle vaccination">
            <Syringe size={18} color={tokens.colors.primary[700]} />
            <Text style={styles.actionText}>Vaccination</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]} onPress={() => router.push(`/(field)/lots/${unitId}/observation`)} accessibilityRole="button" accessibilityLabel="Nouvelle observation">
            <Eye size={18} color={tokens.colors.primary[700]} />
            <Text style={styles.actionText}>Observation</Text>
          </Pressable>
        </View>
      )}

      {/* Vaccinations */}
      <View style={styles.card}>
        <Text style={styles.title}>Vaccinations</Text>
        {!vaccinations || vaccinations.length === 0 ? (
          <Text style={styles.muted}>Aucune vaccination enregistrée.</Text>
        ) : (
          vaccinations.slice().reverse().map((v: Vaccination, i) => (
            <View key={v.id} style={[styles.row, i > 0 && styles.border]}>
              <View style={[styles.disc, { backgroundColor: tokens.colors.successLight }]}><Syringe size={16} color={tokens.colors.success} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{v.vaccineKey}</Text>
                <Text style={styles.rowSub}>{v.administeredDate} · {formatNumber(v.subjectsCount)} sujets{v.route ? ` · ${v.route}` : ''}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Observations */}
      <View style={styles.card}>
        <Text style={styles.title}>Observations</Text>
        {!observations || observations.length === 0 ? (
          <Text style={styles.muted}>Aucune observation.</Text>
        ) : (
          observations.slice().reverse().map((o: HealthObservation, i) => {
            const sev = severityStyle(o.severity);
            return (
              <View key={o.id} style={[styles.row, i > 0 && styles.border]}>
                <View style={[styles.disc, { backgroundColor: sev.bg }]}><Eye size={16} color={sev.fg} /></View>
                <View style={{ flex: 1 }}>
                  <View style={styles.obsHead}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{o.title}</Text>
                    <View style={[styles.sevChip, { backgroundColor: sev.bg }]}><Text style={[styles.sevText, { color: sev.fg }]}>{o.severity}</Text></View>
                  </View>
                  <Text style={styles.rowSub}>{o.observationDate}{o.description ? ` · ${o.description}` : ''}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Advanced-module lock (treatments / vet visits) */}
      <View style={[styles.card, styles.lockCard]}>
        <Lock size={18} color={tokens.colors.neutral[400]} />
        <Text style={styles.lockText}>Traitements et visites vétérinaires — module sanitaire avancé.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  kpiRow: { flexDirection: 'row', gap: tokens.spacing[2] },
  kpiTile: { flex: 1, backgroundColor: tokens.colors.neutral[0], borderWidth: 1, borderColor: tokens.colors.neutral[200], borderRadius: tokens.radii.lg, padding: tokens.spacing[3], gap: tokens.spacing[2] },
  kpiHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kpiLabel: { ...tokens.typography.bodySm, fontSize: 10.5, color: tokens.colors.field.textMuted },
  kpiVal: { ...tokens.typography.numericSm, fontSize: 20, color: tokens.colors.field.text },
  statusChip: { alignSelf: 'flex-start', borderRadius: tokens.radii.full, paddingHorizontal: tokens.spacing[2], paddingVertical: 2 },
  statusText: { ...tokens.typography.bodySm, fontWeight: '700', fontSize: 10 },
  actions: { flexDirection: 'row', gap: tokens.spacing[3] },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: tokens.spacing[2], minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, borderWidth: tokens.layout.borderWidth, borderColor: tokens.colors.primary[600], backgroundColor: tokens.colors.primary[50] },
  actionText: { ...tokens.typography.button, fontSize: 14, color: tokens.colors.primary[700] },
  card: { backgroundColor: tokens.colors.neutral[0], borderWidth: 1, borderColor: tokens.colors.neutral[200], borderRadius: tokens.radii.xl, padding: tokens.spacing[4] },
  title: { ...tokens.typography.headingMd, color: tokens.colors.field.text, marginBottom: tokens.spacing[2] },
  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingVertical: tokens.spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3], paddingVertical: tokens.spacing[3] },
  border: { borderTopWidth: 1, borderTopColor: tokens.colors.neutral[100] },
  disc: { width: 34, height: 34, borderRadius: tokens.radii.full, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.field.text },
  rowSub: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  obsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacing[2] },
  sevChip: { borderRadius: tokens.radii.full, paddingHorizontal: tokens.spacing[2], paddingVertical: 2 },
  sevText: { ...tokens.typography.bodySm, fontWeight: '700', fontSize: 10 },
  lockCard: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3], backgroundColor: tokens.colors.neutral[100], borderColor: tokens.colors.neutral[200] },
  lockText: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, flex: 1 },
});
