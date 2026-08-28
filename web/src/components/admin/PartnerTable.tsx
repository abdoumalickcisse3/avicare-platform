"use client";

import Link from "next/link";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useGetAdminPartnersQuery } from "@/store/api/adminApi";
import { colors } from "@/theme/tokens";

const TYPE_LABEL: Record<string, string> = {
  FEED_SUPPLIER: "Provendier",
  VET: "Vétérinaire",
};

/** Partner directory. Until this screen existed, creating a partner meant calling the API by hand. */
export function PartnerTable() {
  const { data: partners = [], isLoading } = useGetAdminPartnersQuery();

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          Partenaires {partners.length > 0 && `(${partners.length})`}
        </Typography>

        {!isLoading && partners.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            Aucun partenaire enregistré.
          </Typography>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 620 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Partenaire</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell>Statut</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {partners.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>
                      <Typography
                        component={Link}
                        href={`/console/partenaires/${p.id}`}
                        variant="body2"
                        sx={{ fontWeight: 600, color: colors.primary[600] }}
                      >
                        {p.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" label={TYPE_LABEL[p.type] ?? p.type} />
                    </TableCell>
                    <TableCell>{p.contactPhone ?? p.contactEmail ?? "—"}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={p.status === "ACTIVE" ? "success" : "default"}
                        label={p.status}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
