/**
 * Closing panel over the dusk sky. The footer CTA (handled by the wizard) sets
 * the welcome flag and routes into the field app.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Check, Sparkles } from 'lucide-react-native';
import { tokens } from '@/theme';
import { StepScaffold } from '../StepScaffold';

const NEXT = [
  'Enregistrez vos saisies au quotidien',
  'Suivez mortalité, ponte et pesées',
  'Parlez à Jawdi IA (bientôt) pour tout automatiser',
] as const;

export function DoneStep() {
  return (
    <StepScaffold eyebrow="C'est prêt" title="Votre ferme est prête" subtitle="Tout est configuré. Place au terrain.">
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Sparkles size={30} color={tokens.colors.primary[600]} />
        </View>
      </View>
      <View style={styles.list}>
        {NEXT.map((t) => (
          <View key={t} style={styles.item}>
            <View style={styles.tick}>
              <Check size={14} color={tokens.colors.successDark} strokeWidth={3} />
            </View>
            <Text style={styles.itemText}>{t}</Text>
          </View>
        ))}
      </View>
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: tokens.spacing[4] },
  badge: {
    width: 72,
    height: 72,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { gap: tokens.spacing[2] },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    padding: tokens.spacing[3],
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    backgroundColor: tokens.colors.neutral[0],
  },
  tick: {
    width: 26,
    height: 26,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: { ...tokens.typography.bodyMd, color: tokens.colors.neutral[800], flex: 1 },
});
