"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Chip,
  Divider,
  IconButton,
  Skeleton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { Pencil, Plus, Sparkles } from "lucide-react";
import { useGetMembersQuery } from "@/store/api/membersApi";
import {
  useGenerateSalariesMutation,
  useGetSalariesQuery,
  useGetSalarySettingsQuery,
  usePaySalaryMutation,
} from "@/store/api/financeApi";
import { useFarmRole, canManageCatalog } from "@/hooks/useFarmRole";
import { SalarySettingDialog } from "./SalarySettingDialog";
import { AdvancesPanel } from "./AdvancesPanel";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency } from "@/lib/format";
import { colors } from "@/theme/tokens";
import type { Salary, SalaryStatus, SalarySetting } from "@/types";

/** Current month as YYYY-MM, used as the default generation period. */
function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const STATUS_META: Record<SalaryStatus, { label: string; bg: string; color: string }> = {
  DUE: { label: "Dû", bg: colors.warning.light, color: colors.warning.dark },
  PAID: { label: "Payé", bg: colors.success.light, color: colors.success.dark },
};

export function SalariesView({ farmId }: { farmId: number }) {
  const { data: members = [] } = useGetMembersQuery(farmId);
  const {
    data: settings,
    isLoading: settingsLoading,
    error: settingsError,
  } = useGetSalarySettingsQuery({ farmId });

  const [period, setPeriod] = useState(currentPeriod);
  const {
    data: salaries,
    isLoading: salariesLoading,
    error: salariesError,
  } = useGetSalariesQuery({ farmId, period });

  const [generateSalaries, { isLoading: generating }] = useGenerateSalariesMutation();
  const [paySalary, { isLoading: paying }] = usePaySalaryMutation();
  const { showToast } = useToast();
  const role = useFarmRole(farmId);
  const canManage = canManageCatalog(role);

  const [addOpen, setAddOpen] = useState(false);
  const [editSetting, setEditSetting] = useState<SalarySetting | null>(null);

  const memberName = (userId: number) => members.find((m) => m.userId === userId)?.fullName ?? `#${userId}`;

  const handleGenerate = async () => {
    try {
      await generateSalaries({ farmId, period }).unwrap();
      showToast("Salaires générés.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  const handlePay = async (salary: Salary) => {
    try {
      await paySalary({ farmId, id: salary.id }).unwrap();
      showToast("Salaire marqué payé.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 2 }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Réglages de salaire
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Salaire mensuel par membre de la ferme.
          </Typography>
        </Box>
        {canManage && (
          <Button variant="contained" color="primary" startIcon={<Plus size={18} />} onClick={() => setAddOpen(true)}>
            Ajouter
          </Button>
        )}
      </Stack>

      {settingsError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiErrorMessage(settingsError)}
        </Alert>
      )}

      {settingsLoading && <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 2, mb: 3 }} />}

      {!settingsLoading && !settingsError && settings && settings.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
          Aucun réglage de salaire. Ajoutez le premier.
        </Typography>
      )}

      {!settingsLoading && !settingsError && settings && settings.length > 0 && (
        <TableContainer sx={{ mb: 3 }}>
          <Table aria-label="Réglages de salaire">
            <TableHead>
              <TableRow>
                <TableCell>Membre</TableCell>
                <TableCell align="right">Salaire mensuel</TableCell>
                <TableCell>Actif</TableCell>
                {canManage && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {settings.map((setting) => (
                <TableRow key={setting.id} hover>
                  <TableCell>{memberName(setting.userId)}</TableCell>
                  <TableCell align="right">{formatCurrency(setting.monthlySalaryXof)}</TableCell>
                  <TableCell>
                    <Switch checked={setting.active} disabled size="small" />
                  </TableCell>
                  {canManage && (
                    <TableCell align="right">
                      <IconButton
                        aria-label={`Modifier ${memberName(setting.userId)}`}
                        onClick={() => setEditSetting(setting)}
                        size="small"
                      >
                        <Pencil size={18} />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Divider sx={{ mb: 3 }} />

      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        Génération mensuelle
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3, alignItems: { sm: "center" } }}>
        <TextField
          type="month"
          label="Période"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
        />
        {canManage && (
          <Button
            variant="contained"
            color="primary"
            startIcon={generating ? <CircularProgress size={16} color="inherit" /> : <Sparkles size={18} />}
            disabled={generating}
            onClick={handleGenerate}
          >
            Générer les salaires
          </Button>
        )}
      </Stack>

      {salariesError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiErrorMessage(salariesError)}
        </Alert>
      )}

      {salariesLoading && <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 2, mb: 3 }} />}

      {!salariesLoading && !salariesError && salaries && salaries.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
          Aucun salaire généré pour cette période.
        </Typography>
      )}

      {!salariesLoading && !salariesError && salaries && salaries.length > 0 && (
        <TableContainer sx={{ mb: 3 }}>
          <Table aria-label="Salaires de la période">
            <TableHead>
              <TableRow>
                <TableCell>Membre</TableCell>
                <TableCell>Période</TableCell>
                <TableCell align="right">Brut</TableCell>
                <TableCell align="right">Avance déduite</TableCell>
                <TableCell align="right">Net</TableCell>
                <TableCell>Statut</TableCell>
                {canManage && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {salaries.map((salary) => {
                const meta = STATUS_META[salary.status];
                return (
                  <TableRow key={salary.id} hover>
                    <TableCell>{memberName(salary.userId)}</TableCell>
                    <TableCell>{salary.period}</TableCell>
                    <TableCell align="right">{formatCurrency(salary.grossXof)}</TableCell>
                    <TableCell align="right">{formatCurrency(salary.advanceDeductedXof)}</TableCell>
                    <TableCell align="right">{formatCurrency(salary.netXof)}</TableCell>
                    <TableCell>
                      <Chip
                        label={meta.label}
                        size="small"
                        sx={{ bgcolor: meta.bg, color: meta.color, fontWeight: 600 }}
                      />
                    </TableCell>
                    {canManage && (
                      <TableCell align="right">
                        {salary.status === "DUE" && (
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={paying}
                            onClick={() => handlePay(salary)}
                          >
                            Marquer payé
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Divider sx={{ mb: 3 }} />

      <AdvancesPanel farmId={farmId} />

      {canManage && <SalarySettingDialog open={addOpen} onClose={() => setAddOpen(false)} farmId={farmId} />}
      {canManage && editSetting && (
        <SalarySettingDialog
          open
          onClose={() => setEditSetting(null)}
          farmId={farmId}
          setting={editSetting}
        />
      )}
    </Box>
  );
}
