import { HealthOverviewView } from "@/components/health/HealthOverviewView";

/**
 * Farm-level health overview (Sprint B3-5). The client view owns gating and
 * data fetching; this server component is a thin entry point.
 */
export default function HealthOverviewPage() {
  return <HealthOverviewView />;
}
