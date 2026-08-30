/**
 * Compose a feed formula — the second "desktop" screen this lot redesigns.
 *
 * The web lays this out as a table of percentage inputs with a live cost in a corner. Two things
 * make that unworkable on a phone: the ingredient rows need a real touch target each, and the two
 * numbers that actually matter — the total, and the cost per 100 kg — end up off-screen while
 * you type.
 *
 * So the two numbers are pinned at the top and never move, and the ingredients scroll underneath.
 * Every edit is answered immediately above the thumb doing it.
 *
 * The rule that decides the rest: the backend treats a total other than 100 % as a NON-BLOCKING
 * warning. A formula can be saved half-composed. The banner therefore reports the gap and offers
 * to close it — "Répartir" scales the lines proportionally — but the save button never disables
 * on it.
 */
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft, Plus, X } from 'lucide-react-native';
import { fontFamily, tokens } from '@/theme';
import { FormField } from '@/components/field/FormField';
import { Chip } from '@/team/Chip';
import { useFarmAccess } from '@/auth/useSession';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import {
  useCreateFeedFormulaMutation,
  useGetFeedFormulaQuery,
  useUpdateFeedFormulaMutation,
} from '@/store/api/feedFormulasApi';
import { useGetAllArticlesQuery } from '@/store/api/inventoryCatalogApi';
import {
  addIngredient,
  estimatedCostPer100kg,
  normaliseTo100,
  percentageGap,
  phaseLabel,
  removeIngredient,
  setPercentage,
  totalPercentage,
} from '@/inventory/formula';
import { formatCurrency } from '@/lib/format';
import type { FeedPhase, FormulaIngredient } from '@/types';

const PHASES: FeedPhase[] = ['STARTER', 'GROWER', 'FINISHER', 'PRE_LAYER', 'LAYER', 'BREEDER', 'OTHER'];

