"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  FormControlLabel,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { RefreshCw } from "lucide-react";
import {
  useGetBenchmarkCohortQuery,
  useSetBenchmarkSettingsMutation,
  useGetPlatformOverviewQuery,
  useGetPlatformBackupsQuery,
  useGetPlatformRuntimeQuery,
  useGetWhatsAppFailuresQuery,
  useGetWhatsAppUsageQuery,
  useRetryWhatsAppMutation,
} from "@/store/api/adminApi";
import { colors } from "@/theme/tokens";

/** FR names for the counters contexts contribute; an unknown key falls back to itself. */
const VOLUME_LABELS: Record<string, string> = {
  productionUnits: "Lots et bâtiments",
  salesLast30d: "Ventes (30 j)",
  expenses: "Dépenses",
};

const SOURCE_LABELS: Record<string, string> = {
  ALERT: "Alertes",
  INTERACTIVE: "Envois immédiats",
  BROADCAST: "Campagnes",
};

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card variant="outlined" sx={{ flex: "1 1 160px", minWidth: 160 }}>
      <CardContent>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {value}
        </Typography>
        {hint && (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Platform cockpit.
 *
 * The WhatsApp block is the point of this screen: every send costs a credit, the client never
 * throws, and a failed send is recorded rather than raised — so without somewhere to look, the day
 * the credits run out is the day reset codes and partner alerts stop, silently.
 */
export function PlatformCockpit() {
  const [days, setDays] = useState(30);
  const { data: overview, isLoading } = useGetPlatformOverviewQuery();
  const { data: runtime } = useGetPlatformRuntimeQuery();
  const { data: cohort } = useGetBenchmarkCohortQuery();
  const { data: backups } = useGetPlatformBackupsQuery();
  const [setBenchmarks, { isLoading: savingBenchmarks }] = useSetBenchmarkSettingsMutation();
  const { data: usage } = useGetWhatsAppUsageQuery({ days });
  const { data: failures = [] } = useGetWhatsAppFailuresQuery();
  const [retry, { isLoading: retrying }] = useRetryWhatsAppMutation();

  if (isLoading) return <CircularProgress size={24} />;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          Pilotage
        </Typography>
        <Typography variant="body2" color="text.secondary">
          L&apos;état de la plateforme et ce qu&apos;elle dépense.
        </Typography>
      </Box>

      <Stack direction="row" sx={{ gap: 2, flexWrap: "wrap" }}>
        <Metric
          label="Fermes actives"
          value={String(overview?.activeFarms ?? 0)}
          hint={overview?.deletedFarms ? `${overview.deletedFarms} supprimée(s)` : undefined}
        />
        <Metric label="Comptes actifs" value={String(overview?.activeUsers ?? 0)} />
        <Metric
          label="Actifs sur 30 j"
          value={String(overview?.monthlyActiveUsers ?? 0)}
          hint="dernière connexion"
        />
        <Metric label="Personnel" value={String(overview?.staffAccounts ?? 0)} />
      </Stack>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Volumes
          </Typography>
          {Object.keys(overview?.volumes ?? {}).length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Aucun contexte ne remonte de compteur.
            </Typography>
          ) : (
            <Stack direction="row" sx={{ gap: 3, flexWrap: "wrap" }}>
              {Object.entries(overview?.volumes ?? {}).map(([key, value]) => (
                <Box key={key}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {VOLUME_LABELS[key] ?? key}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between", mb: 1.5, gap: 2 }}
          >
            <Typography variant="subtitle2">WhatsApp — crédits consommés</Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={days}
              onChange={(_, v) => v && setDays(v)}
            >
              <ToggleButton value={7}>7 j</ToggleButton>
              <ToggleButton value={30}>30 j</ToggleButton>
              <ToggleButton value={90}>90 j</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          {runtime && !runtime.whatsappEnabled && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              L&apos;envoi WhatsApp est désactivé : aucun message ne part, y compris les codes de
              réinitialisation.
            </Alert>
          )}

          {runtime && !runtime.onCallConfigured && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Aucun numéro d&apos;astreinte configuré : les coupures d&apos;urgence et les
              incohérences critiques sont journalisées, mais personne n&apos;est prévenu. Renseigner
              <code> ADMIN_ONCALL_PHONE</code>.
            </Alert>
          )}

          <Stack direction="row" sx={{ gap: 3, flexWrap: "wrap", mb: 2 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {usage?.sent ?? 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                envoyés
              </Typography>
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: colors.neutral[500] }}>
                {usage?.pending ?? 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                en attente
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="h5"
                sx={{ fontWeight: 700, color: (usage?.failed ?? 0) > 0 ? "error.main" : undefined }}
              >
                {usage?.failed ?? 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                échoués
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
            {Object.entries(usage?.bySource ?? {}).map(([source, n]) => (
              <Chip
                key={source}
                size="small"
                variant="outlined"
                label={`${SOURCE_LABELS[source] ?? source} : ${n}`}
              />
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent sx={{ overflowX: "auto" }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Envois échoués
          </Typography>
          {failures.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Aucun échec récent.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Numéro</TableCell>
                  <TableCell>Origine</TableCell>
                  <TableCell>Tentatives</TableCell>
                  <TableCell>Erreur</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {failures.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell sx={{ fontFamily: "monospace" }}>{f.maskedPhone}</TableCell>
                    <TableCell>{SOURCE_LABELS[f.source ?? ""] ?? f.source ?? "—"}</TableCell>
                    <TableCell>{f.attempts}</TableCell>
                    <TableCell sx={{ maxWidth: 280 }}>
                      <Typography variant="caption" color="text.secondary">
                        {f.lastError ?? "—"}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        startIcon={<RefreshCw size={14} />}
                        disabled={retrying}
                        onClick={() => retry({ outboxId: f.id })}
                      >
                        Réessayer
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Comparaison entre fermes
          </Typography>
          <Stack direction="row" sx={{ gap: 3, flexWrap: "wrap" }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {cohort?.enabled ? "activée" : "désactivée"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                état
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {cohort?.cohortSize ?? 0} / {cohort?.minCohort ?? 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                fermes comparables / seuil
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {cohort?.platformMortalityRate ?? "—"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                mortalité moyenne (%)
              </Typography>
            </Box>
          </Stack>
          {cohort && cohort.enabled && !cohort.available && (
            <Alert severity="info" sx={{ mt: 1.5 }}>
              Activée, mais rien n&apos;est publié : la cohorte est sous le seuil. C&apos;est le
              garde-fou qui empêche de déduire les chiffres d&apos;une ferme voisine.
            </Alert>
          )}
          {cohort && (
            <>
              <FormControlLabel
                sx={{ mt: 1.5 }}
                control={
                  <Switch
                    checked={cohort.enabled}
                    disabled={savingBenchmarks}
                    onChange={(e) =>
                      setBenchmarks({ enabled: e.target.checked, minCohort: cohort.minCohort })
                    }
                  />
                }
                label="Publier la comparaison aux éleveurs"
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                Chaque ferme verra sa mortalité à côté de la moyenne des autres. Aucune ferme
                n&apos;est nommée, et rien n&apos;est publié tant que la cohorte est sous le seuil.
              </Typography>
            </>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Sauvegardes
          </Typography>
          {!backups ? null : !backups.mounted ? (
            <Alert severity="info">
              Le répertoire des sauvegardes n&apos;est pas visible depuis l&apos;application. Les
              dumps tournent peut-être très bien — la console ne peut simplement pas le vérifier.
            </Alert>
          ) : (
            <>
              {backups.stale && (
                <Alert severity="error" sx={{ mb: 1.5 }}>
                  {backups.dumpCount === 0
                    ? "Aucune sauvegarde dans le répertoire."
                    : `Dernière sauvegarde il y a ${backups.ageHours} h. Les dumps sont censés être quotidiens.`}
                </Alert>
              )}
              <Stack direction="row" sx={{ gap: 3, flexWrap: "wrap" }}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {backups.ageHours === null ? "—" : `il y a ${backups.ageHours} h`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    dernière sauvegarde
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {backups.dumpCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    dumps conservés
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {(backups.totalBytes / 1024 / 1024).toFixed(1)} Mo
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    volume total
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {backups.offsiteConfigured ? "configurée" : "aucune"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    copie hors site
                  </Typography>
                </Box>
              </Stack>
              {backups.offsiteConfigured && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                  « Configurée » dit qu&apos;un dépôt distant est renseigné, pas que le dernier
                  envoi a réussi : la console ne voit pas le dépôt.
                </Typography>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Ce qui tourne
          </Typography>
          <Stack direction="row" sx={{ gap: 3, flexWrap: "wrap" }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {runtime?.schemaVersion ?? "inconnu"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                version du schéma
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {runtime?.appliedMigrations ?? 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                migrations appliquées
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {runtime?.whatsappEnabled ? "actif" : "désactivé"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                envoi WhatsApp
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {runtime?.onCallConfigured ? "configurée" : "absente"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                astreinte
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
