import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useGetActiveAnnouncementsQuery } from '@/store/api/announcementsApi';

const SEVERITY_COLOR: Record<string, string> = {
  INFO: tokens.colors.info,
  WARNING: tokens.colors.warning,
  CRITICAL: tokens.colors.error,
};

/**
 * Platform announcements, above the field home screen.
 *
 * Dismissal is in memory rather than persisted: a field phone is opened dozens of times a day and
 * a maintenance notice that vanishes for good after one accidental tap is worse than one that
 * comes back. The announcement's own end date is what retires it.
 */
export function AnnouncementBanner() {
  const { data: announcements = [] } = useGetActiveAnnouncementsQuery();
  const [dismissed, setDismissed] = useState<number[]>([]);

  const visible = useMemo(
    () => announcements.filter((a) => !dismissed.includes(a.id)),
    [announcements, dismissed],
  );

  if (visible.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      {visible.map((a) => (
        <View
          key={a.id}
          style={[styles.banner, { borderLeftColor: SEVERITY_COLOR[a.severity] ?? tokens.colors.info }]}
        >
          <View style={styles.text}>
            <Text style={styles.title}>{a.title}</Text>
            <Text style={styles.body}>{a.body}</Text>
          </View>
          <Pressable
            onPress={() => setDismissed((current) => [...current, a.id])}
            accessibilityRole="button"
            accessibilityLabel={`Fermer l'annonce ${a.title}`}
            hitSlop={10}
          >
            <X size={18} color={tokens.colors.field.textMuted} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: tokens.spacing[2], marginBottom: tokens.spacing[3] },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing[3],
    backgroundColor: tokens.colors.field.surface,
    borderLeftWidth: 4,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing[4],
  },
  text: { flex: 1, gap: tokens.spacing[1] },
  title: { fontSize: 15, fontWeight: '700', color: tokens.colors.field.text },
  body: { fontSize: 14, color: tokens.colors.field.textMuted, lineHeight: 20 },
});
