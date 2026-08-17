/**
 * Réglages — hub of the farm's settings categories, mirroring the web
 * `/reglages` page (legacy ARCHITECTURE §7.13): Stock, Lots, Sanitaire, Ventes,
 * Comptabilité. Each card opens a catalog manager (`reglages/[category]`).
 * Reachable by roles with `settings:read`; catalog edits are OWNER / MANAGER.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Redirect, useRouter } from 'expo-router';
import {
  ArrowRight,
  Bell,
  Bird,
  Package,
  Receipt,
  ShoppingCart,
  Syringe,
  User,
  type LucideIcon,
} from 'lucide-react-native';
import { tokens } from '@/theme';
import { AppHeader } from '@/components/AppHeader';
import { useFarmAccess } from '@/auth/useSession';

interface SettingCategory {
  slug: string;
  name: string;
  description: string;
  icon: LucideIcon;
}

/** 5 settings categories (legacy ARCHITECTURE §7.13), same order as the web. */
const CATEGORIES: SettingCategory[] = [
  { slug: 'stock', name: 'Stock', description: 'Aliments, consommables, équipements, produits.', icon: Package },
  { slug: 'lots', name: 'Lots', description: 'Souches et races de volaille (chair, ponte).', icon: Bird },
  { slug: 'sanitaire', name: 'Sanitaire', description: 'Catalogue des vaccins et des traitements.', icon: Syringe },
  { slug: 'ventes', name: 'Ventes', description: 'Circuits de distribution.', icon: ShoppingCart },
  { slug: 'comptabilite', name: 'Comptabilité', description: 'Catégories de dépenses.', icon: Receipt },
  { slug: 'notifications', name: 'Notifications', description: 'Alertes : cloche et WhatsApp.', icon: Bell },
  { slug: 'profil', name: 'Mon profil', description: 'Nom et numéro WhatsApp.', icon: User },
];

export default function ReglagesScreen() {
  const router = useRouter();
  const { isAdmin, can, session } = useFarmAccess();

  // Token loads async — only enforce the guard once `session` resolves, else
  // it flash-redirects to Accueil before permissions are known.
  if (session && !isAdmin && !can('settings:read')) return <Redirect href="/(field)" />;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Réglages</Text>
        <Text style={styles.subtitle}>Personnalisez votre exploitation.</Text>

        <View style={styles.list}>
          {CATEGORIES.map((cat, i) => {
            const Icon = cat.icon;
            return (
              <Animated.View key={cat.slug} entering={FadeInDown.delay(i * 50).springify().damping(18)}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Gérer ${cat.name}`}
                  onPress={() => router.push(`/(field)/reglages/${cat.slug}`)}
                  style={styles.card}
                >
                  <View style={styles.iconBox}>
                    <Icon size={22} color={tokens.colors.primary[600]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{cat.name}</Text>
                    <Text style={styles.cardDesc}>{cat.description}</Text>
                  </View>
                  <ArrowRight size={18} color={tokens.colors.field.textMuted} />
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        <Text style={styles.footer}>Plus de paramètres seront disponibles à l&apos;usage.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.spacing[16] },
  title: { ...tokens.typography.displayMd, color: tokens.colors.field.text },
  subtitle: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[1], marginBottom: tokens.spacing[4] },
  list: { gap: tokens.spacing[3] },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    backgroundColor: tokens.colors.neutral[0],
    borderRadius: tokens.radii.xl,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    padding: tokens.spacing[4],
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: { ...tokens.typography.headingMd, fontSize: 16, color: tokens.colors.field.text },
  cardDesc: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 2 },
  footer: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[6] },
});
