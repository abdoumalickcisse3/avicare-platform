import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import { SectionHeader } from '@/components/ui';
import { useGetMyPartnersQuery } from '@/store/api/partnersApi';
import type { FarmPartner } from '@/types';

/** Partner logo, falling back to the initial when there is no URL or the image fails to load. */
function PartnerLogo({ partner }: { partner: FarmPartner }) {
  const [broken, setBroken] = useState(false);
  const initial = (partner.partnerName ?? '?').charAt(0).toUpperCase();

  if (!partner.partnerLogoUrl || broken) {
    return (
      <View style={styles.logo}>
        <Text style={styles.logoInitial}>{initial}</Text>
      </View>
    );
  }

  return (
    <View style={styles.logo}>
      <Image
        source={{ uri: partner.partnerLogoUrl }}
        style={styles.logoImage}
        resizeMode="contain"
        onError={() => setBroken(true)}
        accessibilityLabel={partner.partnerName ?? undefined}
      />
    </View>
  );
}

/**
 * Co-branding block: the partners whose network this farm has joined. Renders nothing when no
 * partner is CONFIRMED — most farms have none, and an empty card would just take up room on a
 * screen read one-handed in a poultry house.
 *
 * Deliberately quiet: it identifies the network, it does not advertise it.
 */
export function MyNetworkCard({ farmId }: { farmId: number }) {
  const router = useRouter();
  const { data: partners = [] } = useGetMyPartnersQuery({ farmId });
  const confirmed = partners.filter((p) => p.status === 'CONFIRMED');

  if (confirmed.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionHeader
        title="Mon réseau"
        action={
          <Pressable
            onPress={() => router.push('/(field)/reglages/partenaires')}
            accessibilityRole="button"
            accessibilityLabel="Gérer le partage"
          >
            <Text style={styles.link}>Gérer le partage</Text>
          </Pressable>
        }
      />
      <View style={styles.card}>
        {confirmed.map((p, i) => (
          <View key={p.membershipId} style={[styles.row, i > 0 && styles.rowBorder]}>
            <PartnerLogo partner={p} />
            <Text style={styles.name} numberOfLines={1}>
              {p.partnerName}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: tokens.spacing[6] },
  link: { ...tokens.typography.bodyMd, color: tokens.colors.primary[600], fontWeight: '600' },
  card: {
    backgroundColor: tokens.colors.neutral[0],
    borderRadius: tokens.radii.xl,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingVertical: tokens.spacing[3],
    paddingHorizontal: tokens.spacing[4],
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: tokens.colors.neutral[100] },
  logo: {
    width: 36,
    height: 36,
    borderRadius: tokens.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: tokens.colors.primary[50],
  },
  logoImage: { width: '100%', height: '100%' },
  logoInitial: {
    ...tokens.typography.bodyMd,
    fontWeight: '700',
    color: tokens.colors.primary[600],
  },
  name: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.field.text, flex: 1 },
});
