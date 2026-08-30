/**
 * The one-time password, shown once.
 *
 * The server generates it, returns it in the response body and stores only its hash. There is no
 * second chance to read it — hence the weight given to it here, and the share button: on a phone
 * the realistic next step is sending it to the person over WhatsApp or SMS, not copying it into
 * a document. `Share` is React Native's own API, so this costs no dependency.
 */
import { Share, StyleSheet, Text, View, Pressable } from 'react-native';
import { Send } from 'lucide-react-native';
import { fontFamily, tokens } from '@/theme';

export function TemporaryPassword({
  password,
  fullName,
  email,
  onDone,
}: {
  password: string;
  fullName: string;
  email: string;
  onDone: () => void;
}) {
  const share = () => {
    Share.share({
      message: `Votre accès Jawdi\nIdentifiant : ${email}\nMot de passe provisoire : ${password}\n\nÀ changer dès la première connexion.`,
    }).catch(() => {
      // The user dismissing the share sheet is not an error worth reporting.
    });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Compte créé</Text>
      <Text style={styles.body}>
        {fullName} peut se connecter avec {email} et le mot de passe ci-dessous.
      </Text>

      <View style={styles.box}>
        <Text style={styles.label}>Mot de passe provisoire</Text>
        <Text selectable style={styles.password}>
          {password}
        </Text>
      </View>

      <Text style={styles.warn}>
        Il n&apos;est affiché qu&apos;une fois. Si vous quittez sans le transmettre, il faudra le
        réinitialiser.
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Transmettre le mot de passe"
        onPress={share}
        style={styles.share}
      >
        <Send size={18} color={tokens.colors.action.accumulate.fg} />
        <Text style={styles.shareText}>Transmettre</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="J'ai transmis le mot de passe"
        onPress={onDone}
        style={styles.done}
      >
        <Text style={styles.doneText}>J&apos;ai transmis</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: tokens.layout.screenPadding, gap: tokens.spacing[3] },
  title: { ...tokens.typography.headingLg, color: tokens.colors.field.text },
  body: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, lineHeight: 22 },
  box: {
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    backgroundColor: tokens.colors.neutral[50],
    padding: tokens.spacing[3],
    gap: tokens.spacing[1],
  },
  label: { ...tokens.typography.label, color: tokens.colors.field.textMuted },
  password: {
    fontFamily: fontFamily.mono,
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: 1,
    color: tokens.colors.field.text,
  },
  warn: { ...tokens.typography.bodySm, color: tokens.colors.warningDark, lineHeight: 18 },
  share: {
    minHeight: tokens.touch.primaryButton,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[2],
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.action.accumulate.bg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.accumulate.border,
  },
  shareText: { ...tokens.typography.button, color: tokens.colors.action.accumulate.fg },
  done: {
    minHeight: tokens.touch.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: { ...tokens.typography.button, color: tokens.colors.field.textMuted },
});
