"use client";

import {
  BentoItem,
  ChartWidget,
  GaugeWidget,
  StatChip,
} from "@/components/dashboard/widgets";
import { colors } from "@/theme/tokens";
import { formatNumber } from "@/lib/format";
import type { LivestockSection as LivestockSectionData } from "@/types/dashboard";

/**
 * Élevage module accent — primary green, identifies all livestock widgets in
 * the shared bento grid via the coloured eyebrow.
 */
const LIVESTOCK_ACCENT = {
  label: "ÉLEVAGE",
  color: colors.primary[500],
};

interface LivestockSectionProps {
  data: LivestockSectionData;
}

/**
 * Livestock module bento contributions.
 *
 * Returns a React fragment of `<BentoItem>` elements to be dropped directly
 * inside a `<BentoGrid>`. Each item carries the ÉLEVAGE green eyebrow.
 *
 * Conditional widgets (colSpan adapts when a gauge is absent):
 *   - Mortalité chart  (8 when mortalityRate present, else 12)
 *   - GaugeWidget Taux mortalité  (4, only when mortalityRate != null)
 *   - Production œufs chart  (8 when layingRate present, else 12;
 *       rendered only when layingSeries is non-empty)
 *   - GaugeWidget Taux de ponte  (4, only when layingRate != null)
 *   - StatChip GMQ  (4, only when avgDailyGainG != null)
 *   - StatChip Vaccinations (4) · StatChip Traitements (4)
 *
 * Defensive: all optional series default to [] to guard against null/undefined
 * (prior `layingSeries` crash was a JSON-skew; never assume lists are present).
 */
export function LivestockSection({ data }: LivestockSectionProps) {
  const mortalitySeries = data.mortalitySeries ?? [];
  const layingSeries = data.layingSeries ?? [];

  const hasMortalityRate = data.mortalityRate != null;
  const hasLayingRate = data.layingRate != null;
  const hasLayingSeries = layingSeries.length > 0;
  const hasGMQ = data.avgDailyGainG != null;

  return (
    <>
      {/* Mortalité bar chart — narrowed when a gauge is shown alongside it */}
      <BentoItem colSpan={hasMortalityRate ? 8 : 12} accent={LIVESTOCK_ACCENT}>
        <ChartWidget
          label="Mortalité journalière"
          series={mortalitySeries}
          kind="bar"
          color={colors.error.main}
          emptyMessage="Aucune mortalité enregistrée pour la période."
        />
      </BentoItem>

      {/* Taux mortalité gauge — only when the backend provides the rate */}
      {hasMortalityRate && (
        <BentoItem colSpan={4} accent={LIVESTOCK_ACCENT}>
          <GaugeWidget
            value={data.mortalityRate!}
            label="Taux mortalité"
            color={colors.error.main}
          />
        </BentoItem>
      )}

      {/* Production d'œufs line chart — only when egg-count data is present */}
      {hasLayingSeries && (
        <BentoItem colSpan={hasLayingRate ? 8 : 12} accent={LIVESTOCK_ACCENT}>
          <ChartWidget
            label="Production d'œufs"
            series={layingSeries}
            kind="line"
            color={colors.primary[400]}
            emptyMessage="Aucune production enregistrée."
          />
        </BentoItem>
      )}

      {/* Taux de ponte gauge — only when the backend provides the rate */}
      {hasLayingRate && (
        <BentoItem colSpan={hasLayingSeries ? 4 : 6} accent={LIVESTOCK_ACCENT}>
          <GaugeWidget
            value={data.layingRate!}
            label="Taux de ponte"
            color={colors.primary[500]}
          />
        </BentoItem>
      )}

      {/* GMQ chip — broiler flocks only */}
      {hasGMQ && (
        <BentoItem colSpan={4} accent={LIVESTOCK_ACCENT}>
          <StatChip
            label="GMQ"
            value={`${formatNumber(data.avgDailyGainG!)} g/j`}
            color={colors.success.main}
          />
        </BentoItem>
      )}

      {/* Vaccinations counter */}
      <BentoItem colSpan={4} accent={LIVESTOCK_ACCENT}>
        <StatChip
          label="Vaccinations"
          value={formatNumber(data.vaccinationsCount)}
          color={colors.vet.main}
        />
      </BentoItem>

      {/* Traitements counter */}
      <BentoItem colSpan={4} accent={LIVESTOCK_ACCENT}>
        <StatChip
          label="Traitements"
          value={formatNumber(data.treatmentsCount)}
          color={colors.warning.main}
        />
      </BentoItem>
    </>
  );
}
