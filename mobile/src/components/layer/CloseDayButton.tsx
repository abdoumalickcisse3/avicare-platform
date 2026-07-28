/**
 * "Clôturer la journée" — closes the current day's production for a unit
 * (recompute aggregate from collections, credit tray stock). Mirrors the web
 * `CloseDayButton`; reserved MANAGER/OWNER server-side, so a 403 surfaces as a
 * clear "réservé aux gérants" alert. Feedback via the native Alert (no toast
 * provider on mobile).
 */
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { Lock } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useCloseDayMutation } from '@/store/api/eggProductionApi';

export function CloseDayButton({ farmId, unitId }: { farmId: number; unitId: number }) {
  const [closeDay, { isLoading }] = useCloseDayMutation();

  const onPress = async () => {
    try {
      await closeDay({ farmId, unitId }).unwrap();
      Alert.alert('Journée clôturée', 'Agrégat recalculé et stock de plateaux crédité.');
    } catch (err) {
      const status = (err as { status?: number })?.status;
      Alert.alert(
        'Clôture impossible',
        status === 403
          ? 'Action réservée aux gérants et propriétaires.'
          : "La clôture de la journée a échoué. Réessayez.",
      );
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }, isLoading && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={isLoading}
      accessibilityRole="button"
      accessibilityLabel="Clôturer la journée"
    >
      <Lock size={18} color={tokens.colors.primary[700]} />
      <Text style={styles.label}>{isLoading ? 'Clôture…' : 'Clôturer la journée'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[2],
    minHeight: tokens.touch.primaryButton,
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.primary[600],
    backgroundColor: tokens.colors.primary[50],
  },
  label: { ...tokens.typography.button, fontSize: 15, color: tokens.colors.primary[700] },
});
