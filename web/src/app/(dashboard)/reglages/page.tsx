"use client";

import Link from "next/link";
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import {
  ArrowRight,
  Bell,
  Bird,
  Package,
  Receipt,
  ShoppingCart,
  Syringe,
} from "lucide-react";
import { colors } from "@/theme/tokens";

interface SettingCategory {
  slug: string;
  name: string;
  description: string;
  icon: typeof Package;
}

/** 5 settings categories (legacy ARCHITECTURE §7.13). */
const CATEGORIES: SettingCategory[] = [
  {
    slug: "stock",
    name: "Stock",
    description: "Types de produits : aliments, équipements, consommables.",
    icon: Package,
  },
  {
    slug: "lots",
    name: "Lots",
    description: "Souches et races de volaille (chair, ponte).",
    icon: Bird,
  },
  {
    slug: "sanitaire",
    name: "Sanitaire",
    description: "Catalogue des vaccins et protocoles de prophylaxie.",
    icon: Syringe,
  },
  {
    slug: "ventes",
    name: "Ventes",
    description: "Produits vendables et circuits de distribution.",
    icon: ShoppingCart,
  },
  {
    slug: "comptabilite",
    name: "Comptabilité",
    description: "Catégories de dépenses et de revenus.",
    icon: Receipt,
  },
  {
    slug: "notifications",
    name: "Notifications",
    description: "Alertes par catégorie : cloche in-app et WhatsApp.",
    icon: Bell,
  },
];

export default function SettingsHubPage() {
  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Réglages
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Personnalisez votre exploitation.
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: { xs: 2, md: 3 },
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
        }}
      >
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <Card key={cat.slug} sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <CardContent sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: colors.primary[50],
                    color: colors.primary[600],
                    mb: 1.5,
                  }}
                >
                  <Icon size={22} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {cat.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1, mb: 2 }}>
                  {cat.description}
                </Typography>
                <Button
                  component={Link}
                  href={`/reglages/${cat.slug}`}
                  variant="outlined"
                  endIcon={<ArrowRight size={16} />}
                  sx={{ alignSelf: "flex-start" }}
                >
                  Gérer
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      <Stack sx={{ mt: 4 }}>
        <Typography variant="body2" color="text.secondary">
          Plus de paramètres seront disponibles à l&apos;usage.
        </Typography>
      </Stack>
    </Box>
  );
}
