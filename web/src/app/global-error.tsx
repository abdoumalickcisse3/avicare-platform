"use client";

/**
 * Boundary for a crash in the root layout itself (theme provider, store provider). It replaces the
 * whole document, so no MUI and no store: plain markup that cannot fail the same way.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "4rem 1.5rem",
        }}
      >
        <h1>Une erreur est survenue</h1>
        <p>L&apos;application n&apos;a pas pu s&apos;afficher. Réessayez dans un instant.</p>
        {error.digest && <p>Référence : {error.digest.slice(0, 8).toUpperCase()}</p>}
        <button
          onClick={reset}
          style={{ padding: "0.6rem 1.4rem", fontSize: "1rem", cursor: "pointer" }}
        >
          Réessayer
        </button>
      </body>
    </html>
  );
}
