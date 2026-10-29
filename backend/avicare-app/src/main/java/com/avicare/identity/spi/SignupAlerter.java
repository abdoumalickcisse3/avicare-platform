package com.avicare.identity.spi;

/**
 * Port disant qu'un compte vient d'être créé, à qui tient la main courante de la plateforme.
 *
 * <p>Même raison d'être que {@link StaffLoginAuditor} : l'identité ne doit importer aucun autre
 * contexte métier, elle déclare donc l'interface et {@code admin} l'implémente. {@code AuthService}
 * ne dépend que de ce type, propriété d'identity.
 *
 * <p>Pourquoi une alerte, et pourquoi maintenant : l'inscription publique remplace la conversation
 * WhatsApp où le porteur du projet créait chaque compte à la main. La porte s'ouvre sans lui — il
 * doit au moins savoir que quelqu'un est entré, le jour même, pour rappeler la personne.
 *
 * <p>Une implémentation ne doit <b>jamais</b> lever : perdre une inscription parce qu'un message
 * n'est pas parti, c'est perdre un client pour une raison qui ne le regarde pas.
 */
public interface SignupAlerter {

  /**
   * Un compte vient d'être créé.
   *
   * @param phone le numéro tel qu'il est stocké, en E.164 — son indicatif dit le pays, ce qui
   *     dispense l'alerte d'un champ pays
   */
  void accountCreated(Long userId, String fullName, String email, String phone);
}
