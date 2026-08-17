/**
 * Notifications — the field-app bell screen (Sprint C1). Lists the farm's
 * materialized notifications (newest first) with pull-to-refresh; tapping one
 * marks it read and deep-links to the relevant screen. "Tout lire" clears the
 * unread badge. Mirrors the web header bell dropdown. Any farm member sees it.
 */
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft, CheckCheck } from 'lucide-react-native';
import { tokens } from '@/theme';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import {
  useGetNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from '@/store/api/notificationsApi';
import type { AppNotification, NotificationSeverity } from '@/types';

const SEVERITY_COLOR: Record<NotificationSeverity, string> = {
  INFO: tokens.colors.neutral[400],
  WARNING: tokens.colors.warning,
  CRITICAL: tokens.colors.error,
};

/** Deep-link target for a notification, from its sourceRef. */
function hrefFor(n: AppNotification): string | null {
  const ref = n.sourceRef ?? {};
  if (typeof ref.unitId === 'number') return `/(field)/lots/${ref.unitId}`;
  if (typeof ref.itemId === 'number' || typeof ref.purchaseOrderId === 'number')
    return '/(field)/(tabs)/stocks';
  if (typeof ref.invoiceId === 'number') return '/(field)/commerce/factures';
  if (typeof ref.clientId === 'number') return '/(field)/commerce/commandes';
  return null;
}

function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const selectedFarmId = useSelector(selectSelectedFarmId);

  const { data, isFetching, refetch } = useGetNotificationsQuery(
    selectedFarmId === null ? skipToken : { farmId: selectedFarmId, size: 30 },
  );
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead] = useMarkAllNotificationsReadMutation();

  if (selectedFarmId === null) {
    return <Redirect href="/(field)" />;
  }

  const items = data?.items ?? [];

  const open = (n: AppNotification) => {
    if (!n.read) markRead({ farmId: selectedFarmId, id: n.id });
    const href = hrefFor(n);
    if (href) router.push(href as never);
  };

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
        <Pressable
          onPress={() => markAllRead({ farmId: selectedFarmId })}
          accessibilityRole="button"
          accessibilityLabel="Tout marquer comme lu"
          hitSlop={8}
          style={styles.allBtn}
        >
          <CheckCheck size={18} color={tokens.colors.primary[600]} />
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(n) => String(n.id)}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        ListEmptyComponent={
          !isFetching ? <Text style={styles.muted}>Aucune notification</Text> : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => open(item)}
            style={[styles.row, !item.read && styles.rowUnread]}
            accessibilityRole="button"
            accessibilityLabel={item.title}
          >
            <View style={[styles.dot, { backgroundColor: SEVERITY_COLOR[item.severity] }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, !item.read && styles.rowTitleUnread]} numberOfLines={1}>
                {item.title}
              </Text>
              {item.body ? (
                <Text style={styles.rowBody} numberOfLines={2}>
                  {item.body}
                </Text>
              ) : null}
              <Text style={styles.rowTime}>{timeAgo(item.createdAt)}</Text>
            </View>
          </Pressable>
        )}
      />
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
  title: { ...tokens.typography.displayMd, color: tokens.colors.field.text, flex: 1 },
  allBtn: {
    width: 40,
    height: 40,
    borderRadius: tokens.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primary[50],
  },
  content: { paddingHorizontal: tokens.layout.screenPadding, paddingBottom: tokens.spacing[8] },
  muted: {
    ...tokens.typography.bodyMd,
    color: tokens.colors.field.textMuted,
    textAlign: 'center',
    paddingVertical: tokens.spacing[8],
  },
  row: {
    flexDirection: 'row',
    gap: tokens.spacing[3],
    paddingVertical: tokens.spacing[3],
    paddingHorizontal: tokens.spacing[3],
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.neutral[0],
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    marginTop: tokens.spacing[2],
  },
  rowUnread: { borderColor: tokens.colors.primary[200], backgroundColor: tokens.colors.primary[50] },
  dot: { width: 10, height: 10, borderRadius: tokens.radii.full, marginTop: 5 },
  rowTitle: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  rowTitleUnread: { fontWeight: '800' },
  rowBody: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 2 },
  rowTime: { ...tokens.typography.bodySm, color: tokens.colors.neutral[400], marginTop: 4 },
});
