/**
 * Réglages ponte — créneaux, calibres, plateaux.
 *
 * The web shows three correlated sub-catalogs side by side, read-only, and sends you elsewhere to
 * change anything. Side by side is not available on five inches, and read-only is not a setting
 * screen.
 *
 * So the three are stacked in the order they are used during a collection round — when you
 * collect, how you sort, what you put it in — and each is editable in place.
 *
 * They do not share a storage mechanism, which is the thing to know before touching this file:
 * créneaux and calibres are **catalog items** (`egg_timeslots`, `egg_grades`), while tray size
 * and tray price are **farm settings** — plain key/value strings under `tray_size` and
 * `tray_price_xof`. The screen hides that split; the code cannot.
 */
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft, Clock, Egg, Layers } from 'lucide-react-native';
import { fontFamily, tokens } from '@/theme';
import { FormField } from '@/components/field/FormField';
import { useFarmAccess } from '@/auth/useSession';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { useListTimeslotsQuery, useUpsertFarmSettingMutation } from '@/store/api/layerConfigApi';
import { useGetGradesQuery, useGetTraySettingsQuery } from '@/store/api/eggProductionApi';
import { formatCurrency } from '@/lib/format';

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const digits = (s: string) => s.replace(/[^\d]/g, '');

export default function LayerSettingsScreen() {
  const router = useRouter();
  const farmId = useSelector(selectSelectedFarmId);
  const { can } = useFarmAccess();
  const canWrite = can('settings:write');

  const arg = farmId === null ? skipToken : { farmId };
  const { data: timeslots = [] } = useListTimeslotsQuery(farmId ?? skipToken);
  const { data: grades = [] } = useGetGradesQuery(arg);
  const { data: traySettings } = useGetTraySettingsQuery(arg);
  const [upsertSetting, { isLoading: saving }] = useUpsertFarmSettingMutation();

  const [size, setSize] = useState<string | null>(null);
  const [price, setPrice] = useState<string | null>(null);

  // null means "not being edited": the fields show the server value until someone types.
  const sizeValue = size ?? (traySettings != null ? String(traySettings.traySize) : '');
  const priceValue = price ?? (traySettings != null ? String(traySettings.trayPriceXof) : '');
  const dirty =
    traySettings != null &&
    (sizeValue !== String(traySettings.traySize) || priceValue !== String(traySettings.trayPriceXof));

  if (farmId === null) return <Redirect href="/(field)" />;

  const saveTraySettings = async () => {
    if (!dirty) return;
    try {
      // Two settings, two calls: the endpoint is one key at a time.
      await upsertSetting({ farmId, key: 'tray_size', value: sizeValue }).unwrap();
      await upsertSetting({ farmId, key: 'tray_price_xof', value: priceValue }).unwrap();
      setSize(null);
      setPrice(null);
    } catch {
      Alert.alert('Réglages plateaux', "Les valeurs n'ont pas été enregistrées.");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour"
          onPress={() => router.back()}
          style={styles.back}
        >
          <ArrowLeft size={22} color={tokens.colors.field.text} />
        </Pressable>
        <Text style={styles.topTitle}>Réglages ponte</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* 1. When you collect. */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Clock size={18} color={tokens.colors.primary[600]} />
            <Text style={styles.sectionTitle}>Créneaux de ramassage</Text>
          </View>
          <Text style={styles.sectionHint}>
            Les moments de la journée proposés à la saisie d&apos;un ramassage.
          </Text>
          <View style={styles.chips}>
            {timeslots.map((t) => (
              <View key={t.key} style={styles.chip}>
                <Text style={styles.chipText}>{str(t.value.label, t.key)}</Text>
                {str(t.value.default_time) ? (
                  <Text style={styles.chipMeta}>{str(t.value.default_time)}</Text>
                ) : null}
              </View>
            ))}
          </View>
          {canWrite ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Gérer les créneaux"
              onPress={() => router.push('/(field)/reglages/creneaux')}
              style={styles.manage}
            >
              <Text style={styles.manageText}>Gérer les créneaux</Text>
            </Pressable>
          ) : null}
        </View>

        {/* 2. How you sort. */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Egg size={18} color={tokens.colors.primary[600]} />
            <Text style={styles.sectionTitle}>Calibres</Text>
          </View>
          <Text style={styles.sectionHint}>
            Les tailles proposées au tri. Un calibre retiré n&apos;efface pas les ramassages déjà
            saisis avec.
          </Text>
          <View style={styles.chips}>
            {grades.map((g) => (
              <View key={g.key} style={styles.chip}>
                <Text style={styles.chipText}>{str(g.value.label, g.key)}</Text>
              </View>
            ))}
          </View>
          {canWrite ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Gérer les calibres"
              onPress={() => router.push('/(field)/reglages/calibres')}
              style={styles.manage}
            >
              <Text style={styles.manageText}>Gérer les calibres</Text>
            </Pressable>
          ) : null}
        </View>

        {/* 3. What you put it in. */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Layers size={18} color={tokens.colors.primary[600]} />
            <Text style={styles.sectionTitle}>Plateaux</Text>
          </View>
          <Text style={styles.sectionHint}>
            La taille du plateau convertit les œufs en plateaux partout dans l&apos;application.
          </Text>

          {canWrite ? (
            <>
              <FormField
                label="Œufs par plateau"
                value={sizeValue}
                onChangeText={(t) => setSize(digits(t))}
                keyboardType="number-pad"
                placeholder="30"
              />
              <FormField
                label="Prix du plateau (F)"
                value={priceValue}
                onChangeText={(t) => setPrice(digits(t))}
                keyboardType="number-pad"
                placeholder="2500"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Enregistrer les réglages plateaux"
                disabled={!dirty || saving}
                onPress={saveTraySettings}
                style={[styles.save, (!dirty || saving) && styles.disabled]}
              >
                <Text style={styles.saveText}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.readonly}>
              {traySettings
                ? `${traySettings.traySize} œufs · ${formatCurrency(traySettings.trayPriceXof)} le plateau`
                : '—'}
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    paddingHorizontal: tokens.spacing[2],
    paddingVertical: tokens.spacing[2],
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { ...tokens.typography.headingMd, color: tokens.colors.field.text, flex: 1 },
  content: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingBottom: tokens.spacing[16],
    gap: tokens.spacing[4],
  },
  section: {
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    backgroundColor: tokens.colors.neutral[0],
    padding: tokens.spacing[4],
    gap: tokens.spacing[3],
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  sectionTitle: {
    ...tokens.typography.bodyMd,
    fontFamily: fontFamily.sansSemiBold,
    color: tokens.colors.field.text,
  },
  sectionHint: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    borderRadius: tokens.radii.full,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[2],
  },
  chipText: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  chipMeta: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  manage: {
    minHeight: tokens.touch.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.secondary.border,
  },
  manageText: { ...tokens.typography.button, color: tokens.colors.action.secondary.fg },
  readonly: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  save: {
    minHeight: tokens.touch.primaryButton,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.action.commit.bg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.commit.border,
  },
  disabled: { opacity: 0.4 },
  saveText: { ...tokens.typography.button, color: tokens.colors.action.commit.fg },
});
