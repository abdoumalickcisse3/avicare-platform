import Link from "next/link";
import { Box, Breadcrumbs, Button, Card, CardContent, Typography } from "@mui/material";

const CATEGORY_NAMES: Record<string, string> = {
  stock: "Stock",
  lots: "Lots",
  sanitaire: "Sanitaire",
  ventes: "Ventes",
  comptabilite: "Comptabilité",
};

/**
 * Placeholder for a settings category management page (A6-3 step 4.5). The
 * per-category catalog UI lands in V2; for now this confirms the route and
 * links back to the hub. `params` is a Promise in Next 16.
 */
export default async function SettingsCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const name = CATEGORY_NAMES[category] ?? category;

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link href="/reglages" style={{ color: "inherit" }}>
          Réglages
        </Link>
        <Typography color="text.primary">{name}</Typography>
      </Breadcrumbs>

      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        {name}
      </Typography>

      <Card>
        <CardContent>
          <Box sx={{ py: 6, textAlign: "center" }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
              Bientôt disponible
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              La gestion des paramètres « {name} » arrivera dans une prochaine
              version.
            </Typography>
            <Button component={Link} href="/reglages" variant="outlined">
              Retour aux réglages
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
