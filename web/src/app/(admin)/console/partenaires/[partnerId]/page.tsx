"use client";

import { use } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { PartnerDetailPanel } from "@/components/admin/PartnerDetailPanel";

export default function ConsolePartnerDetailPage({
  params,
}: {
  params: Promise<{ partnerId: string }>;
}) {
  const { partnerId } = use(params);

  return (
    <AdminShell>
      <PartnerDetailPanel partnerId={Number(partnerId)} />
    </AdminShell>
  );
}
