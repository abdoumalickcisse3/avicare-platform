/**
 * La part de la configuration qui dépend de l'environnement de build.
 *
 * Le reste vit dans `app.json`, statique et lisible en diff ; ce fichier l'étend. Une seule chose
 * y est dynamique, et c'est la plus dangereuse à laisser en dur : **l'adresse du backend**.
 *
 * `extra.apiUrl` valait `http://localhost:8080` dans `app.json`. Un build de production emportait
 * donc cette valeur : l'app s'ouvrait, affichait l'écran de connexion, et échouait sur tout —
 * iOS refuse en plus le HTTP en clair (App Transport Security). Le problème ne se voit jamais en
 * développement, puisque `resolveApiUrl` réécrit les adresses de bouclage vers la machine qui sert
 * Metro. Il ne se serait vu qu'une fois l'app entre les mains d'Apple.
 *
 * Désormais l'adresse vient de l'environnement, et le défaut reste le développement local :
 * oublier la variable dégrade vers localhost (visible au premier essai) au lieu de publier une
 * app muette.
 *
 * `EXPO_PUBLIC_` : la valeur est inscrite en clair dans le bundle. C'est acceptable — une URL
 * publique n'est pas un secret. Aucune clé ne doit jamais passer par ici.
 */
import type { ConfigContext, ExpoConfig } from 'expo/config';

const DEV_API_URL = 'http://localhost:8080';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Jawdi',
  slug: config.slug ?? 'jawdi',
  extra: {
    ...config.extra,
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? DEV_API_URL,
  },
});
