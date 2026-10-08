/**
 * A phone field that knows which country it is in.
 *
 * Before this, every phone field was a bare text input with "221770000000" as a placeholder, and
 * the backend guessed the country from the digits. It guessed wrong: on 2026-10-02 three Beninese
 * numbers were read as Senegalese ones, grew to sixteen digits, and eighteen WhatsApp alerts went
 * nowhere. The guessing is the bug — so the country is now chosen, not inferred.
 *
 * The value in and out is always E.164 (`+221771842787`), one shape everywhere. What the user
 * types is only the subscriber part; the country carries the rest.
 */
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { tokens } from '@/theme';
import { COUNTRIES, type Country, splitE164, toE164 } from '@/phone/countries';

export function PhoneInput({
  value,
  onChange,
  label = 'Téléphone (WhatsApp)',
  hint,
  accessibilityLabel,
}: {
  value: string | null | undefined;
  onChange: (e164: string) => void;
  label?: string;
  hint?: string;
  accessibilityLabel?: string;
}) {
  const parsed = useMemo(() => splitE164(value), [value]);
  // The country is held locally so that clearing the number does not reset the flag the user
  // just picked — an empty value carries no country of its own.
  const [country, setCountry] = useState<Country>(parsed.country);
  const [picking, setPicking] = useState(false);

  const current = value ? parsed.country : country;

  const pick = (c: Country) => {
    setCountry(c);
    setPicking(false);
    onChange(toE164(c, parsed.local));
  };

  /**
   * People paste their whole number, '+221 77 123 45 67' and all. Treating that as the subscriber
   * part doubles the country code and produces +221221771234567 — which is exactly the sixteen-
   * digit shape that broke WhatsApp in the first place. A leading '+' is unambiguous, so it is
   * read as a full number and the picker follows it.
   */
  const typed = (text: string) => {
    if (text.trim().startsWith('+')) {
      const full = splitE164(text);
      setCountry(full.country);
      onChange(toE164(full.country, full.local));
      return;
    }
    onChange(toE164(current, text));
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          style={styles.country}
          onPress={() => setPicking(true)}
          accessibilityRole="button"
          accessibilityLabel={`Indicatif pays : ${current.name}, +${current.dial}`}
        >
          <Text style={styles.flag}>{current.flag}</Text>
          <Text style={styles.dial}>+{current.dial}</Text>
          <ChevronDown size={18} color={tokens.colors.field.textMuted} />
        </Pressable>
        <TextInput
          value={parsed.local}
          onChangeText={typed}
          style={styles.input}
          placeholder={current.example}
          placeholderTextColor={tokens.colors.field.textMuted}
          keyboardType="phone-pad"
          accessibilityLabel={accessibilityLabel ?? label}
        />
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <Modal visible={picking} animationType="slide" transparent onRequestClose={() => setPicking(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPicking(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Choisir le pays</Text>
            <FlatList
              data={COUNTRIES}
              keyExtractor={(c) => c.iso}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.option}
                  onPress={() => pick(item)}
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                >
                  <Text style={styles.flag}>{item.flag}</Text>
                  <Text style={styles.optionName}>{item.name}</Text>
                  <Text style={styles.optionDial}>+{item.dial}</Text>
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
  row: { flexDirection: 'row', gap: tokens.spacing[2] },
  country: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1],
    paddingHorizontal: tokens.spacing[3],
    minHeight: tokens.touch.field,
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    backgroundColor: tokens.colors.neutral[0],
  },
  flag: { fontSize: 22 },
  dial: { ...tokens.typography.bodyLg, color: tokens.colors.field.text },
  input: {
    flex: 1,
    minHeight: tokens.touch.field,
    paddingHorizontal: tokens.spacing[3],
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    backgroundColor: tokens.colors.neutral[0],
    ...tokens.typography.bodyLg,
    color: tokens.colors.field.text,
  },
  hint: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[1] },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: tokens.colors.neutral[0],
    borderTopLeftRadius: tokens.radii.xl,
    borderTopRightRadius: tokens.radii.xl,
    paddingTop: tokens.spacing[4],
    maxHeight: '70%',
  },
  sheetTitle: {
    ...tokens.typography.headingMd,
    color: tokens.colors.field.text,
    paddingHorizontal: tokens.spacing[4],
    marginBottom: tokens.spacing[2],
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.spacing[4],
    minHeight: tokens.touch.field,
  },
  optionName: { ...tokens.typography.bodyLg, color: tokens.colors.field.text, flex: 1 },
  optionDial: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted },
});
