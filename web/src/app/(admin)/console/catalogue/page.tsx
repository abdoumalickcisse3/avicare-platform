"use client";

import { AdminShell } from "@/components/admin/AdminShell";
import { CatalogEditor } from "@/components/admin/CatalogEditor";

export default function ConsoleCatalogPage() {
  return (
    <AdminShell>
      <CatalogEditor />
    </AdminShell>
  );
}
