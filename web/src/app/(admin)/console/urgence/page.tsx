"use client";

import { AdminShell } from "@/components/admin/AdminShell";
import { EmergencyPanel } from "@/components/admin/EmergencyPanel";

export default function ConsoleEmergencyPage() {
  return (
    <AdminShell>
      <EmergencyPanel />
    </AdminShell>
  );
}
