-- ChantierPilot — migration 012 : les mentions du devis
--
-- Un devis d'artisan du bâtiment doit porter des mentions imposées
-- par le code de la consommation. Elles ne changent jamais d'un
-- devis à l'autre : elles appartiennent à l'entreprise, pas au
-- document. On les range donc ici, saisies une fois.
--
-- Rejouable.

alter table entreprises add column if not exists tva_intracom text;
alter table entreprises add column if not exists mediateur_nom text;
alter table entreprises add column if not exists mediateur_url text;
alter table entreprises add column if not exists conditions_paiement text;
alter table entreprises add column if not exists delai_execution_defaut text;

-- Un devis de dépannage est gratuit dans la grande majorité des cas,
-- mais s'il est payant la loi impose de l'annoncer AVANT de
-- l'établir. Le champ existe pour que ce soit un choix conscient.
alter table entreprises add column if not exists devis_payant_defaut boolean not null default false;
alter table entreprises add column if not exists prix_devis_ht numeric(10,2);

-- Valeurs de départ raisonnables, modifiables.
update entreprises
   set conditions_paiement = coalesce(conditions_paiement,
         'Paiement à réception de facture. Acompte de 30 % à la commande '
         || 'pour toute intervention supérieure à 1 000 € TTC.'),
       delai_execution_defaut = coalesce(delai_execution_defaut,
         'À convenir avec le client après acceptation du devis.');

-- Les nouvelles colonnes doivent être autorisées une par une : le
-- SELECT global sur entreprises est accordé, mais pas l'UPDATE.
grant update (nom, forme_juridique, siret, adresse, ville, telephone_public,
              email, site, logo_url, assurance_decennale, phrase_accueil,
              validation_mode, delai_reponse_min, delai_min_rdv_h,
              duree_defaut_min, creneaux_proposes, transfert_urgence,
              canal_notification, rayon_km,
              notif_sms_rdv, notif_email_soir, notif_alerte_rappel,
              notif_client_confirmation, notif_client_veille,
              tva_intracom, mediateur_nom, mediateur_url,
              conditions_paiement, delai_execution_defaut,
              devis_payant_defaut, prix_devis_ht)
  on entreprises to authenticated;

select nom, siret, tva_intracom, assurance_decennale, mediateur_nom
  from entreprises order by cree_le;
