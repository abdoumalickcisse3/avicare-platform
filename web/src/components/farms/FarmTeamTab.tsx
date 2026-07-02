"use client";

import { useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Pencil, UserPlus } from "lucide-react";
import { useGetMembersQuery } from "@/store/api/membersApi";
import { apiErrorMessage } from "@/lib/apiError";
import { FARM_ROLE_LABELS } from "@/constants/farmRoles";
import { colors } from "@/theme/tokens";
import { AddMemberDialog } from "./AddMemberDialog";
import { EditMemberDialog } from "./EditMemberDialog";
import type { Member } from "@/types";

interface FarmTeamTabProps {
  farmId: number;
}

function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/**
 * Team management tab (A6-2 step 4.7). MemberResponse is enriched with
 * fullName/email/phone alongside role/permissions/active, so members are
 * shown by name with a role badge and active status.
 */
export function FarmTeamTab({ farmId }: FarmTeamTabProps) {
  const { data: members, isLoading, error } = useGetMembersQuery(farmId);

  const [addOpen, setAddOpen] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 2 }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Liste des collaborateurs
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {members ? `${members.length} membre(s)` : "—"}
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<UserPlus size={18} />}
          onClick={() => setAddOpen(true)}
        >
          Ajouter un membre
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiErrorMessage(error)}
        </Alert>
      )}

      {isLoading && <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />}

      {!isLoading && !error && members && members.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
          Aucun membre pour l&apos;instant. Ajoutez votre premier collaborateur.
        </Typography>
      )}

      {!isLoading && !error && members && members.length > 0 && (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Membre</TableCell>
                <TableCell>Rôle</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: colors.primary[50],
                          color: colors.primary[700],
                          fontSize: "0.8rem",
                          fontWeight: 700,
                        }}
                      >
                        {initials(member.fullName)}
                      </Avatar>
                      <Stack spacing={0}>
                        <Typography variant="body2">{member.fullName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {member.email}
                        </Typography>
                      </Stack>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={FARM_ROLE_LABELS[member.role]}
                      size="small"
                      sx={{
                        bgcolor: colors.primary[50],
                        color: colors.primary[700],
                        fontWeight: 600,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={member.active ? "Actif" : "Inactif"}
                      size="small"
                      sx={{
                        bgcolor: member.active ? colors.success.light : colors.neutral[200],
                        color: member.active ? colors.success.dark : colors.neutral[700],
                        fontWeight: 600,
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      aria-label={`Modifier ${member.fullName}`}
                      onClick={() => setEditMember(member)}
                      size="small"
                    >
                      <Pencil size={18} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <AddMemberDialog open={addOpen} onClose={() => setAddOpen(false)} farmId={farmId} />
      {editMember && (
        <EditMemberDialog
          open
          onClose={() => setEditMember(null)}
          farmId={farmId}
          member={editMember}
        />
      )}
    </Box>
  );
}
