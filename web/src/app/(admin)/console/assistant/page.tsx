"use client";

import { AdminShell } from "@/components/admin/AdminShell";
import { AssistantReview } from "@/components/admin/AssistantReview";

export default function ConsoleAssistantPage() {
  return (
    <AdminShell>
      <AssistantReview />
    </AdminShell>
  );
}
