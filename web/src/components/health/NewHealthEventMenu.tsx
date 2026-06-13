"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
} from "@mui/material";
import { ChevronDown, Eye, Pill, Stethoscope, Syringe } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { useGetProductionUnitsQuery } from "@/store/api/productionUnitsApi";
import { VaccinationDialog } from "./VaccinationDialog";
import { ObservationDialog } from "./ObservationDialog";
import { TreatmentDialog } from "./TreatmentDialog";
import { VetVisitDialog } from "./VetVisitDialog";
import type { ProductionUnit } from "@/types";

type EventType = "vaccination" | "observation" | "treatment" | "vet-visit";

/**
 * "Nouvel événement" dropdown for the farm-level overview. Since no lot is
 * pre-selected here, choosing an event type first asks for the target lot, then
 * opens the matching dialog. Treatment / vet-visit only appear when advanced.
 */
export function NewHealthEventMenu({
  farmId,
  hasAdvanced,
}: {
  farmId: number;
  hasAdvanced: boolean;
}) {
  const { data: units = [] } = useGetProductionUnitsQuery({ farmId });
  const currentUserId = useAppSelector((s) => s.auth.currentUser?.id);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [pendingType, setPendingType] = useState<EventType | null>(null);
  const [pickedUnitId, setPickedUnitId] = useState("");
  const [openType, setOpenType] = useState<EventType | null>(null);

  const activeUnits = useMemo(
    () => units.filter((u) => u.status === "ACTIVE" || u.status === "PLANNED"),
    [units],
  );

  const chosenUnit: ProductionUnit | undefined = useMemo(
    () => units.find((u) => String(u.id) === pickedUnitId),
    [units, pickedUnitId],
  );

  const unitName = chosenUnit
    ? chosenUnit.name || `Lot #${chosenUnit.id}`
    : "";

  const items: { type: EventType; label: string; icon: React.ReactNode }[] = [
    { type: "vaccination", label: "Vaccination", icon: <Syringe size={18} /> },
    { type: "observation", label: "Observation", icon: <Eye size={18} /> },
    ...(hasAdvanced
      ? [
          { type: "treatment" as const, label: "Traitement", icon: <Pill size={18} /> },
          { type: "vet-visit" as const, label: "Visite vétérinaire", icon: <Stethoscope size={18} /> },
        ]
      : []),
  ];

  const startPick = (type: EventType) => {
    setAnchorEl(null);
    setPendingType(type);
    setPickedUnitId(activeUnits.length === 1 ? String(activeUnits[0].id) : "");
  };

  const confirmPick = () => {
    if (!pickedUnitId) return;
    setOpenType(pendingType);
    setPendingType(null);
  };

  const closeDialog = () => {
    setOpenType(null);
    setPickedUnitId("");
  };

  return (
    <>
      <Button
        variant="contained"
        color="secondary"
        endIcon={<ChevronDown size={18} />}
        onClick={(e) => setAnchorEl(e.currentTarget)}
      >
        Nouvel événement
      </Button>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        {items.map((it) => (
          <MenuItem key={it.type} onClick={() => startPick(it.type)}>
            <ListItemIcon>{it.icon}</ListItemIcon>
            <ListItemText>{it.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      {/* Step 1 — choose the lot */}
      <Dialog open={!!pendingType} onClose={() => setPendingType(null)} fullWidth maxWidth="xs">
        <DialogTitle>Choisir un lot</DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            label="Lot"
            value={pickedUnitId}
            onChange={(e) => setPickedUnitId(e.target.value)}
            sx={{ mt: 1 }}
            helperText={activeUnits.length === 0 ? "Aucun lot actif" : undefined}
          >
            {activeUnits.map((u) => (
              <MenuItem key={u.id} value={String(u.id)}>
                {u.name || `Lot #${u.id}`}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setPendingType(null)}>
            Annuler
          </Button>
          <Button variant="contained" color="secondary" disabled={!pickedUnitId} onClick={confirmPick}>
            Continuer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Step 2 — the actual event dialog */}
      {chosenUnit && (
        <>
          <VaccinationDialog
            open={openType === "vaccination"}
            onClose={closeDialog}
            farmId={farmId}
            unitId={chosenUnit.id}
            unitName={unitName}
            currentCount={chosenUnit.currentCount}
            currentUserId={currentUserId}
          />
          <ObservationDialog
            open={openType === "observation"}
            onClose={closeDialog}
            farmId={farmId}
            unitId={chosenUnit.id}
            unitName={unitName}
            currentUserId={currentUserId}
          />
          <TreatmentDialog
            open={openType === "treatment"}
            onClose={closeDialog}
            farmId={farmId}
            unitId={chosenUnit.id}
            unitName={unitName}
            currentCount={chosenUnit.currentCount}
            currentUserId={currentUserId}
          />
          <VetVisitDialog
            open={openType === "vet-visit"}
            onClose={closeDialog}
            farmId={farmId}
            unitId={chosenUnit.id}
            unitName={unitName}
          />
        </>
      )}
    </>
  );
}
