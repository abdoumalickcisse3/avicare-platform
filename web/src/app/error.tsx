"use client";

import { Box, Button, Typography } from "@mui/material";

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
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        {error.message}
      </Typography>
      <Button variant="contained" onClick={reset}>
        Réessayer
      </Button>
    </Box>
  );
}
