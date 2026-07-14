"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Fab,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  BookOpen,
  ClipboardList,
  Lock,
  Plus,
  Search,
  Truck,
  Wheat,
} from "lucide-react";
import {
  useGetInventoryAlertsQuery,
  useGetStockItemsQuery,
  useGetStockValuationQuery,
} from "@/store/api/inventoryStockApi";
import { useInventoryGating } from "@/hooks/useInventoryGating";
import { InventoryAlertsKpis } from "@/components/inventory/InventoryAlertsKpis";
import { StockItemsTable } from "@/components/inventory/StockItemsTable";
import { StockMovementDialog } from "@/components/inventory/StockMovementDialog";
import { colors } from "@/theme/tokens";

const QUICK_ACTIONS = [
  { label: "Bibliothèque", desc: "Catalogue des articles", href: "/stocks/articles", icon: BookOpen },
  { label: "Fournisseurs", desc: "Gérer les contacts", href: "/stocks/fournisseurs", icon: Truck },
  { label: "Bons d'achat", desc: "Suivi des commandes", href: "/stocks/achats", icon: ClipboardList },
  { label: "Formules", desc: "Rations d'aliment", href: "/stocks/formules", icon: Wheat },
];

export default function StocksOverviewPage() {
  const { farmId, hasFarm, isLoading: gatingLoading, hasInventory } = useInventoryGating();
  const [search, setSearch] = useState("");
  const [moveOpen, setMoveOpen] = useState(false);

  const skip = !hasFarm || !hasInventory;
  const { data: items, isLoading } = useGetStockItemsQuery(
    { farmId: farmId as number },
    { skip },
  );
  const { data: valuation } = useGetStockValuationQuery({ farmId: farmId as number }, { skip });
  const { data: alerts } = useGetInventoryAlertsQuery({ farmId: farmId as number }, { skip });

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    return q ? items.filter((i) => i.articleKey.toLowerCase().includes(q)) : items;
  }, [items, search]);

  if (!gatingLoading && hasFarm && !hasInventory) {
    return <InventoryLocked farmId={farmId} />;
  }

  return (
    <Box sx={{ pb: { xs: 9, sm: 0 } }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 3 }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Stocks &amp; approvisionnement
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Suivez vos aliments, médicaments et consommables en temps réel.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<Plus size={18} />}
          onClick={() => setMoveOpen(true)}
          disabled={!hasFarm}
          sx={{ display: { xs: "none", sm: "inline-flex" } }}
        >
          Nouveau mouvement
        </Button>
      </Stack>

      <InventoryAlertsKpis
        totalArticles={items?.length ?? 0}
        lowStockCount={alerts?.lowStockItems.length ?? 0}
        totalValueXof={valuation?.totalValueXof ?? 0}
        pendingOrdersCount={alerts?.pendingPurchaseOrders.length ?? 0}
      />

      <TextField
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher un article…"
        fullWidth
        sx={{ mb: 3 }}
        slotProps={{
          input: {
            startAdornment: (
              <Box sx={{ display: "flex", color: "text.secondary", mr: 1 }}>
                <Search size={18} />
              </Box>
            ),
          },
        }}
      />

      {isLoading && (
        <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 3, mb: 4 }} />
      )}

      {!isLoading && filtered.length === 0 && (
        <Box
          sx={{
            textAlign: "center",
            py: 6,
            border: (t) => `1px dashed ${t.palette.divider}`,
            borderRadius: 3,
            mb: 4,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Aucun article en stock
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Le stock se crée à la réception d&apos;un bon d&apos;achat ou via un mouvement.
          </Typography>
        </Box>
      )}

      {!isLoading && filtered.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <StockItemsTable items={filtered} />
        </Box>
      )}

      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        Actions rapides
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: { xs: 2, md: 3 },
          gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
        }}
      >
        {QUICK_ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Card key={a.href}>
              <CardActionArea component={Link} href={a.href} sx={{ height: "100%" }}>
                <CardContent>
                  <Box sx={{ color: colors.primary[600], mb: 1 }}>
                    <Icon size={22} />
                  </Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {a.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {a.desc}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>

      <Fab
        color="secondary"
        aria-label="Nouveau mouvement"
        onClick={() => setMoveOpen(true)}
        disabled={!hasFarm}
        sx={{ position: "fixed", bottom: 24, right: 24, display: { xs: "flex", sm: "none" } }}
      >
        <Plus size={24} />
      </Fab>

      {farmId && (
        <StockMovementDialog open={moveOpen} onClose={() => setMoveOpen(false)} farmId={farmId} />
      )}
    </Box>
  );
}

function InventoryLocked({ farmId }: { farmId?: number }) {
  return (
    <Box
      sx={{
        textAlign: "center",
        py: 10,
        border: (t) => `1px dashed ${t.palette.divider}`,
        borderRadius: 3,
      }}
    >
      <Box sx={{ color: colors.neutral[400], mb: 1 }}>
        <Lock size={32} />
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        Module Inventaire non activé
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Activez le module pour gérer vos stocks, fournisseurs et achats.
      </Typography>
      {farmId && (
        <Button
          component={Link}
          href={`/fermes/${farmId}`}
          variant="contained"
          color="primary"
        >
          Voir l&apos;abonnement
        </Button>
      )}
    </Box>
  );
}
