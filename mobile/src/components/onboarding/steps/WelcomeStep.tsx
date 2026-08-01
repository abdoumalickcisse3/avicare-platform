/**
 * First panel: orient and reassure. No persistence — the four modules the
 * wizard will configure, then the footer CTA starts the walk.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Bird, Package, ShoppingBag, Wallet } from 'lucide-react-native';
import { tokens } from '@/theme';
import { StepScaffold } from '../StepScaffold';

const MODULES = [
  { icon: Bird, label: 'Élevage', hint: 'Lots, saisies, mortalité' },
  { icon: Package, label: 'Stock', hint: 'Aliments, seuils' },
  { icon: ShoppingBag, label: 'Commercial', hint: 'Ventes, clients' },
  { icon: Wallet, label: 'Finance', hint: 'Dépenses, résultat' },
] as const;

export function WelcomeStep() {
  return (
    <StepScaffold
      eyebrow="Bienvenue"
      title="On configure votre ferme ensemble"
      subtitle="Quelques réglages rapides et vous pilotez tout votre élevage. C'est déjà pré-rempli — vous n'avez qu'à valider."
    >
      <View style={styles.grid}>
        {MODULES.map(({ icon: Icon, label, hint }) => (
          <View key={label} style={styles.card}>
            <View style={styles.iconTile}>
              <Icon size={22} color={tokens.colors.primary[600]} />
            </View>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.hint}>{hint}</Text>
          </View>
        ))}
      </View>
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[3] },
  card: {
    width: '47%',
    flexGrow: 1,
    padding: tokens.spacing[4],
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.neutral[50],
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    gap: tokens.spacing[1],
  },
  iconTile: {
    width: 42,
    height: 42,
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing[1],
  },
  label: { ...tokens.typography.headingMd, color: tokens.colors.neutral[900] },
  hint: { ...tokens.typography.bodySm, color: tokens.colors.neutral[600] },
});
