-- Une facture annulée libère sa source.
--
-- V22 posait `UNIQUE (sale_id)` et `UNIQUE (delivery_id)` sans regarder le statut : une vente
-- facturée puis annulée — parce que l'échéance était fausse, parce que le client a changé d'avis —
-- ne pouvait plus JAMAIS être facturée. L'éleveur n'avait aucune issue depuis l'application, et
-- l'interface ne le disait même pas : la vente disparaissait simplement de la liste des sources.
--
-- La règle devient « une seule facture VIVANTE par source ». Le numéro annulé reste au dossier,
-- traçable, et la source redevient facturable. Rien n'est supprimé.
--
-- Les index sont recréés, pas modifiés : V22 est mergée et ne se touche pas.

DROP INDEX IF EXISTS ux_invoices_sale;
DROP INDEX IF EXISTS ux_invoices_delivery;

CREATE UNIQUE INDEX ux_invoices_sale_live
    ON invoices(sale_id)
    WHERE sale_id IS NOT NULL AND status <> 'CANCELLED';

CREATE UNIQUE INDEX ux_invoices_delivery_live
    ON invoices(delivery_id)
    WHERE delivery_id IS NOT NULL AND status <> 'CANCELLED';

-- Les recherches par source restent fréquentes (le service vérifie l'unicité avant d'émettre) et
-- ne peuvent plus s'appuyer sur les index uniques ci-dessus, qui ignorent les lignes annulées.
CREATE INDEX idx_invoices_sale ON invoices(sale_id) WHERE sale_id IS NOT NULL;
CREATE INDEX idx_invoices_delivery ON invoices(delivery_id) WHERE delivery_id IS NOT NULL;
