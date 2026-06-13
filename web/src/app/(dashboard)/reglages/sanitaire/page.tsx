import { HealthLibraryView } from "@/components/health/HealthLibraryView";

/**
 * Health library settings (Sprint B3-5): vaccines / treatments / programs
 * (read-only platform catalog) and the per-farm veterinarian directory (CRUD).
 * A dedicated route takes precedence over the generic [category] placeholder.
 */
export default function HealthLibraryPage() {
  return <HealthLibraryView />;
}
