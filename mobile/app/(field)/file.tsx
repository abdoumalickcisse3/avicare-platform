/**
 * Pending / failed mutation queue ("File d'attente") — task 14.
 *
 * The single place a farmer can see what hasn't reached the server yet and
 * act on definitive rejections. Two groups:
 *  - PENDING / IN_FLIGHT: waiting for connectivity or mid-drain — passive,
 *    they clear on their own on the next successful drain.
 *  - FAILED: the server rejected them for good (a 4xx). Each shows the exact
 *    RFC 7807 `detail` the server returned (`lastError`) — never a generic
 *    "sync error", because the éleveur must know what to fix — plus two
 *    actions: Réessayer (back to PENDING + kick a drain) and Supprimer (drop
 *    it from the queue).
 *
 * Reads the shared `@/sync` singleton and re-renders on every `notify()` (the
 * singleton wraps enqueue/markPending/markDone to fire it), so the list stays
 * live as drains resolve and as the actions below mutate the queue.
 */
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import { queue, subscribe, syncEngine } from '@/sync';
import type { MutationKind, QueuedMutation } from '@/sync/types';

const KIND_LABELS: Record<MutationKind, string> = {
  DAILY_RECORD: 'Journalier',
  MORTALITY: 'Mortalité',
  WEIGHING: 'Pesée',
  EGG_COLLECTION: "Collecte d'œufs",
};

export default function QueueScreen() {
  const router = useRouter();
  const [items, setItems] = useState<QueuedMutation[]>(() => queue.listAll());

  useEffect(() => subscribe(() => setItems(queue.listAll())), []);

  const failed = items.filter((m) => m.status === 'FAILED');
  const pending = items.filter((m) => m.status !== 'FAILED');

  function retry(id: number): void {
    queue.markPending(id);
    // Fire-and-forget: drain() classifies every transport failure internally
    // and never rejects, but guard against an unhandled rejection anyway.
    syncEngine.drain().catch(() => undefined);
  }

  function remove(id: number): void {
    queue.markDone(id);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={{
            top: tokens.spacing[2],
            bottom: tokens.spacing[2],
            left: tokens.spacing[2],
            right: tokens.spacing[2],
          }}
        >
          <Text style={styles.backLabel}>← Terrain</Text>
        </TouchableOpacity>
        <Text style={styles.title}>File d&apos;attente</Text>
      </View>

      <View style={styles.rule} />

      {items.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.empty}>Tout est synchronisé</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {failed.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>À CORRIGER</Text>
              {failed.map((m) => (
                <View key={m.id} style={styles.failedRow}>
                  <Text style={styles.kind}>{KIND_LABELS[m.kind]}</Text>
                  {/* The server's exact message — this is the whole point of
                      the screen, so it is shown verbatim, never masked. */}
                  <Text style={styles.error}>{m.lastError ?? 'Rejet sans détail'}</Text>
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.retryButton]}
                      onPress={() => retry(m.id)}
                      accessibilityRole="button"
                      accessibilityLabel="Réessayer"
                    >
                      <Text style={styles.retryLabel}>Réessayer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => remove(m.id)}
                      accessibilityRole="button"
                      accessibilityLabel="Supprimer"
                    >
                      <Text style={styles.deleteLabel}>Supprimer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {pending.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>EN ATTENTE</Text>
              {pending.map((m) => (
                <View key={m.id}>
                  <View style={styles.pendingRow}>
                    <Text style={styles.kind}>{KIND_LABELS[m.kind]}</Text>
                    <Text style={styles.pendingHint}>En attente de sync</Text>
                  </View>
                  <View style={styles.rule} />
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.field.background,
  },
  header: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingTop: tokens.spacing[4],
    paddingBottom: tokens.spacing[4],
  },
  backLabel: {
    ...tokens.typography.bodyMd,
    color: tokens.colors.field.textMuted,
  },
  title: {
    ...tokens.typography.displayMd,
    color: tokens.colors.field.text,
    marginTop: tokens.spacing[1],
  },
  rule: {
    height: tokens.layout.ruleWidth,
    backgroundColor: tokens.colors.field.rule,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.layout.screenPadding,
  },
  empty: {
    ...tokens.typography.headingMd,
    color: tokens.colors.field.textMuted,
  },
  list: {
    paddingBottom: tokens.spacing[6],
  },
  section: {
    paddingTop: tokens.spacing[4],
  },
  sectionLabel: {
    ...tokens.typography.label,
    color: tokens.colors.field.textMuted,
    paddingHorizontal: tokens.layout.screenPadding,
    paddingBottom: tokens.spacing[2],
  },
  failedRow: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingVertical: tokens.spacing[4],
    borderTopWidth: tokens.layout.ruleWidth,
    borderTopColor: tokens.colors.field.rule,
    gap: tokens.spacing[2],
  },
  kind: {
    ...tokens.typography.headingMd,
    color: tokens.colors.field.text,
  },
  error: {
    ...tokens.typography.bodyMd,
    color: tokens.colors.action.danger.bg,
  },
  actions: {
    flexDirection: 'row',
    gap: tokens.spacing[3],
    marginTop: tokens.spacing[2],
  },
  actionButton: {
    minHeight: tokens.touch.field,
    flex: 1,
    borderRadius: tokens.radii.md,
    borderWidth: tokens.layout.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[3],
  },
  retryButton: {
    backgroundColor: tokens.colors.action.commit.bg,
    borderColor: tokens.colors.action.commit.border,
  },
  retryLabel: {
    ...tokens.typography.button,
    color: tokens.colors.action.commit.fg,
  },
  deleteButton: {
    backgroundColor: tokens.colors.action.secondary.bg,
    borderColor: tokens.colors.action.secondary.border,
  },
  deleteLabel: {
    ...tokens.typography.button,
    color: tokens.colors.action.danger.bg,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.layout.screenPadding,
    paddingVertical: tokens.spacing[4],
    gap: tokens.spacing[3],
  },
  pendingHint: {
    ...tokens.typography.bodyMd,
    color: tokens.colors.field.textMuted,
  },
});
