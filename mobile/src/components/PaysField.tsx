/**
 * Le pays d'une ferme, choisi et non deviné.
 *
 * Même parti pris que {@link PhoneInput} : la liste s'ouvre en feuille, le choix est explicite.
 * Ce que le pays décide — le fuseau horaire et le nom du champ fiscal imprimé sur la facture —
 * est résolu par le serveur depuis son catalogue ; cet écran ne fait que montrer un nom.
 */
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { tokens } from '@/theme';
import { PAYS_DEFAUT, PAYS_XOF } from '@/pays';

export function PaysField({
  value,
  onChange,
  label = 'Pays',
  hint,
}: {
  value: string | null | undefined;
  onChange: (iso: string) => void;
  label?: string;
  hint?: string;
}) {
  const [picking, setPicking] = useState(false);
  const iso = value ?? PAYS_DEFAUT;
  const current = PAYS_XOF.find((p) => p.iso === iso) ?? PAYS_XOF[0]!;

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={styles.field}
        onPress={() => setPicking(true)}
        accessibilityRole="button"
        accessibilityLabel={`Pays : ${current.nom}`}
      >
        <Text style={styles.value}>{current.nom}</Text>
        <ChevronDown size={18} color={tokens.colors.field.textMuted} />
      </Pressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <Modal visible={picking} animationType="slide" transparent onRequestClose={() => setPicking(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPicking(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Choisir le pays</Text>
            <FlatList
              data={PAYS_XOF}
              keyExtractor={(p) => p.iso}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.option}
                  onPress={() => {
                    onChange(item.iso);
                    setPicking(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={item.nom}
                >
                  <Text style={styles.optionName}>{item.nom}</Text>
                  {item.iso === current.iso ? (
                    <Check size={20} color={tokens.colors.primary[600]} />
                  ) : null}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...tokens.typography.label, color: tokens.colors.field.textMuted, marginBottom: tokens.spacing[1] },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing[3],
    minHeight: tokens.touch.field,
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    backgroundColor: tokens.colors.neutral[0],
  },
  value: { ...tokens.typography.bodyLg, color: tokens.colors.field.text },
  hint: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[1] },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: tokens.colors.neutral[0],
    borderTopLeftRadius: tokens.radii.xl,
    borderTopRightRadius: tokens.radii.xl,
    paddingTop: tokens.spacing[4],
    paddingHorizontal: tokens.spacing[4],
    maxHeight: '70%',
  },
  sheetTitle: { ...tokens.typography.headingMd, color: tokens.colors.field.text, marginBottom: tokens.spacing[3] },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingVertical: tokens.spacing[3],
  },
  optionName: { ...tokens.typography.bodyLg, color: tokens.colors.field.text, flex: 1 },
});
