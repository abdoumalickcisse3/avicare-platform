"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { ClipboardList, Download, PhoneCall, X } from "lucide-react";
import { useGetSurveyIntakeQuery, useSearchSurveyAnswersQuery } from "@/store/api/adminApi";
import { apiErrorMessage } from "@/lib/apiError";
import { downloadCsv, toCsv } from "@/lib/csv";
import {
  COUNTRY_LABELS,
  FIRST_CALL_LABELS,
  FLOCK_TYPE_LABELS,
  MAIN_BUYER_LABELS,
  PAYMENT_DELAY_LABELS,
  PAYMENT_TERMS_LABELS,
  RECORD_KEEPING_LABELS,
  SALE_UNIT_LABELS,
  WILLINGNESS_LABELS,
  frenchBoolean,
  surveyLabel,
} from "@/lib/surveyLabels";
import type { SurveyAnswerRow } from "@/types";

/**
 * One page holds the whole questionnaire: the survey targets a couple of hundred answers, and the
 * CSV is built from what is on screen, so a page that held less would export less.
 */
const PAGE_SIZE = 200;

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

/** A labelled value that disappears when the respondent skipped the question. */
function Field({ label, value }: { label: string; value: string | number | null }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <Stack direction="row" sx={{ gap: 1, alignItems: "baseline" }}>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 190 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
        {value}
      </Typography>
    </Stack>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        {title}
      </Typography>
      <Stack sx={{ gap: 0.5 }}>{children}</Stack>
    </Box>
  );
}

function fcfa(amount: number | null): string | null {
  return amount === null ? null : `${amount.toLocaleString("fr-FR")} F`;
}

function day(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("fr-FR") : "—";
}

/** Only the month was asked for, so only the month is shown. */
function month(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function place(row: SurveyAnswerRow): string {
  const country = surveyLabel(COUNTRY_LABELS, row.country) ?? row.country;
  return row.commune ? `${row.region} (${row.commune}) · ${country}` : `${row.region} · ${country}`;
}

/** The questionnaire read back whole, in the order it was asked. */
function AnswerDetail({ row, onClose }: { row: SurveyAnswerRow; onClose: () => void }) {
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>Réponse n° {row.id}</span>
        <Button size="small" onClick={onClose} startIcon={<X size={16} />}>
          Fermer
        </Button>
      </DialogTitle>
      <DialogContent dividers>
        <Section title="Où">
          <Field label="Pays" value={surveyLabel(COUNTRY_LABELS, row.country)} />
          <Field label="Région" value={row.region} />
          <Field label="Commune" value={row.commune} />
          <Field label="Envoyé par" value={row.referrer} />
          <Field label="Reçue le" value={day(row.receivedAt)} />
        </Section>

        <Section title="L'élevage">
          <Field label="Type" value={surveyLabel(FLOCK_TYPE_LABELS, row.flockType)} />
          <Field label="Sujets aujourd'hui" value={row.currentBirds} />
          <Field label="Bandes sur 12 mois" value={row.batchesLast12Months} />
          <Field label="A commencé en" value={row.startedYear} />
          <Field label="Personnes qui travaillent" value={row.workers} />
        </Section>

        <Section title="La dernière bande">
          <Field label="Mise en place" value={month(row.lastBatchMonth)} />
          <Field label="Sujets mis en place" value={row.birdsPlaced} />
          <Field label="Prix du poussin" value={fcfa(row.chickPrice)} />
          <Field label="Sujets morts" value={row.birdsDied} />
          <Field label="Sacs d'aliment" value={row.feedBags} />
          <Field label="Prix du dernier sac" value={fcfa(row.lastBagPrice)} />
          <Field label="Marque du sac" value={row.lastBagBrand} />
          <Field label="Mois de ce sac" value={month(row.lastBagMonth)} />
        </Section>

        <Section title="Chez qui il achète">
          <Field label="Provendier" value={row.feedSupplier} />
          <Field label="Paiement" value={surveyLabel(PAYMENT_TERMS_LABELS, row.paymentTerms)} />
          <Field label="Jours de crédit" value={row.creditDays} />
          <Field label="Le crédit coûte plus cher" value={frenchBoolean(row.creditCostsMore)} />
          <Field label="Prix des matières premières" value={row.rawMaterialPrices} />
        </Section>

        <Section title="À qui il vend">
          <Field label="Acheteur principal" value={surveyLabel(MAIN_BUYER_LABELS, row.mainBuyer)} />
          <Field label="Dernier prix de vente" value={fcfa(row.lastSalePrice)} />
          <Field label="Pour" value={surveyLabel(SALE_UNIT_LABELS, row.lastSaleUnit)} />
          <Field label="Mois de la vente" value={month(row.lastSaleMonth)} />
          <Field label="Délai de paiement" value={surveyLabel(PAYMENT_DELAY_LABELS, row.paymentDelay)} />
        </Section>

        <Section title="Quand ça va mal">
          <Field label="Appelle d'abord" value={surveyLabel(FIRST_CALL_LABELS, row.firstCall)} />
          <Field label="Coût du dernier incident" value={fcfa(row.lastIncidentCost)} />
        </Section>

        <Section title="L'outil">
          <Field label="Tient ses comptes" value={surveyLabel(RECORD_KEEPING_LABELS, row.recordKeeping)} />
          <Field label="Prêt à payer" value={surveyLabel(WILLINGNESS_LABELS, row.willingnessToPay)} />
          <Field label="A déjà abandonné un outil" value={frenchBoolean(row.hasQuit)} />
          <Field label="Pourquoi" value={row.quitReason} />
        </Section>

        <Divider sx={{ mt: 2 }} />
        <Section title="Pour le rappeler">
          <Field label="Téléphone" value={row.phone} />
          <Field label="Accepte un entretien" value={frenchBoolean(row.acceptsInterview)} />
        </Section>
      </DialogContent>
    </Dialog>
  );
}

