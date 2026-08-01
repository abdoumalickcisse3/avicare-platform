/**
 * Shared header block atop every onboarding step: a big Outfit display title,
 * an optional muted subtitle, then the step's content. Sits on the glassy
 * content surface over the Terroir vivant sky. See spec §3.
 */
import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '@/theme';

export function StepScaffold({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.spacing[2] },
  eyebrow: {
    ...tokens.typography.label,
    color: tokens.colors.primary[700],
    textTransform: 'uppercase',
  },
  title: {
    ...tokens.typography.displayLg,
    color: tokens.colors.neutral[900],
  },
  subtitle: {
    ...tokens.typography.bodyMd,
    color: tokens.colors.neutral[700],
    marginTop: tokens.spacing[1],
  },
  body: { marginTop: tokens.spacing[5] },
});
