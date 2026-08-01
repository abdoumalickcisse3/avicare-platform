/**
 * Onboarding wizard — the "Terroir vivant" guided setup. The account + farm
 * already exist (created at signup); this walks the owner through configuring
 * the farm and each module, one animated panel at a time, over a sky that
 * evolves with the step. Only the content scrolls; the footer is fixed.
 *
 * A single screen drives an internal step state machine (mirrors the web
 * OnboardingWizard) rather than a route per step, so the sky cross-fade and
 * the panel slide-up stay under one component's control.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useListFarmsQuery } from '@/store/api/farmsApi';
import { ONBOARDING_STEPS, type OnboardingStepId } from '@/onboarding/steps';
import { WizardContext, type NextHandler } from '@/onboarding/wizardContext';
import { setWelcomePending } from '@/onboarding/welcomeFlag';
import { SkyBackground } from '@/components/onboarding/SkyBackground';
import { WelcomeStep } from '@/components/onboarding/steps/WelcomeStep';
import { FarmStep } from '@/components/onboarding/steps/FarmStep';
import { LivestockStep } from '@/components/onboarding/steps/LivestockStep';
import { StockStep } from '@/components/onboarding/steps/StockStep';
import { CommercialStep } from '@/components/onboarding/steps/CommercialStep';
import { FinanceStep } from '@/components/onboarding/steps/FinanceStep';
import { DoneStep } from '@/components/onboarding/steps/DoneStep';

const TOTAL = ONBOARDING_STEPS.length;

function renderStep(id: OnboardingStepId) {
  switch (id) {
    case 'welcome':
      return <WelcomeStep />;
    case 'farm':
      return <FarmStep />;
    case 'livestock':
      return <LivestockStep />;
    case 'stock':
      return <StockStep />;
    case 'commercial':
      return <CommercialStep />;
    case 'finance':
      return <FinanceStep />;
    case 'done':
      return <DoneStep />;
  }
}

export default function OnboardingWizard() {
  const router = useRouter();
  const { data: farms } = useListFarmsQuery();
  const farmId = farms?.[0]?.id;

  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [canAdvance, setCanAdvance] = useState(true);
  const nextHandlerRef = useRef<NextHandler | null>(null);

  // `index` is always clamped to a valid step by advance()/back().
  const step = ONBOARDING_STEPS[index]!;
  const isFirst = index === 0;
  const isLast = index === TOTAL - 1;

  const registerNext = useCallback((handler: NextHandler | null) => {
    nextHandlerRef.current = handler;
  }, []);

  const finish = useCallback(async () => {
    await setWelcomePending();
    router.replace('/(field)');
  }, [router]);

  const advance = useCallback(async () => {
    if (isLast) {
      void finish();
      return;
    }
    const handler = nextHandlerRef.current;
    if (handler) {
      setBusy(true);
      try {
        const ok = await handler();
        if (!ok) return;
      } finally {
        setBusy(false);
      }
    }
    void Haptics.selectionAsync();
    nextHandlerRef.current = null;
    setCanAdvance(true);
    setIndex((i) => Math.min(i + 1, TOTAL - 1));
  }, [isLast, finish]);

  const back = useCallback(() => {
    nextHandlerRef.current = null;
    setCanAdvance(true);
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  const ctx = useMemo(
    () => ({ farmId, registerNext, setCanAdvance }),
    [farmId, registerNext],
  );

  const ctaLabel = isLast ? 'Entrer dans Jawdi' : 'Continuer';

  return (
    <WizardContext.Provider value={ctx}>
      <View style={styles.root}>
        <SkyBackground stepIndex={index} total={TOTAL}>
          <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <ScrollView
              contentContainerStyle={styles.scroll}
              showsVerticalScrollIndicator={false}
            >
              <Animated.View key={index} entering={FadeInDown.duration(340)}>
                <View style={styles.panel}>{renderStep(step.id)}</View>
              </Animated.View>
            </ScrollView>

            {/* Fixed footer: ghost Back + orange commit CTA on a blurred bar. */}
            <BlurView intensity={30} tint="light" style={styles.footer}>
              <Pressable
                onPress={back}
                disabled={isFirst || busy}
                accessibilityRole="button"
                accessibilityLabel="Retour"
                style={[styles.back, isFirst && styles.hidden]}
              >
                <ArrowLeft size={18} color={tokens.colors.neutral[600]} />
                <Text style={styles.backText}>Retour</Text>
              </Pressable>

              <Pressable
                onPress={advance}
                disabled={!canAdvance || busy}
                accessibilityRole="button"
                accessibilityLabel={ctaLabel}
                style={({ pressed }) => [
                  styles.cta,
                  pressed && styles.ctaPressed,
                  (!canAdvance || busy) && styles.ctaDisabled,
                ]}
              >
                <Text style={styles.ctaText}>{busy ? '…' : ctaLabel}</Text>
                {!isLast ? <ArrowRight size={18} color={tokens.colors.earth} /> : null}
              </Pressable>
            </BlurView>
          </SafeAreaView>
        </SkyBackground>
      </View>
    </WizardContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.colors.neutral[900] },
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: tokens.spacing[5],
    paddingTop: tokens.spacing[10],
    paddingBottom: tokens.spacing[6],
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: tokens.radii.xl,
    padding: tokens.spacing[6],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing[5],
    paddingVertical: tokens.spacing[3],
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.neutral[200],
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[1], padding: tokens.spacing[2] },
  backText: { ...tokens.typography.button, color: tokens.colors.neutral[600] },
  hidden: { opacity: 0 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    minHeight: tokens.touch.primaryButton,
    paddingHorizontal: tokens.spacing[6],
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.action.commit.bg,
  },
  ctaPressed: { backgroundColor: tokens.colors.action.commit.pressedBg },
  ctaDisabled: { backgroundColor: tokens.colors.neutral[300] },
  ctaText: { ...tokens.typography.button, color: tokens.colors.action.commit.fg },
});
