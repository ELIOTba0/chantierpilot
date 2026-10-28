-- ChantierPilot — migration 004
-- Coordonnées des interventions, pour afficher la carte.
--
-- Elles viennent de la Base Adresse Nationale au moment de la
-- réservation. L'agent n'a pas à les transporter : le backend
-- géocode lui-même l'adresse qu'il vient d'enregistrer.

alter table demandes
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision;

-- Les colonnes lisibles depuis le navigateur par l'artisan.
grant select (
  id, appel_id, plombier_id, type_probleme, description_client,
  adresse, commune, dans_zone, urgence, duree_estimee_min,
  nom_client, telephone_client, locataire, questions_en_suspens,
  statut, cree_le, retell_call_id, latitude, longitude
) on demandes to authenticated;
