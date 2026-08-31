"use client";

import { AdminShell } from "@/components/admin/AdminShell";
import { SecurityPanel } from "@/components/admin/SecurityPanel";

export default function ConsoleSecurityPage() {
  return (
    <AdminShell>
      <SecurityPanel />
    </AdminShell>
  );
}
