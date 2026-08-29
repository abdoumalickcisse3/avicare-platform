"use client";

import { AdminShell } from "@/components/admin/AdminShell";
import { PlatformCockpit } from "@/components/admin/PlatformCockpit";

export default function ConsoleCockpitPage() {
  return (
    <AdminShell>
      <PlatformCockpit />
    </AdminShell>
  );
}