const CSV_HEADERS = [
  "id",
  "Reçue le",
  "Pays",
  "Région",
  "Commune",
  "Envoyé par",
  "Type d'élevage",
  "Sujets aujourd'hui",
  "Bandes sur 12 mois",
  "A commencé en",
  "Travailleurs",
  "Dernière bande (mois)",
  "Sujets mis en place",
  "Prix du poussin",
  "Sujets morts",
  "Sacs d'aliment",
  "Prix du dernier sac",
  "Marque du sac",
  "Mois du sac",
  "Provendier",
  "Paiement",
  "Jours de crédit",
  "Le crédit coûte plus cher",
  "Prix des matières premières",
  "Acheteur principal",
  "Dernier prix de vente",
  "Unité de vente",
  "Mois de la vente",
  "Délai de paiement",
  "Appelle d'abord",
  "Coût du dernier incident",
  "Tient ses comptes",
  "Prêt à payer",
  "A abandonné un outil",
  "Pourquoi",
  "Téléphone",
  "Accepte un entretien",
];

function csvRow(row: SurveyAnswerRow): (string | number | null)[] {
  return [
    row.id,
    row.receivedAt ? day(row.receivedAt) : null,
    surveyLabel(COUNTRY_LABELS, row.country),
    row.region,
    row.commune,
    row.referrer,
    surveyLabel(FLOCK_TYPE_LABELS, row.flockType),
    row.currentBirds,
    row.batchesLast12Months,
    row.startedYear,
    row.workers,
    month(row.lastBatchMonth),
    row.birdsPlaced,
    row.chickPrice,
    row.birdsDied,
    row.feedBags,
    row.lastBagPrice,
    row.lastBagBrand,
    month(row.lastBagMonth),
    row.feedSupplier,
    surveyLabel(PAYMENT_TERMS_LABELS, row.paymentTerms),
    row.creditDays,
    frenchBoolean(row.creditCostsMore),
    row.rawMaterialPrices,
    surveyLabel(MAIN_BUYER_LABELS, row.mainBuyer),
    row.lastSalePrice,
    surveyLabel(SALE_UNIT_LABELS, row.lastSaleUnit),
    month(row.lastSaleMonth),
    surveyLabel(PAYMENT_DELAY_LABELS, row.paymentDelay),
    surveyLabel(FIRST_CALL_LABELS, row.firstCall),
    row.lastIncidentCost,
    surveyLabel(RECORD_KEEPING_LABELS, row.recordKeeping),
    surveyLabel(WILLINGNESS_LABELS, row.willingnessToPay),
    frenchBoolean(row.hasQuit),
    row.quitReason,
    row.phone,
    frenchBoolean(row.acceptsInterview),
  ];
}

