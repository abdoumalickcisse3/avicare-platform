import { Box, Button, Typography } from "@mui/material";

/**
 * The page for an address that does not exist.
 *
 * <p>Without it, Next serves its own default: English, unstyled, and with no way back — the last
 * thing a farmer who mistyped a URL, or followed a link to something since deleted, should meet.
 *
 * <p>Unlike {@code error.tsx}, it shows no reference. A wrong URL leaves nothing to find in
 * /console/traces, and printing an identifier that leads nowhere would teach the reader to ignore
 * them — including on the 500 page, where the reference is real and worth reading out.
 *
 * <p>The action returns to the dashboard rather than offering to retry: retrying a wrong address
 * leaves it wrong.
 */
export default function NotFound() {
  return (
    <Box sx={{ p: 4, textAlign: "center", mt: 8 }}>
      <Typography variant="h4" gutterBottom>
        Page introuvable
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Cette adresse n&apos;existe pas, ou la page a été déplacée.
      </Typography>
      {/* component="a", not next/link: this file is a Server Component, and a function cannot
          cross the server/client boundary into MUI's Button — it throws
          "Functions cannot be passed directly to Client Components" and takes the whole render
          down with it. A full navigation is the right trade here anyway: the page a visitor
          lands on after a wrong URL should not depend on the router being healthy. */}
      <Button component="a" href="/dashboard" variant="contained">
        Retour au tableau de bord
      </Button>
    </Box>
  );
}
