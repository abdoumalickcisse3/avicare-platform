"use client";

import { AdminShell } from "@/components/admin/AdminShell";
import { StaffManager } from "@/components/admin/StaffManager";

export default function ConsoleStaffPage() {
  return (
    <AdminShell>
      <StaffManager />
    </AdminShell>
  );
}