/**
 * The field survey, read from the console.
 *
 * <p>It exists because the answers had no reader. The public results page shows a region's average
 * only once the publication floor is met for each figure, so early respondents were invisible to
 * everyone — and the only way in was a psql session on the production box.
 *
 * <p>The screen opens on the one number that drives a decision: how many answers each area still
 * needs. That is what says where to push the link next.
 */
export function SurveyAnswers() {
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [flockType, setFlockType] = useState("");
  const [interviewOnly, setInterviewOnly] = useState(false);
  const [openRow, setOpenRow] = useState<SurveyAnswerRow | null>(null);

  const intake = useGetSurveyIntakeQuery();
  const answers = useSearchSurveyAnswersQuery({
    country: country || undefined,
    region: region.trim() || undefined,
    flockType: flockType || undefined,
    interviewOnly,
    size: PAGE_SIZE,
  });

  // Memoised, not derived inline: a fresh [] on every render would rebuild the CSV every render.
  const rows: SurveyAnswerRow[] = useMemo(() => answers.data?.items ?? [], [answers.data]);
  const total = answers.data?.totalElements ?? 0;
  const summary = intake.data;

  const csv = useMemo(() => toCsv(CSV_HEADERS, rows.map(csvRow)), [rows]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Enquête terrain
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Les réponses au questionnaire de jawdi.app/enquete, telles que les éleveurs les ont
        saisies. La page publique des résultats ne montre la moyenne d&apos;une région
        qu&apos;au-delà du plancher&nbsp;; ici, chaque réponse est lisible dès la première.
      </Typography>

      {(intake.error || answers.error) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiErrorMessage(intake.error ?? answers.error)}
        </Alert>
      )}

      <Stack direction="row" sx={{ gap: 2, flexWrap: "wrap", mb: 2 }}>
        <Metric label="Réponses reçues" value={String(summary?.total ?? 0)} />
        <Metric
          label="Avec un numéro"
          value={String(summary?.withPhone ?? 0)}
          hint="joignables pour les résultats"
        />
        <Metric
          label="Acceptent un entretien"
          value={String(summary?.acceptingInterview ?? 0)}
          hint="entretien de 45 minutes"
        />
        <Metric
          label="Dernière réponse"
          value={summary?.lastAnswerOn ? day(summary.lastAnswerOn) : "—"}
        />
      </Stack>

      <Stack direction={{ xs: "column", lg: "row" }} sx={{ gap: 2, mb: 2 }}>
        <Card variant="outlined" sx={{ flex: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Avancement vers la publication
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Il faut {summary?.publicationFloor ?? 5} réponses dans une région pour que ses
              propres chiffres remplacent ceux de son pays.
            </Typography>
            {summary && summary.areas.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Aucune région pour l&apos;instant.
              </Typography>
            )}
            {summary && summary.areas.length > 0 && (
              <Table size="small" sx={{ mt: 1 }} aria-label="Avancement vers la publication">
                <TableHead>
                  <TableRow>
                    <TableCell>Région</TableCell>
                    <TableCell>Pays</TableCell>
                    <TableCell align="right">Réponses</TableCell>
                    <TableCell align="right">Manquantes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summary.areas.map((area) => (
                    <TableRow key={`${area.country}-${area.region}`} hover>
                      <TableCell>{area.region}</TableCell>
                      <TableCell>{surveyLabel(COUNTRY_LABELS, area.country)}</TableCell>
                      <TableCell align="right">{area.answers}</TableCell>
                      <TableCell align="right">
                        {area.missingBeforePublication === 0 ? (
                          <Chip size="small" color="success" label="publiée" />
                        ) : (
                          <strong>{area.missingBeforePublication}</strong>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Qui relaie le lien
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Tel que le répondant l&apos;a écrit. Les réponses sans nom ne sont pas attribuées.
            </Typography>
            {summary && summary.referrers.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Personne n&apos;a encore été cité.
              </Typography>
            )}
            {summary && summary.referrers.length > 0 && (
              <Table size="small" sx={{ mt: 1 }} aria-label="Qui relaie le lien">
                <TableBody>
                  {summary.referrers.map((r) => (
                    <TableRow key={r.referrer} hover>
                      <TableCell>{r.referrer}</TableCell>
                      <TableCell align="right">{r.answers}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </Stack>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            sx={{ gap: 2, alignItems: { md: "center" } }}
          >
            <TextField
              select
              size="small"
              label="Pays"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              sx={{ minWidth: 170 }}
            >
              <MenuItem value="">Tous</MenuItem>
              {Object.entries(COUNTRY_LABELS).map(([code, label]) => (
                <MenuItem key={code} value={code}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Région"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              sx={{ minWidth: 170 }}
            />
            <TextField
              select
              size="small"
              label="Élevage"
              value={flockType}
              onChange={(e) => setFlockType(e.target.value)}
              sx={{ minWidth: 190 }}
            >
              <MenuItem value="">Tous</MenuItem>
              {Object.entries(FLOCK_TYPE_LABELS).map(([code, label]) => (
                <MenuItem key={code} value={code}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              control={
                <Switch
                  checked={interviewOnly}
                  onChange={(e) => setInterviewOnly(e.target.checked)}
                />
              }
              label="À rappeler"
            />
            <Box sx={{ flexGrow: 1 }} />
            <Button
              variant="outlined"
              startIcon={<Download size={16} />}
              disabled={rows.length === 0}
              onClick={() => downloadCsv("enquete-jawdi.csv", csv)}
            >
              Exporter ({rows.length})
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          {answers.isFetching && <CircularProgress size={22} sx={{ mb: 1 }} />}
          {!answers.isFetching && rows.length === 0 && (
            <Stack direction="row" sx={{ gap: 1, alignItems: "center", py: 2 }}>
              <ClipboardList size={16} />
              <Typography variant="body2" color="text.secondary">
                {total === 0 && !country && !region && !flockType && !interviewOnly
                  ? "Aucune réponse pour l'instant. Le questionnaire est en ligne sur jawdi.app/enquete."
                  : "Aucune réponse pour ces critères."}
              </Typography>
            </Stack>
          )}
          {rows.length > 0 && (
            <>
              <Typography variant="caption" color="text.secondary">
                {total} réponse{total > 1 ? "s" : ""} — cliquez une ligne pour lire tout le
                questionnaire.
              </Typography>
              <Table size="small" sx={{ mt: 1 }} aria-label="Réponses au questionnaire">
                <TableHead>
                  <TableRow>
                    <TableCell>Reçue le</TableCell>
                    <TableCell>Où</TableCell>
                    <TableCell>Élevage</TableCell>
                    <TableCell align="right">Sujets</TableCell>
                    <TableCell align="right">Poussin</TableCell>
                    <TableCell align="right">Sac</TableCell>
                    <TableCell>Tient ses comptes</TableCell>
                    <TableCell>Prêt à payer</TableCell>
                    <TableCell>Téléphone</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.id}
                      hover
                      sx={{ cursor: "pointer" }}
                      onClick={() => setOpenRow(row)}
                    >
                      <TableCell>{day(row.receivedAt)}</TableCell>
                      <TableCell>{place(row)}</TableCell>
                      <TableCell>{surveyLabel(FLOCK_TYPE_LABELS, row.flockType)}</TableCell>
                      <TableCell align="right">{row.currentBirds ?? "—"}</TableCell>
                      <TableCell align="right">{fcfa(row.chickPrice) ?? "—"}</TableCell>
                      <TableCell align="right">{fcfa(row.lastBagPrice) ?? "—"}</TableCell>
                      <TableCell>
                        {surveyLabel(RECORD_KEEPING_LABELS, row.recordKeeping) ?? "—"}
                      </TableCell>
                      <TableCell>
                        {surveyLabel(WILLINGNESS_LABELS, row.willingnessToPay) ?? "—"}
                      </TableCell>
                      <TableCell>
                        {row.phone ? (
                          <Stack direction="row" sx={{ gap: 0.5, alignItems: "center" }}>
                            {row.acceptsInterview && <PhoneCall size={14} />}
                            <span>{row.phone}</span>
                          </Stack>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {openRow && <AnswerDetail row={openRow} onClose={() => setOpenRow(null)} />}
    </Box>
  );
}
