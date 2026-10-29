-- ChantierPilot — tests des permissions et de l'isolation des données
--
-- À lancer sur une base de TEST, jamais sur la production : le script
-- crée des comptes, modifie des statuts et se termine par un rollback.
-- Voir db/tests/README.md ou `npm run test:db`.
--
-- Prérequis : migrations + seed-demo.sql. Chaque vérification est un
-- ASSERT : le script s'arrête à la première qui échoue.

\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

begin;

-- Trois identités : Julien (entreprise 1), Sophie (entreprise 2),
-- et un administrateur. Les e-mails des plombiers de démo sont
-- remplacés par ceux des comptes de test, comme le ferait un admin.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'julien@test.invalid'),
  ('00000000-0000-0000-0000-0000000000a3', 'sophie@test.invalid'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@test.invalid'),
  ('00000000-0000-0000-0000-0000000000ff', 'inconnu@test.invalid');

update plombiers set email = 'julien@test.invalid', auth_user_id = null
 where id = md5('demo-plombier-1')::uuid;
update plombiers set email = 'sophie@test.invalid', auth_user_id = null
 where id = md5('demo-plombier-3')::uuid;
insert into administrateurs (email, nom) values ('admin@test.invalid', 'Admin test');

create temp table ids as select
  md5('demo-entreprise-1')::uuid as e1,
  md5('demo-entreprise-2')::uuid as e2,
  md5('demo-plombier-1')::uuid   as p1,
  md5('demo-plombier-2')::uuid   as p2,
  md5('demo-plombier-3')::uuid   as p3;
grant select on ids to authenticated, anon;

-- ---------------------------------------------------------------
\echo '1. Visiteur non connecté'
set role anon;
do $$ begin perform set_config('request.jwt.claims', '', true); end $$;
do $$ begin
  assert (select count(*) from appels) = 0, 'anon ne doit voir aucun appel';
  assert (select count(*) from entreprises) = 0, 'anon ne doit voir aucune entreprise';
  begin
    perform cp_session();
    assert false, 'anon ne doit pas pouvoir appeler cp_session';
  exception when insufficient_privilege then null; end;
  raise notice 'OK  aucune donnée pour un visiteur';
end $$;
reset role;

-- ---------------------------------------------------------------
\echo '2. Plombier de l''entreprise 1 (Julien)'
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"julien@test.invalid","role":"authenticated"}', true); end $$;
set role authenticated;

do $$
declare s jsonb := cp_session(); i jsonb; total int; r record;
begin
  assert s ->> 'role' = 'user', 'Julien doit être user : ' || s::text;
  assert (s -> 'entreprise' ->> 'id')::uuid = (select e1 from ids), 'mauvaise entreprise';
  raise notice 'OK  connexion rattachée au plombier par e-mail, rôle user';

  assert (select count(distinct entreprise_id) from v_appels) = 1, 'fuite entre entreprises (appels)';
  assert (select count(*) from v_appels where entreprise_id <> (select e1 from ids)) = 0, 'fuite appels';
  assert (select count(*) from v_rendez_vous where entreprise_id <> (select e1 from ids)) = 0, 'fuite rdv';
  assert (select count(*) from v_rappels where entreprise_id <> (select e1 from ids)) = 0, 'fuite rappels';
  assert (select count(*) from clients where entreprise_id <> (select e1 from ids)) = 0, 'fuite clients';
  assert (select count(*) from entreprises) = 1, 'ne doit voir que son entreprise';
  assert (select count(*) from plombiers) = 2, 'doit voir ses 2 collègues (lui compris)';
  assert (select count(*) from administrateurs) = 0, 'ne doit pas voir les admins';
  assert (select count(*) from journal) = 0, 'ne doit pas lire le journal';
  raise notice 'OK  ne voit que les données de son entreprise';

  -- Les données des autres existent bien : lues en direct, elles
  -- sont simplement invisibles.
  assert (select count(*) from appels where plombier_id = (select p3 from ids)) = 0, 'appels de Sophie visibles';
  raise notice 'OK  les appels d''une autre entreprise sont invisibles';

  -- Indicateurs : calculés sur son seul périmètre.
  i := cp_indicateurs();
  select count(*) into total from v_appels where date_appel >= cp_debut_fenetre(7);
  assert (i ->> 'appels_7j')::int = total, 'indicateur appels_7j incohérent';
  assert (i ->> 'appels_7j')::int > 0, 'aucun appel récent dans le seed';
  raise notice 'OK  indicateurs : % appels, % RDV IA, % rappels, % traités',
    i ->> 'appels_7j', i ->> 'rdv_ia_7j', i ->> 'rappels_en_attente', i ->> 'appels_traites_7j';

  begin
    perform cp_indicateurs_plateforme();
    assert false, 'un plombier ne doit pas lire les indicateurs plateforme';
  exception when insufficient_privilege then null; end;
  begin
    perform admin_enregistrer_entreprise(null, 'Pirate', null, null, null, null, 'actif');
    assert false, 'un plombier ne doit pas créer d''entreprise';
  exception when insufficient_privilege then null; end;
  begin
    perform admin_definir_administrateur('julien@test.invalid', 'Julien', true);
    assert false, 'un plombier ne doit pas se nommer admin';
  exception when insufficient_privilege then null; end;
  raise notice 'OK  fonctions d''administration refusées';
