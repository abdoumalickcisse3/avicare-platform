"use client";

import { AdminShell } from "@/components/admin/AdminShell";
import { SurveyAnswers } from "@/components/admin/SurveyAnswers";

export default function ConsoleEnquetePage() {
  return (
    <AdminShell>
      <SurveyAnswers />
    </AdminShell>
  );
}
