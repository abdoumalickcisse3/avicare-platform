"use client";

import { AdminShell } from "@/components/admin/AdminShell";
import { UserSearch } from "@/components/admin/UserSearch";

export default function ConsoleUsersPage() {
  return (
    <AdminShell>
      <UserSearch />
    </AdminShell>
  );
}