export default function FormulaEditorScreen() {
  const { formulaId } = useLocalSearchParams<{ formulaId?: string }>();
  const id = formulaId ? Number(formulaId) : null;
  const router = useRouter();
  const farmId = useSelector(selectSelectedFarmId);
  const { can } = useFarmAccess();

  const { data: existing } = useGetFeedFormulaQuery(
    farmId === null || id === null ? skipToken : { farmId, id },
  );
  const { data: articles = [] } = useGetAllArticlesQuery(
    farmId === null ? skipToken : { farmId },
  );

  const [create, { isLoading: creating }] = useCreateFeedFormulaMutation();
  const [update, { isLoading: updating }] = useUpdateFeedFormulaMutation();

  const [name, setName] = useState('');
  const [phase, setPhase] = useState<FeedPhase>('STARTER');
  const [ingredients, setIngredients] = useState<FormulaIngredient[]>([]);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setPhase(existing.targetPhase);
    setIngredients(existing.ingredients);
  }, [existing]);

  const total = totalPercentage(ingredients);
  const gap = percentageGap(ingredients);
  const cost = useMemo(() => estimatedCostPer100kg(ingredients, articles), [ingredients, articles]);

  const labelOf = useMemo(() => {
    const map = new Map(articles.map((a) => [a.articleKey, a.label]));
    return (key: string) => map.get(key) ?? key;
  }, [articles]);

  const available = articles.filter((a) => !ingredients.some((i) => i.articleKey === a.articleKey));

  if (farmId === null) return <Redirect href="/(field)" />;
  if (!can('inventory:write')) return <Redirect href="/(field)/stocks/formules" />;

  const saving = creating || updating;
  const canSave = name.trim().length > 0 && ingredients.length > 0 && !saving;

  const submit = async () => {
    if (!canSave) return;
    const body = { name: name.trim(), targetPhase: phase, ingredients };
    try {
      if (id !== null) await update({ farmId, id, body }).unwrap();
      else await create({ farmId, body }).unwrap();
      router.back();
    } catch {
      Alert.alert(
        'Formule non enregistrée',
        "Vérifiez que chaque ingrédient est bien un article de votre stock et que sa part est comprise entre 0 et 100.",
      );
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
        <Text style={styles.topTitle}>{id !== null ? 'Modifier la formule' : 'Nouvelle formule'}</Text>
      </View>

      {/* The two numbers that matter, pinned so typing never pushes them away. */}
      <View style={styles.readout}>
        <View style={styles.readoutCell}>
          <Text style={styles.readoutLabel}>Total</Text>
          <Text
            style={[styles.readoutValue, total !== 100 && styles.readoutWarn]}
            accessibilityLabel="Total des parts"
          >
            {total} %
          </Text>
        </View>
        <View style={styles.readoutRule} />
        <View style={styles.readoutCell}>
          <Text style={styles.readoutLabel}>Coût / 100 kg</Text>
          <Text style={styles.readoutValue}>{cost != null ? formatCurrency(cost) : '—'}</Text>
        </View>
      </View>

      {gap !== 0 && ingredients.length > 0 ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            {gap < 0
              ? `Il manque ${Math.abs(gap)} % pour atteindre 100.`
              : `Le total dépasse 100 % de ${gap} %.`}{' '}
            Vous pouvez enregistrer quand même et finir plus tard.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Répartir jusqu'à 100 %"
            onPress={() => setIngredients(normaliseTo100(ingredients))}
            style={styles.bannerBtn}
          >
            <Text style={styles.bannerBtnText}>Répartir</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FormField
          label="Nom de la formule"
          required
          value={name}
          onChangeText={setName}
          placeholder="Démarrage maison"
          maxLength={120}
        />

        <View>
          <Text style={styles.label}>Phase visée</Text>
          <View style={styles.chips}>
            {PHASES.map((p) => (
              <Chip
                key={p}
                label={phaseLabel(p)}
                active={phase === p}
                accessibilityLabel={`Phase ${phaseLabel(p)}`}
                onPress={() => setPhase(p)}
              />
            ))}
          </View>
        </View>

        <Text style={styles.label}>Ingrédients</Text>
        {ingredients.length === 0 ? (
          <Text style={styles.muted}>
            Ajoutez les articles de votre stock qui composent cette formule.
          </Text>
        ) : (
          ingredients.map((i) => (
            <View key={i.articleKey} style={styles.ingredient}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ingredientName} numberOfLines={1}>
                  {labelOf(i.articleKey)}
                </Text>
                {/* A share is also a weight: 35 % is 35 kg in 100 kg, and that is how it is bought. */}
                <Text style={styles.ingredientKg}>{i.percentage} kg pour 100 kg</Text>
              </View>
              <FormField
                label=""
                value={String(i.percentage)}
                onChangeText={(t) =>
                  setIngredients(setPercentage(ingredients, i.articleKey, Number(t.replace(',', '.'))))
                }
                keyboardType="decimal-pad"
                style={styles.percentInput}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Retirer ${labelOf(i.articleKey)}`}
                onPress={() => setIngredients(removeIngredient(ingredients, i.articleKey))}
                style={styles.remove}
              >
                <X size={18} color={tokens.colors.field.textMuted} />
              </Pressable>
            </View>
          ))
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ajouter un ingrédient"
          onPress={() => setPicking((p) => !p)}
          style={styles.addBtn}
        >
          <Plus size={18} color={tokens.colors.field.text} />
          <Text style={styles.addText}>Ajouter un ingrédient</Text>
        </Pressable>

        {picking ? (
          <View style={styles.picker}>
            {available.length === 0 ? (
              <Text style={styles.muted}>Tous vos articles sont déjà dans la formule.</Text>
            ) : (
              available.map((a) => (
                <Pressable
                  key={a.articleKey}
                  accessibilityRole="button"
                  accessibilityLabel={`Ajouter ${a.label}`}
                  onPress={() => {
                    setIngredients(addIngredient(ingredients, a.articleKey));
                    setPicking(false);
                  }}
                  style={styles.pickerRow}
                >
                  <Text style={styles.pickerLabel}>{a.label}</Text>
                  {a.typicalUnitPriceXof != null ? (
                    <Text style={styles.pickerPrice}>{formatCurrency(a.typicalUnitPriceXof)}/{a.unit ?? 'u'}</Text>
                  ) : (
                    <Text style={styles.pickerNoPrice}>sans prix</Text>
                  )}
                </Pressable>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          onPress={submit}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityLabel="Enregistrer la formule"
          style={[styles.save, !canSave && styles.disabled]}
        >
          <Text style={styles.saveText}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Text>
        </Pressable>
      </View>
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

  readout: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: tokens.layout.screenPadding,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.neutral[0],
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    paddingVertical: tokens.spacing[3],
  },
  readoutCell: { flex: 1, alignItems: 'center', gap: 2 },
  readoutRule: { width: 1, alignSelf: 'stretch', backgroundColor: tokens.colors.field.ruleSubtle },
  readoutLabel: { ...tokens.typography.label, color: tokens.colors.field.textMuted },
  readoutValue: {
    ...tokens.typography.numericSm,
    color: tokens.colors.field.text,
    fontVariant: ['tabular-nums'],
  },
  readoutWarn: { color: tokens.colors.warningDark },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    marginHorizontal: tokens.layout.screenPadding,
    marginTop: tokens.spacing[2],
    padding: tokens.spacing[3],
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.warningLight,
  },
  bannerText: { ...tokens.typography.bodySm, color: tokens.colors.warningDark, flex: 1, lineHeight: 18 },
  bannerBtn: {
    minHeight: tokens.touch.min,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[4],
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.neutral[0],
  },
  bannerBtnText: { ...tokens.typography.button, color: tokens.colors.warningDark },

  content: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingTop: tokens.spacing[4],
    paddingBottom: tokens.spacing[10],
    gap: tokens.spacing[4],
  },
  label: { ...tokens.typography.label, color: tokens.colors.field.textMuted },
  muted: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2], marginTop: tokens.spacing[2] },

  ingredient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    backgroundColor: tokens.colors.neutral[0],
    padding: tokens.spacing[3],
  },
  ingredientName: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  ingredientKg: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  percentInput: { width: 84 },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  addBtn: {
    minHeight: tokens.touch.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[2],
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.secondary.border,
    backgroundColor: tokens.colors.action.secondary.bg,
  },
  addText: { ...tokens.typography.button, color: tokens.colors.action.secondary.fg },

  picker: {
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    backgroundColor: tokens.colors.neutral[0],
    overflow: 'hidden',
  },
  pickerRow: {
    minHeight: tokens.touch.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.field.ruleSubtle,
  },
  pickerLabel: { ...tokens.typography.bodyMd, color: tokens.colors.field.text, flex: 1 },
  pickerPrice: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  pickerNoPrice: { ...tokens.typography.bodySm, color: tokens.colors.warningDark },

  actions: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingTop: tokens.spacing[3],
    paddingBottom: tokens.spacing[6],
    borderTopWidth: 1,
    borderTopColor: tokens.colors.field.ruleSubtle,
  },
  save: {
    minHeight: tokens.touch.cta,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.action.commit.bg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.commit.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  saveText: { ...tokens.typography.button, color: tokens.colors.action.commit.fg },
});
