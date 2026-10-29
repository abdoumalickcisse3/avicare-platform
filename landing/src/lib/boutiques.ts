/**
 * Où l'application est réellement téléchargeable, et comment le dire sans mentir.
 *
 * Trois pages affichaient chacune leur copie de `Boolean(appStoreUrl || playStoreUrl)` et leur
 * copie de la phrase « Bientôt sur l'App Store et Google Play ». Trois copies, c'est trois
 * occasions d'en corriger deux. Et la phrase elle-même ne connaissait que deux états — tout ou
 * rien — alors qu'Android arrive par un téléchargement direct avant d'arriver sur le Play Store.
 *
 * La règle qui ne bouge pas : **une URL absente n'émet aucun lien** (cf. `StoreLinks.astro`), et
 * aucune phrase n'annonce disponible ce qui ne l'est pas.
 */

export interface EtatBoutiques {
  /** URL App Store, vide tant que l'app n'y est pas en vente. */
  readonly appStore: string;
  /** URL Google Play, vide tant que l'app n'y est pas publiée. */
  readonly playStore: string;
  /** Téléchargement direct de l'APK Android — une voie, pas une boutique. */
  readonly androidApk: string;
}

export function etatBoutiques(env: ImportMetaEnv): EtatBoutiques {
  return {
    appStore: env.PUBLIC_APP_STORE_URL || "",
    playStore: env.PUBLIC_PLAY_STORE_URL || "",
    androidApk: env.PUBLIC_ANDROID_APK_URL || "",
  };
}

/** Y a-t-il quoi que ce soit à télécharger aujourd'hui ? */
export function telechargeable(e: EtatBoutiques): boolean {
  return Boolean(e.appStore || e.playStore || e.androidApk);
}

/**
 * La phrase d'attente, ou `null` quand il n'y a plus rien à attendre.
 *
 * Elle ne nomme que les boutiques réellement absentes, et signale d'abord Android quand l'APK est
 * là — sinon le lecteur voit un bouton de téléchargement sous une phrase qui dit « bientôt ».
 */
export function phraseAVenir(e: EtatBoutiques): string | null {
  const manquantes: string[] = [];
  if (!e.appStore) manquantes.push("l'App Store");
  if (!e.playStore) manquantes.push("Google Play");
  if (manquantes.length === 0) return null;

  const attente = `Bientôt sur ${manquantes.join(" et ")}`;
  return e.androidApk && !e.playStore ? `Android disponible maintenant · ${attente}` : attente;
}
