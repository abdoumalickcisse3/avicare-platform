package com.avicare.livestock.inventory;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Deux garanties tenues ici plutôt que dans un commentaire.
 *
 * <p>1. Le débit porte sur la valeur REÇUE. La réception est partielle possible : endetter la ferme
 * du total commandé lui ferait devoir des sacs qui ne sont jamais arrivés.
 *
 * <p>2. Le paquet du registre n'importe rien du contexte finance. C'est ce qui rend
 * structurellement impossible qu'une écriture du compte-courant crée une dépense — et donc que
 * l'aliment soit compté deux fois.
 */
class PurchaseOrderLedgerTest {

  /**
   * Les deux seuls fichiers du paquet autorisés à connaître les dépenses, et pourquoi.
   *
   * <p>Ils enregistrent la CHARGE — c'est leur travail et il précède ce chantier. Le compte-courant
   * enregistre la TRÉSORERIE, et ne doit jamais toucher aux dépenses : les deux ensemble
   * doubleraient le coût de l'aliment.
   *
   * <p>Cette liste est une porte, pas une passoire : y ajouter un fichier est une décision qui se
   * défend en revue, et c'est exactement la friction voulue.
   */
  private static final java.util.Set<String> ALLOWED =
      java.util.Set.of(
          // Reçoit un bon d'achat : enregistre la dépense d'achat, et (Task 3) le débit du
          // compte-courant. C'est le point précis où charge et trésorerie se croisent.
          "PurchaseOrderService.java",
          // Enregistre la dépense d'une entrée de stock directe (garde V25). Antérieur à ce
          // chantier, sans rapport avec le compte-courant.
          "StockMovementService.java");

  @Test
  void theLedgerPackageNeverImportsFinance() throws Exception {
    java.nio.file.Path root =
        java.nio.file.Path.of("src/main/java/com/avicare/livestock/inventory");

    List<String> offenders;
    try (var files = java.nio.file.Files.walk(root)) {
      offenders =
          files
              .filter(p -> p.toString().endsWith(".java"))
              .filter(
                  p -> {
                    try {
                      return java.nio.file.Files.readString(p).contains("com.avicare.finance");
                    } catch (java.io.IOException e) {
                      throw new IllegalStateException(e);
                    }
                  })
              .map(p -> p.getFileName().toString())
              .filter(name -> !ALLOWED.contains(name))
              .toList();
    }

    assertThat(offenders)
        .as(
            "Le compte-courant ne doit pas pouvoir écrire de dépense. Deux fichiers du paquet "
                + "connaissent les dépenses et sont listés dans ALLOWED avec leur raison ; tout "
                + "autre est un aller simple vers l'aliment compté deux fois.")
        .isEmpty();
  }
}
