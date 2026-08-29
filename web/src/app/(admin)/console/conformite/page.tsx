"use client";

import { AdminShell } from "@/components/admin/AdminShell";
import { CompliancePanel } from "@/components/admin/CompliancePanel";

export default function ConsoleCompliancePage() {
  return (
    <AdminShell>
      <CompliancePanel />
    </AdminShell>
  );
}
