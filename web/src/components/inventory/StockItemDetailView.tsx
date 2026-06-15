"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from "@mui/material";
import { Plus } from "lucide-react";
import {
  useGetMovementsByItemQuery,
  useGetStockItemQuery,
} from "@/store/api/inventoryStockApi";
import { useInventoryGating } from "@/hooks/useInventoryGating";
import { StockHistoryChart } from "./StockHistoryChart";
import { StockMovementDialog } from "./StockMovementDialog";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import {
  ARTICLE_SOURCE_LABELS,
  MOVEMENT_REASON_LABELS,
  MOVEMENT_TYPE_LABELS,
  STOCK_STATE_META,
  consumptionInLastDays,
  formatQty,
  stockState,
} from "@/lib/inventory";
import { colors } from "@/theme/tokens";
import type { StockMovement } from "@/types";

const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;
const monoBold = { ...mono, fontWeight: 700 } as const;

export function StockItemDetailView({ stockItemId }: { stockItemId: number }) {
  const { farmId, hasFarm, hasInventory } = useInventoryGating();
  const skip = !hasFarm || !hasInventory;
  const [tab, setTab] = useState(0);
  const [moveOpen, setMoveOpen] = useState(false);

  const { data: item, isLoading } = useGetStockItemQuery(
    { farmId: farmId as number, id: stockItemId },
    { skip },
  );
  const { data: movements = [] } = useGetMovementsByItemQuery(
    { farmId: farmId as number, stockItemId },
    { skip },
  );

  const consumption30d = useMemo(() => consumptionInLastDays(movements, 30), [movements]);

  const tabMovements = useMemo(() => {
    if (tab === 1) return movements.filter((m) => m.purchaseOrderId != null);
    if (tab === 2) return movements.filter((m) => m.productionUnitId != null);
    return movements;
  }, [movements, tab]);

  if (isLoading) return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 3 }} />;
  if (!item) return <Alert severity="error">Article introuvable.</Alert>;

  const meta = STOCK_STATE_META[stockState(item)];
  const value =
    item.typicalUnitPriceXof != null ? item.currentQuantity * item.typicalUnitPriceXof : null;

  return (
    <Box sx={{ pb: { xs: 9, sm: 0 } }}>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link href="/stocks" style={{ color: colors.neutral[500], textDecoration: "none" }}>
          Stocks
        </Link>
        <Typography color="text.primary">{item.articleKey}</Typography>
      </Breadcrumbs>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 3 }}
      >
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {item.articleKey}
          </Typography>
          <Chip label={ARTICLE_SOURCE_LABELS[item.articleSource]} size="small" />
          <Chip label={meta.label} size="small" sx={{ bgcolor: meta.bg, color: meta.fg, fontWeight: 600 }} />
        </Stack>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<Plus size={18} />}
          onClick={() => setMoveOpen(true)}
          sx={{ display: { xs: "none", sm: "inline-flex" } }}
        >
          Mouvement de stock
        </Button>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gap: { xs: 2, md: 3 },
          gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
          mb: 3,
        }}
      >
        <Kpi label="Stock actuel" value={formatQty(item.currentQuantity, item.unit)} />
        <Kpi label="Valeur du stock" value={value != null ? formatCurrency(value) : "—"} />
        <Kpi
          label="Seuil d'alerte"
          value={item.alertThreshold != null ? formatQty(item.alertThreshold, item.unit) : "—"}
        />
        <Kpi label="Conso. 30 jours" value={formatQty(consumption30d, item.unit)} />
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Évolution du stock
          </Typography>
          <StockHistoryChart movements={movements} />
        </CardContent>
      </Card>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Mouvements" />
        <Tab label="Achats" />
        <Tab label="Consommation par lot" />
      </Tabs>

      <TableContainer sx={{ border: `1px solid ${colors.neutral[200]}`, borderRadius: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Motif</TableCell>
              <TableCell align="right">Quantité</TableCell>
              <TableCell align="right">Solde</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tabMovements.map((m) => (
              <MovementRow key={m.id} m={m} unit={item.unit} />
            ))}
            {tabMovements.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ color: colors.neutral[500], py: 4 }}>
                  Aucun mouvement.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {farmId && (
        <StockMovementDialog
          open={moveOpen}
          onClose={() => setMoveOpen(false)}
          farmId={farmId}
          preselectStockItemId={item.id}
        />
      )}
    </Box>
  );
}

function MovementRow({ m, unit }: { m: StockMovement; unit: string | null }) {
  const positive = m.movementType === "IN";
  return (
    <TableRow hover>
      <TableCell>{formatDate(m.movementDate)}</TableCell>
      <TableCell>{MOVEMENT_TYPE_LABELS[m.movementType]}</TableCell>
      <TableCell>{MOVEMENT_REASON_LABELS[m.reason]}</TableCell>
      <TableCell
        align="right"
        sx={{ ...mono, color: positive ? colors.success.dark : colors.error.dark }}
      >
        {positive ? "+" : "−"}
        {formatNumber(m.quantity)} {unit ?? ""}
      </TableCell>
      <TableCell align="right" sx={mono}>
        {formatNumber(m.quantityAfter)} {unit ?? ""}
      </TableCell>
    </TableRow>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        <Typography variant="h6" sx={{ ...monoBold, mt: 0.5 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}
