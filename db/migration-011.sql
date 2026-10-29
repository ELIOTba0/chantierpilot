-- ChantierPilot — migration 011 : trois modes de prise de rendez-vous
--
-- Le réglage existait déjà en texte libre. On le contraint, et on
-- lui ajoute la troisième valeur : un assistant qui recueille la
-- demande sans jamais proposer de créneau. Certains plombiers
-- voudront commencer ainsi, le temps de se rassurer.
--
--   auto      l'assistant confirme seul les créneaux libres
--   manuelle  il propose, le plombier tranche
--   aucune    il ne propose rien, il transmet
--
-- Rejouable.

-- On remet d'abord d'éventuelles valeurs aberrantes dans le rang :
-- une contrainte posée sur des données fausses échoue, et on ne
-- veut pas d'une migration qui s'arrête au milieu.
update entreprises
   set validation_mode = 'manuelle'
 where validation_mode is null
    or validation_mode not in ('auto', 'manuelle', 'aucune');

alter table entreprises drop constraint if exists entreprises_validation_mode_check;
alter table entreprises
  add constraint entreprises_validation_mode_check
  check (validation_mode in ('auto', 'manuelle', 'aucune'));

-- Les statuts de demande et de rendez-vous valent la même rigueur.
-- Sans contrainte, une faute de frappe dans le code produit une
-- ligne invisible de tous les écrans, sans la moindre erreur.
update demandes set statut = 'nouvelle'
 where statut not in ('nouvelle', 'a_confirmer', 'a_rappeler', 'rdv_pris',
                      'refusee', 'hors_perimetre', 'traitee');

alter table demandes drop constraint if exists demandes_statut_check;
alter table demandes
  add constraint demandes_statut_check
  check (statut in ('nouvelle', 'a_confirmer', 'a_rappeler', 'rdv_pris',
                    'refusee', 'hors_perimetre', 'traitee'));

update rendez_vous set statut = 'confirme'
 where statut not in ('propose', 'confirme', 'annule', 'echec_creation');

alter table rendez_vous drop constraint if exists rendez_vous_statut_check;
alter table rendez_vous
  add constraint rendez_vous_statut_check
  check (statut in ('propose', 'confirme', 'annule', 'echec_creation'));

-- Un rendez-vous proposé attend une réponse : l'index sert à la
-- tâche qui, plus tard, libérera les créneaux restés sans décision.
create index if not exists rdv_proposes_idx on rendez_vous(debut)
  where statut = 'propose';

-- ---------------------------------------------------------------
-- Vérification
-- ---------------------------------------------------------------

select nom, validation_mode, delai_reponse_min, creneaux_proposes
  from entreprises order by cree_le;