end $$;

\echo '3. Rappels : marquer effectué, reporter, isolation'
do $$
declare
  r rappels%rowtype;
  avant int; apres int;
  autre uuid;
  dem uuid;
begin
  avant := (cp_indicateurs() ->> 'rappels_en_attente')::int;
  select * into r from rappels where statut = 'a_faire' and demande_id is not null limit 1;
  dem := r.demande_id;
  r := rappel_mettre_a_jour(r.id, 'effectue', null, 'Client rappelé (test)');
  assert r.statut = 'effectue' and r.effectue_le is not null, 'rappel non effectué';
  assert r.traite_par = auth.uid(), 'traite_par non renseigné';
  assert (select statut from demandes where id = dem) = 'traitee', 'demande non soldée';
  apres := (cp_indicateurs() ->> 'rappels_en_attente')::int;
  assert apres = avant - 1, format('indicateur non mis à jour (%s → %s)', avant, apres);
  raise notice 'OK  rappel marqué effectué, demande soldée, indicateur % → %', avant, apres;

  select * into r from rappels where statut = 'a_faire' limit 1;
  begin
    perform rappel_mettre_a_jour(r.id, 'reporte', now() - interval '1 hour', null);
    assert false, 'un report dans le passé doit être refusé';
  exception when invalid_parameter_value then null; end;
  r := rappel_mettre_a_jour(r.id, 'reporte', now() + interval '3 days', null);
  assert r.statut = 'reporte' and r.echeance > now() + interval '2 days', 'report non enregistré';
  begin
    perform rappel_mettre_a_jour(r.id, 'n_importe_quoi', null, null);
    assert false, 'statut invalide accepté';
  exception when invalid_parameter_value then null; end;
  raise notice 'OK  report validé (date future obligatoire, statut contrôlé)';

  -- Un rappel d'une autre entreprise : même réponse que s'il
  -- n'existait pas.
  reset role;
  select id into autre from rappels where plombier_id = (select p3 from ids) limit 1;
  set role authenticated;
  begin
    perform rappel_mettre_a_jour(autre, 'effectue', null, null);
    assert false, 'rappel d''une autre entreprise modifié !';
  exception when no_data_found then null; end;
  raise notice 'OK  impossible de modifier le rappel d''une autre entreprise';

  begin
    update rappels set statut = 'effectue';
    assert false, 'écriture directe sur rappels acceptée';
  exception when insufficient_privilege then null; end;
  raise notice 'OK  écriture directe sur rappels refusée';
end $$;

