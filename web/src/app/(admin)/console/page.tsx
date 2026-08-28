"use client";

import { Card, CardContent, Stack, Typography } from "@mui/material";
import { AdminShell } from "@/components/admin/AdminShell";
import { useGetAdminMeQuery } from "@/store/api/adminApi";

export default function ConsoleHomePage() {
  const { data: me } = useGetAdminMeQuery();

  return (
    <AdminShell>
      <Stack spacing={3}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {me?.fullName ? `Bonjour ${me.fullName}` : "Console"}
        </Typography>
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Vos droits
            </Typography>
            <Typography variant="body2">
              {me?.superAdmin
                ? "Super-admin — toutes les permissions."
                : (me?.permissions ?? []).join(" · ") || "Aucune permission attribuée."}
            </Typography>
          </CardContent>
        </Card>
      </Stack>
    </AdminShell>
  );
}
