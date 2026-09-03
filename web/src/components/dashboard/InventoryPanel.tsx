"use client";

import { Alert, Box, Card, CardContent, Typography } from "@mui/material";
import { colors } from "@/theme/tokens";
import { formatCurrency, formatNumber } from "@/lib/format";
import { MiniStat } from "@/components/dashboard/MiniStat";
import type { InventorySection } from "@/types/dashboard";

/**
 * "Stocks" detail panel — what is on hand, what it is worth, and what left over the period.
 *
 * The value is a floor, not a truth: `typical_unit_price_xof` is nullable, so an article
 * without a price weighs nothing. When some article is unpriced the panel says so, because a
 * silent understatement always errs in the same direction — it makes the farm look richer.
 */
export function InventoryPanel({ data }: { data: InventorySection }) {
  const unpriced = data.totalArticles - data.pricedArticles;

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography sx={{ fontWeight: 700, fontSize: "1rem", mb: 1.5 }}>Stocks</Typography>

        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1.25 }}>
          <MiniStat
            label="Valeur du stock"
            value={formatCurrency(data.stockValueXof)}
            tint={colors.primary[500]}
          />
          <MiniStat
            label="Articles sous le seuil"
            value={formatNumber(data.lowStockCount)}
            tint={colors.warning.main}
            alert={data.lowStockCount > 0}
          />
          <MiniStat
            label="Consommé (période)"
            value={formatCurrency(data.consumedValueXof)}
            tint={colors.accent[400]}
          />
          <MiniStat
            label="Articles suivis"
            value={formatNumber(data.totalArticles)}
            tint={colors.info.main}
          />
        </Box>

        {data.valuationIncomplete && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {unpriced === 1
              ? "1 article n'a pas de prix"
              : `${unpriced} articles n'ont pas de prix`}{" "}
            ({data.pricedArticles}/{data.totalArticles} valorisés).{" "}
            <strong>La valeur réelle est plus élevée.</strong>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
