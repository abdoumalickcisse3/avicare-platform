"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
} from "@mui/material";
import { AlertTriangle } from "lucide-react";
import { useGetFarmClosuresQuery } from "@/store/api/closureListApi";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { colors } from "@/theme/tokens";
import type { ClosureSummary } from "@/types";

type SortKey =
  | "endDate"
  | "durationDays"
  | "mortalityPercent"
  | "feedConversionRatio"
  | "costPerKgXof"
  | "marginXof";

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "endDate", label: "Clôturé le", numeric: false },
  { key: "durationDays", label: "Durée", numeric: true },
  { key: "mortalityPercent", label: "Mortalité", numeric: true },
  { key: "feedConversionRatio", label: "IC", numeric: true },
  { key: "costPerKgXof", label: "Coût / kg", numeric: true },
  { key: "marginXof", label: "Marge", numeric: true },
];

/** Nulls always sink to the bottom: an unknown is not a good score, and not a bad one either. */
function compare(a: ClosureSummary, b: ClosureSummary, key: SortKey, asc: boolean): number {
  const va = a[key];
  const vb = b[key];
  if (va === null || va === undefined) return 1;
  if (vb === null || vb === undefined) return -1;
  const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
  return asc ? cmp : -cmp;
}

/**
 * The farm's closed cycles, side by side.
 *
 * No medal, no overall score: ranking would mean inventing thresholds, and a threshold that
 * contradicts what a farmer knows of his own trade discredits every other figure on the screen.
 * The reader sorts on the column he cares about and draws his own conclusion.
 */
export function ClosedBatchesTable({ farmId }: { farmId: number }) {
  const { data, isLoading, error } = useGetFarmClosuresQuery({ farmId });
  const [sortKey, setSortKey] = useState<SortKey>("endDate");
  const [asc, setAsc] = useState(false);

  const rows = useMemo(
    () => [...(data ?? [])].sort((a, b) => compare(a, b, sortKey, asc)),
    [data, sortKey, asc],
  );

  if (isLoading) {
    return <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 2 }} />;
  }
  if (error) {
    return <Alert severity="error">{apiErrorMessage(error)}</Alert>;
  }
  if (!rows.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
        Aucune bande clôturée pour le moment. Le bilan d&apos;une bande apparaît ici dès que vous
        la clôturez.
      </Typography>
    );
  }

  const anyIncomplete = rows.some((r) => r.valuationIncomplete);

  function toggle(key: SortKey) {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(key === "endDate" ? false : true);
    }
  }

  return (
    <Box>
      {anyIncomplete && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Certaines bandes n&apos;ont pas pu être entièrement valorisées : leur coût est
          sous-estimé, et les comparer aux autres les avantage. Elles portent le signe{" "}
          <Box component="span" sx={{ verticalAlign: "middle", display: "inline-flex" }}>
            <AlertTriangle size={14} />
          </Box>
          .
        </Alert>
      )}

      <TableContainer sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Bande</TableCell>
              {COLUMNS.map((c) => (
                <TableCell key={c.key} align={c.numeric ? "right" : "left"}>
                  <TableSortLabel
                    active={sortKey === c.key}
                    direction={sortKey === c.key && asc ? "asc" : "desc"}
                    onClick={() => toggle(c.key)}
                  >
                    {c.label}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.productionUnitId} hover>
                <TableCell>
                  <Link
                    href={`/elevage/lots/${r.productionUnitId}`}
                    style={{ color: colors.primary[700], textDecoration: "none", fontWeight: 600 }}
                  >
                    {r.unitName}
                  </Link>
                  {r.valuationIncomplete && (
                    <Tooltip title="Coût sous-estimé : un article consommé n'a pas de prix">
                      <Box
                        component="span"
                        sx={{ ml: 0.75, color: colors.warning.main, verticalAlign: "middle" }}
                      >
                        <AlertTriangle size={14} />
                      </Box>
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell>{formatDate(r.endDate)}</TableCell>
                <TableCell align="right">{r.durationDays} j</TableCell>
                <TableCell align="right">
                  {r.mortalityPercent === null ? "—" : `${r.mortalityPercent} %`}
                </TableCell>
                <TableCell align="right">
                  {r.feedConversionRatio === null ? "—" : r.feedConversionRatio}
                </TableCell>
                <TableCell align="right">
                  {r.costPerKgXof === null ? "—" : formatCurrency(r.costPerKgXof)}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 700,
                    color: r.marginXof >= 0 ? colors.success.main : colors.error.main,
                  }}
                >
                  {formatCurrency(r.marginXof)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: "block" }}>
        {formatNumber(rows.length)} bande{rows.length > 1 ? "s" : ""} clôturée
        {rows.length > 1 ? "s" : ""}.
      </Typography>
    </Box>
  );
}
