"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Box,
  Button,
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
import { Plus } from "lucide-react";
import { useGetAdminPartnersQuery } from "@/store/api/adminApi";
import { CreatePartnerDialog } from "@/components/admin/CreatePartnerDialog";
import { colors } from "@/theme/tokens";

const TYPE_LABEL: Record<string, string> = {
  FEED_SUPPLIER: "Provendier",
  VET: "Vétérinaire",
};

/** Partner directory, and the only place a partner organisation can be brought into existence. */
export function PartnerTable() {
  const { data: partners = [], isLoading } = useGetAdminPartnersQuery();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <Card>
      <CardContent>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            mb: 2,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Partenaires {partners.length > 0 && `(${partners.length})`}
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<Plus size={16} />}
            onClick={() => setCreateOpen(true)}
          >
            Nouveau partenaire
          </Button>
        </Box>

        <CreatePartnerDialog open={createOpen} onClose={() => setCreateOpen(false)} />

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
