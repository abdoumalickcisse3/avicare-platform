"use client";

import { AdminShell } from "@/components/admin/AdminShell";
import { PartnerTable } from "@/components/admin/PartnerTable";

export default function ConsolePartnersPage() {
  return (
    <AdminShell>
      <PartnerTable />
    </AdminShell>
  );
}
