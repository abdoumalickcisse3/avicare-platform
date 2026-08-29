"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { Megaphone, Plus, Send } from "lucide-react";
import {
  useGetAnnouncementsQuery,
  useGetBroadcastRecipientsQuery,
  useSaveAnnouncementMutation,
  useSendBroadcastMutation,
} from "@/store/api/adminApi";
import { apiErrorMessage } from "@/lib/apiError";
import type { AnnouncementView } from "@/types";

const SEVERITIES = [
  { value: "INFO", label: "Information" },
  { value: "WARNING", label: "Avertissement" },
  { value: "CRITICAL", label: "Critique" },
] as const;

interface Draft {
  id?: number;
  title: string;
  body: string;
  severity: string;
  startsAt: string;
  endsAt: string;
  published: boolean;
}

/** `datetime-local` wants `YYYY-MM-DDTHH:mm`; the API speaks ISO without a zone. */
function toLocalInput(iso: string | null): string {
  return iso ? iso.slice(0, 16) : "";
}

function emptyDraft(): Draft {
  return {
    title: "",
    body: "",
    severity: "INFO",
    startsAt: new Date().toISOString().slice(0, 16),
    endsAt: "",
    published: false,
  };
}

function draftOf(a: AnnouncementView): Draft {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    severity: a.severity,
    startsAt: toLocalInput(a.startsAt),
    endsAt: toLocalInput(a.endsAt),
    published: a.published,
  };
}

function isLive(a: AnnouncementView): boolean {
  const now = Date.now();
  return (
    a.published &&
    new Date(a.startsAt).getTime() <= now &&
    (a.endsAt === null || new Date(a.endsAt).getTime() > now)
  );
}

/**
 * Announcements and WhatsApp campaigns.
 *
 * The two live on one screen because they answer the same question — "everyone needs to know
 * this" — with different costs. A banner is free and passive; a campaign spends a credit per
 * recipient and lands on a phone. The screen shows the recipient count before sending for exactly
 * that reason.
 */
export function CommunicationPanel() {
  const { data: announcements = [], isLoading } = useGetAnnouncementsQuery();
  const { data: recipients } = useGetBroadcastRecipientsQuery();
  const [save, { isLoading: saving }] = useSaveAnnouncementMutation();
  const [sendBroadcast, { isLoading: sending }] = useSendBroadcastMutation();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState("");
  const [confirmSend, setConfirmSend] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onSave = async () => {
    if (!draft) return;
    setError(null);
    try {
      await save({
        id: draft.id,
        title: draft.title,
        body: draft.body,
        severity: draft.severity,
        startsAt: draft.startsAt,
        endsAt: draft.endsAt ? draft.endsAt : null,
        published: draft.published,
      }).unwrap();
      setDraft(null);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const onSend = async () => {
    setError(null);
    try {
      const { queued } = await sendBroadcast({ message, farmIds: [] }).unwrap();
      setNotice(`${queued} message(s) mis en file. L'envoi part par lots dans les minutes qui suivent.`);
      setMessage("");
      setConfirmSend(false);
    } catch (e) {
      setError(apiErrorMessage(e));
      setConfirmSend(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          Communication
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Bannières dans l&apos;application et campagnes WhatsApp.
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}

      <Card variant="outlined">
        <CardContent>
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between", mb: 2, gap: 2 }}
          >
            <Typography variant="subtitle2">Annonces</Typography>
            <Button
              size="small"
              variant="contained"
              startIcon={<Plus size={16} />}
              onClick={() => setDraft(emptyDraft())}
            >
              Nouvelle annonce
            </Button>
          </Stack>
          {isLoading ? (
            <CircularProgress size={22} />
          ) : announcements.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Aucune annonce.
            </Typography>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Titre</TableCell>
                    <TableCell>Fenêtre</TableCell>
                    <TableCell>État</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {announcements.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {a.title}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {a.startsAt.slice(0, 10)} →{" "}
                          {a.endsAt ? a.endsAt.slice(0, 10) : "sans fin"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={isLive(a) ? "success" : "default"}
                          variant={isLive(a) ? "filled" : "outlined"}
                          label={isLive(a) ? "visible" : a.published ? "programmée" : "brouillon"}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => setDraft(draftOf(a))}>
                          Modifier
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1.5 }}>
            <Megaphone size={18} />
            <Typography variant="subtitle2">Campagne WhatsApp</Typography>
          </Stack>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Chaque destinataire consomme un crédit Konekt. La campagne partira à{" "}
            <b>{recipients?.count ?? 0} personne(s)</b> — tous les membres actifs ayant un numéro,
            comptés une seule fois même s&apos;ils gèrent plusieurs fermes.
          </Alert>
          <TextField
            label="Message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            multiline
            minRows={3}
            fullWidth
            helperText={`${message.length}/1000 caractères`}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
          <Button
            sx={{ mt: 2 }}
            variant="contained"
            startIcon={<Send size={16} />}
            disabled={message.trim().length === 0 || sending}
            onClick={() => setConfirmSend(true)}
          >
            Envoyer
          </Button>
        </CardContent>
      </Card>

      <Dialog open={confirmSend} onClose={() => setConfirmSend(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Confirmer la campagne</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Alert severity="warning">
              {recipients?.count ?? 0} message(s) seront envoyés et autant de crédits consommés. Un
              message parti ne se rappelle pas.
            </Alert>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
              {message}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmSend(false)}>Annuler</Button>
          <Button variant="contained" onClick={onSend} disabled={sending}>
            Envoyer maintenant
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!draft} onClose={() => setDraft(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>
          {draft?.id ? "Modifier l'annonce" : "Nouvelle annonce"}
        </DialogTitle>
        <DialogContent dividers>
          {draft && (
            <Stack spacing={2.5}>
              <TextField
                label="Titre"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                fullWidth
              />
              <TextField
                label="Message"
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                multiline
                minRows={3}
                fullWidth
              />
              <TextField
                select
                label="Niveau"
                value={draft.severity}
                onChange={(e) => setDraft({ ...draft, severity: e.target.value })}
                fullWidth
              >
                {SEVERITIES.map((s) => (
                  <MenuItem key={s.value} value={s.value}>
                    {s.label}
                  </MenuItem>
                ))}
              </TextField>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Début"
                  type="datetime-local"
                  value={draft.startsAt}
                  onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  label="Fin"
                  type="datetime-local"
                  value={draft.endsAt}
                  onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })}
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Stack>
              {!draft.endsAt && (
                <Alert severity="info">
                  Sans date de fin, cette annonce restera affichée jusqu&apos;à ce que quelqu&apos;un
                  pense à la retirer.
                </Alert>
              )}
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.published}
                    onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
                  />
                }
                label="Publiée"
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDraft(null)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={onSave}
            disabled={saving || !draft?.title.trim() || !draft?.body.trim()}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
