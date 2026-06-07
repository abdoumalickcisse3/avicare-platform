"use client";

import Link from "next/link";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { formatDate, formatNumber } from "@/lib/format";
import { ageInDays } from "@/lib/poultry";
import { BatchStatusChip } from "./BatchStatusChip";
import type { PoultryBatch } from "@/types";

interface Props {
  batches: PoultryBatch[];
  breedNames: Record<number, string>;
}

const mono = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
} as const;

export function PoultryBatchesTable({ batches, breedNames }: Props) {
  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Nom</TableCell>
            <TableCell>Souche</TableCell>
            <TableCell>Statut</TableCell>
            <TableCell>Démarrage</TableCell>
            <TableCell align="right">Jour</TableCell>
            <TableCell align="right">Effectif</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {batches.map((b) => (
            <TableRow key={b.id} hover>
              <TableCell sx={{ fontWeight: 600 }}>
                {b.name ?? `Lot #${b.id}`}
              </TableCell>
              <TableCell>{breedNames[b.breedId] ?? "—"}</TableCell>
              <TableCell>
                <BatchStatusChip status={b.status} />
              </TableCell>
              <TableCell sx={mono}>{formatDate(b.startDate)}</TableCell>
              <TableCell align="right" sx={mono}>
                {ageInDays(b.startDate)}/{b.targetAgeDays ?? "?"}
              </TableCell>
              <TableCell align="right" sx={mono}>
                {formatNumber(b.currentCount)}
              </TableCell>
              <TableCell align="right">
                <Button
                  component={Link}
                  href={`/elevage/lots/${b.id}`}
                  size="small"
                  variant="text"
                >
                  Détails
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
