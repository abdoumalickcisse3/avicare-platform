"use client";

import { AdminShell } from "@/components/admin/AdminShell";
import { CommunicationPanel } from "@/components/admin/CommunicationPanel";

export default function ConsoleCommunicationPage() {
  return (
    <AdminShell>
      <CommunicationPanel />
    </AdminShell>
  );
}
