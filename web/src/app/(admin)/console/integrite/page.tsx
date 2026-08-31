"use client";

import { AdminShell } from "@/components/admin/AdminShell";
import { IntegrityPanel } from "@/components/admin/IntegrityPanel";

export default function ConsoleIntegrityPage() {
  return (
    <AdminShell>
      <IntegrityPanel />
    </AdminShell>
  );
}