\echo '4. Rendez-vous et réglages'
do $$
declare rv rendez_vous%rowtype; autre uuid; n int;
begin
  select * into rv from rendez_vous where statut = 'propose' limit 1;
  if rv.id is not null then
    rv := rendez_vous_changer_statut(rv.id, 'confirmer');
    assert rv.statut = 'confirme', 'confirmation échouée';
    raise notice 'OK  RDV en attente confirmé';
  end if;
  select * into rv from rendez_vous where statut = 'confirme' and termine_le is null limit 1;
  rv := rendez_vous_changer_statut(rv.id, 'terminer');
  assert rv.termine_le is not null, 'terminer échoué';
  begin
    perform rendez_vous_changer_statut(rv.id, 'confirmer');
    assert false, 'transition invalide acceptée';
  exception when invalid_parameter_value then null; end;
  raise notice 'OK  RDV terminé, transitions invalides refusées';

  reset role;
  select id into autre from rendez_vous where plombier_id = (select p3 from ids) limit 1;
  set role authenticated;
  begin
    perform rendez_vous_changer_statut(autre, 'annuler');
    assert false, 'RDV d''une autre entreprise annulé !';
  exception when no_data_found then null; end;
  raise notice 'OK  impossible d''annuler le RDV d''une autre entreprise';

  update plombiers set horaires = '{"1":"09:00-17:00"}'::jsonb where id = (select p1 from ids);
  get diagnostics n = row_count;
  assert n = 1, 'Julien doit pouvoir régler ses horaires';
  update plombiers set horaires = '{}'::jsonb where id = (select p2 from ids);
  get diagnostics n = row_count;
  assert n = 0, 'Julien ne doit pas modifier les horaires d''un collègue';
  begin
    update plombiers set entreprise_id = (select e2 from ids) where id = (select p1 from ids);
    assert false, 'un plombier a pu changer d''entreprise';
  exception when insufficient_privilege then null; end;
  begin
    insert into demandes (plombier_id, statut) values ((select p3 from ids), 'nouvelle');
    assert false, 'demande créée pour une autre entreprise';
  exception when insufficient_privilege then null; end;
  raise notice 'OK  réglages limités à sa propre ligne, pas d''écriture chez les autres';
end $$;

\echo '5. Création automatique de rappel'
do $$
declare d uuid; n int;
begin
  insert into demandes (plombier_id, statut, nom_client, telephone_client, type_probleme, urgence)
  values ((select p1 from ids), 'nouvelle', 'Test Rappel', '01 99 00 00 00', 'fuite', 'haute')
  returning id into d;
  update demandes set statut = 'a_rappeler' where id = d;
  select count(*) into n from rappels where demande_id = d and statut = 'a_faire' and priorite = 'haute';
  assert n = 1, 'aucun rappel créé pour la demande à rappeler';
  update demandes set statut = 'a_rappeler', description_client = 'x' where id = d;
  select count(*) into n from rappels where demande_id = d;
  assert n = 1, 'rappel créé en double';
  raise notice 'OK  une demande « à rappeler » crée un rappel, sans doublon';
end $$;
reset role;

-- ---------------------------------------------------------------
\echo '6. Plombier de l''entreprise 2 (Sophie)'
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","email":"sophie@test.invalid","role":"authenticated"}', true); end $$;
set role authenticated;
do $$ begin
  assert cp_session() ->> 'role' = 'user', 'Sophie doit être user';
  assert (select count(*) from v_appels where entreprise_id = (select e1 from ids)) = 0,
         'Sophie voit les appels de l''entreprise 1';
  assert (select count(*) from v_rappels) > 0, 'Sophie ne voit pas ses rappels';
  assert (select count(*) from rendez_vous where plombier_id = (select p1 from ids)) = 0,
         'Sophie voit les RDV de Julien';
  raise notice 'OK  Sophie ne voit rien de l''entreprise 1';
end $$;
reset role;

-- ---------------------------------------------------------------
\echo '7. Compte inconnu et compte désactivé'
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000ff","email":"inconnu@test.invalid","role":"authenticated"}', true); end $$;
set role authenticated;
do $$ begin
  assert cp_session() ->> 'role' is null, 'un inconnu ne doit avoir aucun rôle';
  assert (select count(*) from appels) = 0, 'un inconnu voit des appels';
  raise notice 'OK  compte non rattaché : aucun rôle, aucune donnée';
end $$;
reset role;

update plombiers set actif = false where id = md5('demo-plombier-3')::uuid;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","email":"sophie@test.invalid","role":"authenticated"}', true); end $$;
set role authenticated;
do $$ begin
  assert cp_session() ->> 'role' is null, 'un plombier désactivé garde un rôle';
  assert (select count(*) from appels) = 0, 'un plombier désactivé voit encore des appels';
  raise notice 'OK  compte désactivé : accès coupé';
