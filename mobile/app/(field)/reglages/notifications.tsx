/**
 * Notification preferences (Sprint C1) — per-category delivery settings for the
 * two channels (Cloche in-app / WhatsApp), mirroring the web
 * `/reglages/notifications` grid. Each channel has an on/off switch and, when on,
 * a severity floor (Toutes / Importantes / Critiques). WhatsApp uses the phone
 * from the user's profile. Personal to the signed-in user.
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft } from 'lucide-react-native';
import { tokens } from '@/theme';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import {
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
} from '@/store/api/notificationsApi';
import type {
  NotificationChannelKey,
  NotificationPreference,
  NotificationSeverity,
} from '@/types';

const CATEGORY_LABELS: Record<string, string> = {
  MORTALITY_ANOMALY: 'Mortalité anormale',
  VACCINATION_LATE: 'Vaccination en retard',
  WITHDRAWAL_ENDING: "Délai d'attente",
  CRITICAL_OBSERVATION: 'Observation critique',
  LOW_STOCK: 'Stock bas',
  NEGATIVE_STOCK: 'Stock négatif',
  PO_OVERDUE: 'Commande en retard',
  CREDIT_EXCEEDED: 'Encours dépassé',
  INVOICE_OVERDUE: 'Facture en retard',
};

const SEVERITIES: NotificationSeverity[] = ['INFO', 'WARNING', 'CRITICAL'];
const SEVERITY_LABELS: Record<NotificationSeverity, string> = {
  INFO: 'Toutes',
  WARNING: 'Importantes',
  CRITICAL: 'Critiques',
};
const CHANNELS: { key: NotificationChannelKey; label: string }[] = [
  { key: 'IN_APP', label: 'Cloche' },
  { key: 'WHATSAPP', label: 'WhatsApp' },
];

const keyOf = (c: string, ch: NotificationChannelKey) => `${c}::${ch}`;

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const selectedFarmId = useSelector(selectSelectedFarmId);

  const { data } = useGetNotificationPreferencesQuery(
    selectedFarmId === null ? skipToken : { farmId: selectedFarmId },
  );
  const [update, { isLoading: saving }] = useUpdateNotificationPreferencesMutation();

  const [buffer, setBuffer] = useState<Record<string, NotificationPreference>>({});
  useEffect(() => {
    if (!data) return;
    const next: Record<string, NotificationPreference> = {};
    for (const p of data) next[keyOf(p.category, p.channel)] = { ...p };
    setBuffer(next);
  }, [data]);

  if (selectedFarmId === null) {
    return <Redirect href="/(field)" />;
  }

  const categories = Array.from(new Set((data ?? []).map((p) => p.category)));

  const patch = (
    category: string,
    channel: NotificationChannelKey,
    change: Partial<NotificationPreference>,
  ) => {
    setBuffer((prev) => {
      const k = keyOf(category, channel);
      const b = prev[k] ?? { category, channel, enabled: false, minSeverity: 'INFO' as const };
      return { ...prev, [k]: { ...b, ...change } };
    });
  };

  const save = () => update({ farmId: selectedFarmId, preferences: Object.values(buffer) });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={8}
          style={styles.backBtn}
        >
          <ArrowLeft size={22} color={tokens.colors.field.text} />
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Le WhatsApp utilise le numéro de votre profil.
        </Text>

        {categories.map((category) => (
          <View key={category} style={styles.card}>
            <Text style={styles.catName}>{CATEGORY_LABELS[category] ?? category}</Text>
            {CHANNELS.map((c) => {
              const pref = buffer[keyOf(category, c.key)];
              const enabled = pref?.enabled ?? false;
              const minSeverity = pref?.minSeverity ?? 'INFO';
              return (
                <View key={c.key} style={styles.channelBlock}>
                  <View style={styles.channelRow}>
                    <Text style={styles.channelLabel}>{c.label}</Text>
                    <Switch
                      value={enabled}
                      onValueChange={(v) => patch(category, c.key, { enabled: v })}
                      accessibilityLabel={`${category} ${c.key}`}
                    />
                  </View>
                  {enabled && (
                    <View style={styles.chips}>
                      {SEVERITIES.map((s) => {
                        const active = s === minSeverity;
                        return (
                          <Pressable
                            key={s}
                            onPress={() => patch(category, c.key, { minSeverity: s })}
                            style={[styles.chip, active && styles.chipActive]}
                            accessibilityRole="button"
                            accessibilityLabel={`${c.label} ${SEVERITY_LABELS[s]}`}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>
                              {SEVERITY_LABELS[s]}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={save}
          disabled={saving}
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Enregistrer"
        >
          <Text style={styles.saveText}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.layout.screenPadding,
    paddingTop: tokens.spacing[3],
    paddingBottom: tokens.spacing[2],
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: tokens.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.neutral[0],
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
  },
  title: { ...tokens.typography.displayMd, color: tokens.colors.field.text },
  content: { paddingHorizontal: tokens.layout.screenPadding, paddingBottom: tokens.spacing[16] },
  subtitle: {
    ...tokens.typography.bodySm,
    color: tokens.colors.field.textMuted,
    marginBottom: tokens.spacing[3],
  },
  card: {
    backgroundColor: tokens.colors.neutral[0],
    borderRadius: tokens.radii.xl,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    padding: tokens.spacing[4],
    marginBottom: tokens.spacing[3],
    gap: tokens.spacing[2],
  },
  catName: { ...tokens.typography.headingMd, fontSize: 16, color: tokens.colors.field.text },
  channelBlock: { gap: tokens.spacing[2] },
  channelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  channelLabel: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  chips: { flexDirection: 'row', gap: tokens.spacing[2], flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[1],
    borderRadius: tokens.radii.full,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    backgroundColor: tokens.colors.neutral[50],
  },
  chipActive: {
    backgroundColor: tokens.colors.primary[50],
    borderColor: tokens.colors.primary[300],
  },
  chipText: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  chipTextActive: { color: tokens.colors.primary[700], fontWeight: '700' },
  footer: {
    padding: tokens.layout.screenPadding,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.neutral[200],
    backgroundColor: tokens.colors.neutral[0],
  },
  saveBtn: {
    backgroundColor: tokens.colors.primary[600],
    borderRadius: tokens.radii.lg,
    paddingVertical: tokens.spacing[3],
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { ...tokens.typography.headingMd, fontSize: 15, color: tokens.colors.neutral[0] },
});
