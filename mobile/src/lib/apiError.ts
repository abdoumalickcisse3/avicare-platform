/**
 * Le message d'une erreur d'API, en miroir de `web/src/lib/apiError.ts`.
 *
 * Le backend répond en RFC 7807 : `detail` dit ce qui s'est passé en français, et c'est la seule
 * chose que l'éleveur peut lire. Sans cela, les écrans affichaient « Réessayez » sur tout — y
 * compris sur une règle métier qu'aucun nombre d'essais ne changera : une vente déjà facturée,
 * une transition refusée, une échéance mal saisie. « Réessayez » y est un mauvais conseil.
 *
 * Un échec serveur (5xx) porte en plus sa référence : c'est l'incident que personne ne peut
 * résoudre seul, et l'identifiant est ce qui permet de le retrouver. Une 4xx reste propre — c'est
 * l'affaire de l'utilisateur, un numéro d'incident n'y serait que du bruit.
 */
type MaybeProblem = {
  status?: number;
  data?: { detail?: string; title?: string; message?: string; traceId?: string };
};

/** Les huit premiers caractères de la trace, en majuscules — comme le web. */
function reference(err: MaybeProblem): string | null {
  const trace = err?.data?.traceId;
  return trace ? trace.replace(/-/g, '').slice(0, 8).toUpperCase() : null;
}

/**
 * @param fallback ce qu'on affiche quand le serveur n'a rien dit d'exploitable — une panne
 *   réseau, par exemple, où le conseil « réessayez » est le bon.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const err = (error ?? {}) as MaybeProblem;
  const message = err.data?.detail ?? err.data?.title ?? err.data?.message;
  if (!message) return fallback;

  const ref = (err.status ?? 0) >= 500 ? reference(err) : null;
  return ref ? `${message} (réf. ${ref})` : message;
}
