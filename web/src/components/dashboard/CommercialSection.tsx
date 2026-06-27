"use client";

import {
  BentoItem,
  ChartWidget,
  ListWidget,
  StatChip,
  StatTile,
} from "@/components/dashboard/widgets";
import { colors } from "@/theme/tokens";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { CommercialSection as CommercialSectionData } from "@/types/dashboard";

/**
 * Commercial module accent — orange Sénégal (accent[400]), identifies all
 * commercial widgets in the shared bento grid via the coloured eyebrow.
 */
const COMMERCIAL_ACCENT = {
  label: "COMMERCIAL",
  color: colors.accent[400],
};

interface CommercialSectionProps {
  data: CommercialSectionData;
}

/**
 * Commercial module bento contributions.
 *
 * Returns a React fragment of `<BentoItem>` elements to be dropped directly
 * inside a `<BentoGrid>`. The fragment is transparent to the DOM so the grid
 * auto-placement treats each BentoItem as a direct grid child.
 *
 * Desktop layout (12-col grid):
 *   Row 1  CA line chart (8)       │ StatTile Impayés (4)
 *   Row 2  ListWidget clients (6)  │ ListWidget débiteurs (6)
 *   Row 3  Chip Cmd livrer (4)     │ Chip Fact encaisser (4) │ Chip Encours (4)
 *
 * Eyebrow: every item carries the COMMERCIAL accent (orange pill + label).
 * Defensive: revenueSeries / list arrays default to [] to avoid undefined crashes.
 */
export function CommercialSection({ data }: CommercialSectionProps) {
  const revenueSeries = data.revenueSeries ?? [];

  const topClientsRows = (data.topClients ?? []).map((e) => ({
    key: e.clientId,
    label: e.name,
    value: formatCurrency(e.valueXof),
    href: `/commercial/clients/${e.clientId}`,
  }));

  const topDebtorsRows = (data.topDebtors ?? []).map((e) => ({
    key: e.clientId,
    label: e.name,
    value: formatCurrency(e.valueXof),
    href: `/commercial/clients/${e.clientId}`,
  }));

  return (
    <>
      {/* CA evolution — line chart, wide */}
      <BentoItem colSpan={8} accent={COMMERCIAL_ACCENT}>
        <ChartWidget
          label="Évolution du CA"
          series={revenueSeries}
          kind="line"
          yFormatter={formatNumber}
          color={colors.accent[400]}
          emptyMessage="Aucune donnée de chiffre d'affaires pour la période."
        />
      </BentoItem>

      {/* Impayés — alert tile when overdue > 0 */}
      <BentoItem colSpan={4} accent={COMMERCIAL_ACCENT}>
        <StatTile
          label="Impayés"
          value={data.overdueXof}
          kind="currency"
          alert={data.overdueXof > 0}
        />
      </BentoItem>

      {/* Top clients by CA */}
      <BentoItem colSpan={6} accent={COMMERCIAL_ACCENT}>
        <ListWidget
          title="Top clients (CA)"
          items={topClientsRows}
          emptyMessage="Aucun client pour la période."
        />
      </BentoItem>

      {/* Top débiteurs by outstanding balance */}
      <BentoItem colSpan={6} accent={COMMERCIAL_ACCENT}>
        <ListWidget
          title="Top débiteurs (encours)"
          items={topDebtorsRows}
          emptyMessage="Aucun encours client."
        />
      </BentoItem>

      {/* Commandes à livrer */}
      <BentoItem colSpan={4} accent={COMMERCIAL_ACCENT}>
        <StatChip
          label="Cmd. à livrer"
          value={formatNumber(data.ordersToDeliver)}
          color={colors.accent[400]}
        />
      </BentoItem>

      {/* Factures à encaisser */}
      <BentoItem colSpan={4} accent={COMMERCIAL_ACCENT}>
        <StatChip
          label="Fact. à encaisser"
          value={formatNumber(data.invoicesToCollect)}
          color={colors.accent[500]}
        />
      </BentoItem>

      {/* Encours total */}
      <BentoItem colSpan={4} accent={COMMERCIAL_ACCENT}>
        <StatChip
          label="Encours clients"
          value={formatCurrency(data.outstandingXof)}
          color={colors.info.main}
        />
      </BentoItem>
    </>
  );
}
