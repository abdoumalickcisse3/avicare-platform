"use client";

import RootError from "../error";

/**
 * Same screen as the root boundary, but raised below the dashboard layout so the navigation stays:
 * a page that throws no longer takes the sidebar with it and the user can go elsewhere.
 */
export default function DashboardError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RootError {...props} />;
}
