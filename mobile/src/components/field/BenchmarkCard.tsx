import { StyleSheet, Text, View } from 'react-native';
import { Users } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useGetBenchmarkComparisonQuery } from '@/store/api/benchmarksApi';

function rate(value: string | null): string {
  return value === null ? '—' : `${value} %`;
}

/**
 * Where this farm sits against the others, anonymously.
 *
 * Renders nothing when the platform has comparison off — an empty card explaining an absent
 * feature is noise on a screen opened in a barn. A cohort that is merely too small is explained,
 * because that resolves on its own as the platform grows.
 */
export function BenchmarkCard({ farmId }: { farmId: number }) {
  const { data } = useGetBenchmarkComparisonQuery({ farmId });

  if (!data) return null;

  if (!data.available) {
    if (!data.unavailableReason?.includes('fermes comparables')) return null;
    return (
      <View style={styles.card}>
        <Text style={styles.muted}>{data.unavailableReason}</Text>
      </View>
    );
  }

  const mine = data.farmMortalityRate;
  const platform = data.platformMortalityRate;
  const better = mine !== null && platform !== null && Number(mine) < Number(platform);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Users size={18} color={tokens.colors.field.text} />
        <Text style={styles.title}>Votre mortalité, comparée</Text>
        <Text style={styles.cohort}>{data.cohortSize} fermes</Text>
      </View>

      <View style={styles.row}>
        <View>
          <Text style={styles.value}>{rate(mine)}</Text>
          <Text style={styles.muted}>votre ferme</Text>
        </View>
        <View>
          <Text style={[styles.value, styles.valueMuted]}>{rate(platform)}</Text>
          <Text style={styles.muted}>moyenne des fermes</Text>
        </View>
      </View>

      {mine !== null && platform !== null && (
        <Text style={[styles.verdict, { color: better ? tokens.colors.success : tokens.colors.warning }]}>
          {better
            ? "Vous perdez moins d'animaux que la moyenne."
            : "Vous perdez plus d'animaux que la moyenne."}
        </Text>
      )}

      <Text style={styles.footnote}>
        Moyenne calculée par ferme, sur les fermes comparables. Aucune ferme n&apos;est nommée.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.field.surface,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.field.ruleSubtle,
    padding: tokens.spacing[4],
    gap: tokens.spacing[3],
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: tokens.colors.field.text },
  cohort: { fontSize: 12, color: tokens.colors.field.textMuted },
  row: { flexDirection: 'row', gap: tokens.spacing[6] },
  value: { fontSize: 24, fontWeight: '800', color: tokens.colors.field.text },
  valueMuted: { color: tokens.colors.field.textMuted },
  muted: { fontSize: 12, color: tokens.colors.field.textMuted },
  verdict: { fontSize: 13, fontWeight: '600' },
  footnote: { fontSize: 11, color: tokens.colors.field.textMuted, lineHeight: 16 },
});
