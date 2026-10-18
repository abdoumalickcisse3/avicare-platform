/**
 * La sortie de secours quand le stock refuse une consommation (ADR-018), en pendant mobile de
 * `web/src/components/inventory/useStockShortage.tsx`.
 *
 * Refuser une sortie n'a de sens que si la porte de sortie est à portée de pouce. Sans elle, la
 * garde est punitive : la saisie du poulailler part en file, revient refusée le lendemain, et
 * l'éleveur n'a que « Réessayer » — qui échouera pareil — et « Supprimer » — qui jette la donnée.
 * Les deux perdent la saisie ; c'est exactement ce que la garde prétendait protéger.
 *
 * Deux gestes, les mêmes que sur le web, parce que ce sont les deux seules raisons d'un stock à
 * découvert : le produit est bien arrivé mais l'achat n'a pas été saisi (entrée), ou le compte
 * du magasin a dérivé et il faut le reposer sur ce qu'on voit (inventaire).
 */
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { PackagePlus, ClipboardCheck } from 'lucide-react-native';
import { useRecordMovementMutation } from '@/store/api/inventoryStockApi';
import { missingQuantity, type StockShortage } from '@/lib/stockShortage';
import { formatNumber } from '@/lib/format';
import { tokens } from '@/theme';

type Repair = 'IN' | 'ADJUSTMENT';

function withUnit(quantity: number, unit: string | null): string {
  return `${formatNumber(quantity)}${unit ? ` ${unit}` : ''}`;
}

