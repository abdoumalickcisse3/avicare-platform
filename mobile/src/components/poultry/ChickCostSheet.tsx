/**
 * Renseigner ou corriger le prix par poussin d'une bande — action dédiée, jamais
 * un formulaire d'édition générique de la bande. Mirrors the web `ChickCostDialog`.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { tokens } from '@/theme';
import { FormField } from '@/components/field/FormField';
import { useSetChickCostMutation } from '@/store/api/poultryBatchesApi';

export function ChickCostSheet({
  visible,
  onClose,
  farmId,
  batchId,
  initialCount,
  currentValueXof,
}: {
  visible: boolean;
  onClose: () => void;
  farmId: number;
  batchId: number;
  initialCount: number;
  currentValueXof: number | null;
}) {
  const [setChickCost, { isLoading }] = useSetChickCostMutation();
  const [unitPrice, setUnitPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setUnitPrice(
        currentValueXof != null && initialCount > 0
          ? String(Math.round(currentValueXof / initialCount))
          : '',
      );
      setError(null);
    }
  }, [visible, currentValueXof, initialCount]);

  const valid = /^\d+$/.test(unitPrice) && Number(unitPrice) > 0;
  const total = valid ? Number(unitPrice) * initialCount : null;

  async function submit() {
    if (!valid) return;
    setError(null);
    try {
      await setChickCost({
        farmId,
        batchId,
        body: { chickUnitPriceXof: Number(unitPrice) },
      }).unwrap();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (err) {
      // Show what the backend actually said (403 permission, 409 closed batch, 400
      // validation) — falling back to the connectivity wording only when it said nothing.
      setError(
        (err as { data?: { detail?: string; message?: string } })?.data?.detail ??
          (err as { data?: { message?: string } })?.data?.message ??
          'Enregistrement impossible. Vérifiez votre connexion et réessayez.',
      );
    }
  }

  const title = currentValueXof != null ? 'Modifier le coût des poussins' : 'Renseigner le coût des poussins';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fermer">
            <X size={22} color={tokens.colors.neutral[500]} />
          </Pressable>
        </View>

        <FormField
          label="Prix par poussin (FCFA)"
          value={unitPrice}
          onChangeText={(t) => setUnitPrice(t.replace(/[^0-9]/g, ''))}
          placeholder="Ex. 300"
          keyboardType="number-pad"
          helperText={total != null ? `Total : ${total.toLocaleString('fr-FR')} FCFA` : undefined}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={submit}
          disabled={!valid || isLoading}
          accessibilityRole="button"
          accessibilityLabel="Enregistrer"
          style={[styles.cta, (!valid || isLoading) && styles.ctaDisabled]}
        >
          {isLoading ? (
            <ActivityIndicator color={tokens.colors.action.commit.fg} />
          ) : (
            <Text style={styles.ctaText}>Enregistrer</Text>
          )}
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(18,43,18,0.4)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.colors.neutral[0],
    borderTopLeftRadius: tokens.radii.xl,
    borderTopRightRadius: tokens.radii.xl,
    paddingHorizontal: tokens.spacing[5],
    paddingTop: tokens.spacing[4],
    paddingBottom: tokens.spacing[8],
    gap: tokens.spacing[3],
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: tokens.spacing[2] },
  title: { ...tokens.typography.headingLg, color: tokens.colors.neutral[900] },
  error: { ...tokens.typography.bodySm, color: tokens.colors.error },
  cta: { minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, backgroundColor: tokens.colors.action.commit.bg, alignItems: 'center', justifyContent: 'center', marginTop: tokens.spacing[2] },
  ctaDisabled: { backgroundColor: tokens.colors.neutral[300] },
  ctaText: { ...tokens.typography.button, color: tokens.colors.action.commit.fg },
});
