"use client";

import { Box, Button, Chip, Stack, Typography } from "@mui/material";

/**
 * Last-resort boundary for a render that threw.
 *
 * <p>It shows the reference Next.js attaches to the failure (`digest`) for the same reason API
 * errors now carry theirs: a user who can read an identifier out loud turns "the page crashed"
 * into something findable. API failures get their reference from the backend's `traceId` (see
 * `apiErrorMessage`), which is searchable in /console/traces.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Box sx={{ p: 4, textAlign: "center", mt: 8 }}>
      <Typography variant="h4" gutterBottom>
        Une erreur est survenue
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        {error.message}
      </Typography>
      {error.digest && (
        <Stack direction="row" sx={{ justifyContent: "center", mb: 3 }}>
          <Chip
            size="small"
            variant="outlined"
            label={`Référence : ${error.digest.slice(0, 8).toUpperCase()}`}
          />
        </Stack>
      )}
      <Button variant="contained" onClick={reset}>
        Réessayer
      </Button>
    </Box>
  );
}