export function StockShortageSheet({
  open,
  shortage,
  farmId,
  onClose,
  onRepaired,
}: {
  open: boolean;
  shortage: StockShortage;
  farmId: number;
  onClose: () => void;
  /** Appelé une fois le stock corrigé : c'est là que la saisie refusée est remise en file. */
  onRepaired: () => void;
}) {
  const [recordMovement, { isLoading }] = useRecordMovementMutation();
  const [repair, setRepair] = useState<Repair | null>(null);
  const [value, setValue] = useState('');

  // Réinitialisation déclenchée par l'ouverture, pas par le rendu : rouvrir la feuille sur le
  // choix précédent ferait enregistrer un inventaire à la place d'une entrée.
  useEffect(() => {
    if (!open) return;
    setRepair(null);
    setValue('');
  }, [open]);

  function choose(next: Repair): void {
    setRepair(next);
    // À l'entrée on pré-remplit ce qui MANQUE, pas ce qui était demandé : sur une ligne déjà
    // négative, saisir la demande seule laisserait le solde sous zéro et le geste échouerait une
    // seconde fois. À l'inventaire le champ reste vide — tout l'intérêt est qu'on compte.
    setValue(next === 'IN' ? String(missingQuantity(shortage)) : '');
  }

  const parsed = Number(value.replace(',', '.'));
  const valid = value.length > 0 && Number.isFinite(parsed) && (repair === 'IN' ? parsed > 0 : parsed >= 0);

  async function submit(): Promise<void> {
    if (!valid || repair == null) return;
    try {
      await recordMovement({
        farmId,
        body: {
          stockItemId: shortage.stockItemId,
          movementType: repair,
          quantity: parsed,
          reason: repair === 'IN' ? 'RECEPTION_PURCHASE' : 'INVENTORY_PHYSICAL',
        },
      }).unwrap();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onRepaired();
    } catch {
      Alert.alert('Stock', "La correction n’a pas pu être enregistrée. Réessayez.");
    }
  }

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} accessibilityLabel="Fermer" onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>Stock insuffisant</Text>
        <Text style={styles.explain}>
          Il reste {withUnit(shortage.available, shortage.unit)} de {shortage.articleLabel}, et vous en sortez{' '}
          {withUnit(shortage.requested, shortage.unit)}.
        </Text>

        {repair == null ? (
          <View style={styles.choices}>
            <Text style={styles.question}>D&apos;où vient ce produit ?</Text>
            <Pressable
              style={[styles.choice, styles.choicePrimary]}
              onPress={() => choose('IN')}
              accessibilityRole="button"
              accessibilityLabel="Je l'ai reçu, l'achat n'a pas été saisi"
            >
              <PackagePlus size={20} color={tokens.colors.action.accumulate.fg} />
              <Text style={styles.choicePrimaryLabel}>Je l&apos;ai reçu, l&apos;achat n&apos;a pas été saisi</Text>
            </Pressable>
            <Pressable
              style={styles.choice}
              onPress={() => choose('ADJUSTMENT')}
              accessibilityRole="button"
              accessibilityLabel="Je compte ce qu'il y a dans le magasin"
            >
              <ClipboardCheck size={20} color={tokens.colors.field.text} />
              <Text style={styles.choiceLabel}>Je compte ce qu&apos;il y a dans le magasin</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.choices}>
            <Text style={styles.question}>
              {repair === 'IN' ? 'Quantité reçue' : 'Quantité comptée dans le magasin'}
            </Text>
            <Text style={styles.readout} accessibilityLabel="Quantité saisie">
              {value || '0'}
              {shortage.unit ? <Text style={styles.readoutUnit}> {shortage.unit}</Text> : null}
            </Text>
            <NumericRow value={value} onChange={setValue} />
            <Text style={styles.hint}>
              {repair === 'IN'
                ? 'Pré-rempli avec ce qui manque pour que la saisie passe.'
                : 'Le stock sera posé sur ce chiffre, quel que soit son solde actuel.'}
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Annuler" style={styles.cancel}>
            <Text style={styles.cancelText}>Annuler</Text>
          </Pressable>
          {repair != null ? (
            <Pressable
              onPress={submit}
              disabled={!valid || isLoading}
              accessibilityRole="button"
              accessibilityLabel="Enregistrer la correction"
              style={[styles.save, (!valid || isLoading) && styles.disabled]}
            >
              <Text style={styles.saveText}>{isLoading ? 'Correction…' : 'Corriger'}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

/** Un pavé de chiffres plutôt que le clavier système : on saisit debout, une main sur un sac. */
function NumericRow({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '←'];
  function press(key: string): void {
    if (key === '←') return onChange(value.slice(0, -1));
    if (key === ',' && (value.includes(',') || value.length === 0)) return;
    if (value.length >= 7) return;
    onChange(value + key);
  }
  return (
    <View style={styles.keypad}>
      {keys.map((key) => (
        <Pressable
          key={key}
          style={styles.key}
          onPress={() => press(key)}
          accessibilityRole="button"
          accessibilityLabel={key === '←' ? 'Effacer' : key}
        >
          <Text style={styles.keyLabel}>{key}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(28, 25, 23, 0.45)' },
  sheet: {
    backgroundColor: tokens.colors.field.background,
    borderTopLeftRadius: tokens.radii.xl,
    borderTopRightRadius: tokens.radii.xl,
    paddingTop: tokens.spacing[5],
    paddingBottom: tokens.spacing[6],
    gap: tokens.spacing[3],
  },
  title: {
    ...tokens.typography.headingLg,
    color: tokens.colors.field.text,
    paddingHorizontal: tokens.layout.screenPadding,
  },
  explain: {
    ...tokens.typography.bodyMd,
    color: tokens.colors.field.textMuted,
    paddingHorizontal: tokens.layout.screenPadding,
    lineHeight: 21,
  },
  choices: { paddingHorizontal: tokens.layout.screenPadding, gap: tokens.spacing[2] },
  question: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    paddingVertical: tokens.spacing[3],
    paddingHorizontal: tokens.spacing[3],
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.field.rule,
  },
  choicePrimary: {
    backgroundColor: tokens.colors.action.accumulate.bg,
    borderColor: tokens.colors.action.accumulate.border,
  },
  choicePrimaryLabel: { ...tokens.typography.bodyMd, color: tokens.colors.action.accumulate.fg, flex: 1 },
  choiceLabel: { ...tokens.typography.bodyMd, color: tokens.colors.field.text, flex: 1 },
  readout: { ...tokens.typography.numeric, color: tokens.colors.field.text },
  readoutUnit: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted },
  hint: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, lineHeight: 18 },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2] },
  key: {
    width: '30%',
    paddingVertical: tokens.spacing[3],
    alignItems: 'center',
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.neutral[100],
  },
  keyLabel: { ...tokens.typography.headingLg, color: tokens.colors.field.text },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: tokens.spacing[2],
    paddingHorizontal: tokens.layout.screenPadding,
  },
  cancel: { paddingVertical: tokens.spacing[3], paddingHorizontal: tokens.spacing[4] },
  cancelText: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted },
  save: {
    paddingVertical: tokens.spacing[3],
    paddingHorizontal: tokens.spacing[5],
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.action.commit.bg,
  },
  saveText: { ...tokens.typography.bodyMd, color: tokens.colors.action.accumulate.fg },
  disabled: { opacity: 0.45 },
});
