"use client";

import { AdminShell } from "@/components/admin/AdminShell";
import { FarmTable } from "@/components/admin/FarmTable";

export default function ConsoleFarmsPage() {
  return (
    <AdminShell>
      <FarmTable />
    </AdminShell>
  );
}