end $$;
reset role;
update plombiers set actif = true where id = md5('demo-plombier-3')::uuid;

-- ---------------------------------------------------------------
\echo '8. Administrateur'
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000ad","email":"admin@test.invalid","role":"authenticated"}', true); end $$;
set role authenticated;
do $$
declare s jsonb := cp_session(); i jsonb; e uuid; n int;
begin
  assert s ->> 'role' = 'admin', 'admin non reconnu : ' || s::text;
  select count(*) into n from appels;
  assert n = (select count(*) from v_appels), 'vue appels incohérente';
  assert (select count(distinct entreprise_id) from v_appels) >= 4, 'admin ne voit pas toutes les entreprises';
  raise notice 'OK  l''admin voit les % appels de toutes les entreprises', n;

  i := cp_indicateurs_plateforme();
  assert (i ->> 'entreprises_total')::int >= 4, 'indicateur entreprises';
  raise notice 'OK  indicateurs plateforme : % entreprises, % appels 7 j, % rappels en attente',
    i ->> 'entreprises_total', i ->> 'appels_7j', i ->> 'rappels_en_attente';

  -- Filtre par entreprise
  assert (cp_indicateurs((select e2 from ids)) ->> 'appels_7j')::int
       = (select count(*) from v_appels where entreprise_id = (select e2 from ids)
          and date_appel >= cp_debut_fenetre(7)), 'filtre entreprise incohérent';

  e := admin_enregistrer_entreprise(null, 'Nouvelle entreprise test', 'Contact', 'c@test.invalid',
                                    '01 99 00 99 99', 'Angers', 'essai');
  perform admin_enregistrer_entreprise(e, 'Nouvelle entreprise test', 'Contact', 'c@test.invalid',
                                       '01 99 00 99 99', 'Angers', 'resilie');
  assert (select statut from entreprises where id = e) = 'resilie', 'statut entreprise non modifié';
  begin
    perform admin_enregistrer_entreprise(null, '', null, null, null, null, 'actif');
    assert false, 'nom vide accepté';
  exception when invalid_parameter_value then null; end;
  begin
    perform admin_enregistrer_entreprise(null, 'X', null, 'pas-un-email', null, null, 'actif');
    assert false, 'e-mail invalide accepté';
  exception when invalid_parameter_value then null; end;
  raise notice 'OK  création et résiliation d''entreprise, validation des champs';

  perform admin_enregistrer_plombier(null, e, 'Nouveau plombier', 'nouveau@test.invalid',
                                     '01 99 00 99 98', 'titulaire', true);
  begin
    perform admin_enregistrer_plombier(null, e, 'Doublon', 'NOUVEAU@test.invalid',
                                       '01 99 00 99 97', 'titulaire', true);
    assert false, 'e-mail en double accepté';
  exception when unique_violation then null; end;
  raise notice 'OK  création de compte plombier, e-mail unique';

  perform admin_definir_administrateur('mael@test.invalid', 'Maël', true);
  perform admin_definir_administrateur('mathieu@test.invalid', 'Mathieu', true);
  assert (select count(*) from administrateurs where actif) = 3, 'admins non ajoutés';
  begin
    perform admin_definir_administrateur('admin@test.invalid', 'Admin test', false);
    assert false, 'un admin a pu retirer ses propres droits';
  exception when invalid_parameter_value then null; end;
  perform admin_definir_administrateur('mathieu@test.invalid', 'Mathieu', false);
  assert (select count(*) from administrateurs where actif) = 2, 'désactivation échouée';
  raise notice 'OK  gestion des administrateurs, sans auto-révocation';

  -- L'admin peut aussi agir sur les rappels de n'importe quelle entreprise.
  perform rappel_mettre_a_jour((select id from rappels where plombier_id = (select p3 from ids)
                                and statut in ('a_faire', 'reporte') limit 1), 'effectue', null, null);
  raise notice 'OK  l''admin peut traiter un rappel de n''importe quelle entreprise';
end $$;
reset role;

\echo 'Tous les tests sont passés.'
rollback;
