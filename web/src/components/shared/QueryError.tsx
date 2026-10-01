"use client";

import { Alert, Button } from "@mui/material";
import { apiErrorMessage, isNetworkError } from "@/lib/apiError";

/**
 * What a list or card shows when its query failed, so a failure is never read as "nothing here".
 * Offline gets its own wording: the data is not missing, the device just cannot reach it.
 */
export function QueryError({
  error,
  onRetry,
  sx,
}: {
  error: unknown;
  onRetry?: () => void;
  sx?: React.ComponentProps<typeof Alert>["sx"];
}) {
  return (
    <Alert
      severity={isNetworkError(error) ? "warning" : "error"}
      sx={sx}
      action={
        onRetry ? (
          <Button color="inherit" size="small" onClick={onRetry}>
            Réessayer
          </Button>
        ) : undefined
      }
    >
      {apiErrorMessage(error)}
    </Alert>
  );
}
