/**
 * Les réglages qui décident si l'app publiée parle au bon serveur — ou à personne.
 *
 * `extra.apiUrl` valait `http://localhost:8080` en dur dans `app.json`. Rien ne le signalait :
 * l'app compile, démarre, affiche l'écran de connexion. Elle échoue seulement au premier appel
 * réseau, c'est-à-dire une fois installée depuis l'App Store — ou, au mieux, sur le téléphone du
 * relecteur d'Apple. En développement le défaut est même invisible, puisque `resolveApiUrl`
 * réécrit les adresses de bouclage vers la machine qui sert Metro.
 *
 * Ces vérifications lisent les fichiers de configuration réels, comme le fait
 * `NotificationDeliveryConfigTest` côté backend pour la même classe de faute : une valeur qui ne
 * casse rien de visible, et qu'aucun test fonctionnel n'atteint.
 */
import fs from 'fs';
import path from 'path';

const MOBILE_ROOT = path.resolve(__dirname, '..', '..', '..');

const readJson = (file: string) =>
  JSON.parse(fs.readFileSync(path.join(MOBILE_ROOT, file), 'utf8'));

describe('configuration de publication', () => {
  describe('eas.json', () => {
    const eas = readJson('eas.json');

    it.each(['preview', 'production'])(
      'le profil %s parle à un serveur joignable, en HTTPS',
      (profile) => {
        const url: string | undefined = eas.build[profile]?.env?.EXPO_PUBLIC_API_URL;

        expect(url).toBeDefined();
        // iOS refuse le HTTP en clair (App Transport Security) : une URL en http rend l'app
        // muette sur l'appareil, sans erreur de build.
        expect(url).toMatch(/^https:\/\//);
        expect(url).not.toMatch(/localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\./);
      },
    );

    it('laisse EAS attribuer les numéros de build', () => {
      // Deux soumissions portant le même numéro de build sont refusées par App Store Connect.
      expect(eas.cli.appVersionSource).toBe('remote');
      expect(eas.build.production.autoIncrement).toBe(true);
    });
  });

  describe('app.json', () => {
    const { expo } = readJson('app.json');

    it("porte l'identité de l'app, pas celle du gabarit", () => {
      // `name` est ce qui s'affiche sous l'icône : le gabarit Expo le laisse à "mobile".
      expect(expo.name).toBe('Jawdi');
      expect(expo.slug).not.toBe('mobile');
      expect(expo.scheme).toBe('jawdi');
    });

    it('porte des identifiants de paquet, qui sont immuables après publication', () => {
      expect(expo.ios.bundleIdentifier).toBe('app.jawdi.mobile');
      expect(expo.android.package).toBe('app.jawdi.mobile');
    });

    it("n'embarque aucune adresse de serveur en dur", () => {
      // L'adresse vient de l'environnement, via app.config.ts. La réintroduire ici la figerait
      // dans le bundle de production.
      expect(expo.extra?.apiUrl).toBeUndefined();
    });
  });
});
