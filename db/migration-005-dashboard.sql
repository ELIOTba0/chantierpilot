-- ChantierPilot — migration 005 : tableau de bord plombier et administration
--
-- Ce que ce fichier ajoute :
--   1. les rôles de la plateforme : admin (table administrateurs) et
--      user (un plombier rattaché à son compte Supabase Auth) ;
--   2. la table rappels, avec un statut, une priorité et une échéance ;
--   3. le résultat de chaque appel et l'identification des appelants ;
--   4. les vues et les indicateurs lus par le tableau de bord ;
--   5. le RLS de toutes les tables : chaque plombier ne voit que son
--      entreprise, les administrateurs voient tout ;
--   6. les actions d'écriture sensibles, sous forme de fonctions qui
--      vérifient les droits et valident les données côté base.
--
-- Rejouable sans risque : chaque objet est créé « if not exists » ou
-- remplacé à l'identique. Les fonctions et politiques ajoutées portent
-- le préfixe cp_ pour ne jamais écraser un objet existant.
--
-- Prérequis : schema.sql, migration-002-003-reconstitution.sql,
-- migration-004.sql.

-- ===============================================================
-- 1. Colonnes complémentaires
-- ===============================================================

alter table entreprises
  add column if not exists contact_nom text,
  add column if not exists email       text,
  add column if not exists telephone   text,
  add column if not exists ville       text,
  -- essai | actif | suspendu | resilie. On ne supprime jamais une
  -- entreprise : on la passe en « resilie », son historique reste.
  add column if not exists statut      text not null default 'actif',
  -- Données de démonstration, fictives. Voir db/seed-demo.sql.
  add column if not exists demo        boolean not null default false,
  add column if not exists modifie_le  timestamptz not null default now();

do $$ begin
  alter table entreprises add constraint entreprises_statut_chk
    check (statut in ('essai', 'actif', 'suspendu', 'resilie'));
exception when duplicate_object then null; end $$;

alter table plombiers  add column if not exists modifie_le timestamptz not null default now();
alter table demandes   add column if not exists modifie_le timestamptz not null default now();
alter table rendez_vous add column if not exists modifie_le timestamptz not null default now();

alter table appels
  -- Ce que l'appelant a dit de lui : la fiche demande n'existe que
  -- si l'agent a pu aller jusqu'à la prise de rendez-vous.
  add column if not exists nom_appelant text,
  add column if not exists client_id    uuid references clients(id) on delete set null,
  add column if not exists motif        text,
  -- rdv_pris | a_rappeler | renseigne | hors_perimetre | sans_suite | transfere
  -- Vide tant que l'analyse de l'appel ne l'a pas établi.
  add column if not exists resultat     text,
  add column if not exists modifie_le   timestamptz not null default now();

do $$ begin
  alter table appels add constraint appels_resultat_chk
    check (resultat is null or resultat in
      ('rdv_pris', 'a_rappeler', 'renseigne', 'hors_perimetre', 'sans_suite', 'transfere'));
exception when duplicate_object then null; end $$;

create index if not exists appels_client_idx on appels(client_id);

-- ===============================================================
-- 2. Administrateurs de la plateforme
-- ===============================================================
-- Un administrateur est désigné par son adresse e-mail. Il se connecte
-- comme tout le monde, par code à usage unique : aucun mot de passe
-- n'est stocké ni codé en dur. Le premier administrateur s'ajoute à la
-- main dans l'éditeur SQL (voir README), les suivants depuis l'écran
-- Comptes.

create table if not exists administrateurs (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  nom           text not null,
  auth_user_id  uuid unique,
  actif         boolean not null default true,
  cree_le       timestamptz not null default now(),
  modifie_le    timestamptz not null default now()
);

create unique index if not exists administrateurs_email_idx on administrateurs (lower(email));

-- ===============================================================
-- 3. Rappels
-- ===============================================================

create table if not exists rappels (
  id            uuid primary key default gen_random_uuid(),
  plombier_id   uuid not null references plombiers(id) on delete cascade,
  appel_id      uuid references appels(id) on delete set null,
  demande_id    uuid references demandes(id) on delete set null,
  client_id     uuid references clients(id) on delete set null,

  nom_client    text,
  telephone     text,
  motif         text,                 -- type de problème, comme demandes.type_probleme
  raison        text not null,        -- pourquoi il faut rappeler

  priorite      text,                 -- haute | moyenne | basse, si connue
  -- a_faire | reporte | effectue | abandonne
  statut        text not null default 'a_faire',
  echeance      timestamptz,          -- à rappeler avant / à partir de
  note          text,

  effectue_le   timestamptz,
  traite_par    uuid,                 -- auth.users.id de qui a clos le rappel

  cree_le       timestamptz not null default now(),
  modifie_le    timestamptz not null default now(),

  constraint rappels_statut_chk
    check (statut in ('a_faire', 'reporte', 'effectue', 'abandonne')),
  constraint rappels_priorite_chk
    check (priorite is null or priorite in ('haute', 'moyenne', 'basse'))
);

create index if not exists rappels_plombier_idx on rappels(plombier_id, statut);
create index if not exists rappels_demande_idx on rappels(demande_id);
create index if not exists rappels_appel_idx on rappels(appel_id);

-- ===============================================================
-- 4. Horodatage des modifications
-- ===============================================================

create or replace function cp_toucher() returns trigger
language plpgsql as $$
begin
  new.modifie_le := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['entreprises', 'plombiers', 'appels', 'demandes',
                           'rendez_vous', 'rappels', 'administrateurs'] loop
    execute format('drop trigger if exists cp_toucher on %I', t);
    execute format('create trigger cp_toucher before update on %I
                    for each row execute function cp_toucher()', t);
  end loop;
end $$;

-- ===============================================================
-- 5. Qui est connecté, et que peut-il voir
-- ===============================================================
-- Fonctions « security definer » : elles lisent plombiers et
-- administrateurs sans passer par le RLS, ce qui évite que les
-- politiques ne s'appellent elles-mêmes en boucle.

create or replace function cp_est_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and exists (
    select 1 from administrateurs a
    where a.actif
      and (a.auth_user_id = auth.uid()
           or lower(a.email) = lower(auth.jwt() ->> 'email'))
  )
$$;

create or replace function cp_entreprise_courante() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select p.entreprise_id from plombiers p
  where auth.uid() is not null and p.auth_user_id = auth.uid() and p.actif
  limit 1
$$;

create or replace function cp_peut_voir_entreprise(e uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select cp_est_admin() or (e is not null and e = cp_entreprise_courante())
$$;

create or replace function cp_peut_voir_plombier(pl uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select cp_est_admin() or exists (
    select 1 from plombiers p
    where p.id = pl and p.entreprise_id = cp_entreprise_courante()
  )
$$;

-- Début de la fenêtre « N derniers jours », en jours calendaires de
-- Paris : aujourd'hui compte pour un jour, à partir de minuit.
create or replace function cp_debut_fenetre(p_jours integer default 7,
                                            p_fuseau text default 'Europe/Paris')
returns timestamptz
language sql stable as $$
  select (date_trunc('day', now() at time zone p_fuseau)
          - make_interval(days => greatest(p_jours, 1) - 1)) at time zone p_fuseau
$$;

-- ===============================================================
-- 6. Row Level Security
-- ===============================================================

alter table entreprises        enable row level security;
alter table plombiers          enable row level security;
alter table clients            enable row level security;
alter table appels             enable row level security;
alter table demandes           enable row level security;
alter table rendez_vous        enable row level security;
alter table notifications      enable row level security;
alter table rappels            enable row level security;
alter table administrateurs    enable row level security;
alter table journal            enable row level security;
alter table evenements_webhook enable row level security;

-- Entreprises : lecture seule pour les plombiers, écriture admin par
-- fonction (admin_enregistrer_entreprise).
drop policy if exists cp_lecture on entreprises;
create policy cp_lecture on entreprises for select to authenticated
  using (cp_peut_voir_entreprise(id));

-- Plombiers : on voit ses collègues ; on ne modifie que sa propre
-- ligne, et seulement les colonnes de réglage (voir les grants plus
-- bas : sans eux, un plombier pourrait changer d'entreprise).
drop policy if exists cp_lecture on plombiers;
create policy cp_lecture on plombiers for select to authenticated
  using (cp_peut_voir_plombier(id));
drop policy if exists cp_reglages on plombiers;
create policy cp_reglages on plombiers for update to authenticated
  using (auth_user_id = auth.uid() and actif)
  with check (auth_user_id = auth.uid());

revoke update on plombiers from anon, authenticated;
grant update (horaires, communes) on plombiers to authenticated;

-- Clients, demandes, rendez-vous, notifications : l'entreprise lit et
-- écrit les siens (ajout manuel de rendez-vous, fiche demande).
drop policy if exists cp_lecture on clients;
create policy cp_lecture on clients for select to authenticated
  using (cp_peut_voir_entreprise(entreprise_id));
drop policy if exists cp_ecriture on clients;
create policy cp_ecriture on clients for insert to authenticated
  with check (entreprise_id = cp_entreprise_courante());
drop policy if exists cp_modification on clients;
create policy cp_modification on clients for update to authenticated
  using (entreprise_id = cp_entreprise_courante())
  with check (entreprise_id = cp_entreprise_courante());

drop policy if exists cp_lecture on appels;
create policy cp_lecture on appels for select to authenticated
  using (cp_peut_voir_plombier(plombier_id));
-- Pas d'écriture : les appels n'arrivent que par le webhook Retell,
-- avec la clé service_role.

drop policy if exists cp_lecture on demandes;
create policy cp_lecture on demandes for select to authenticated
  using (cp_peut_voir_plombier(plombier_id));
drop policy if exists cp_ecriture on demandes;
create policy cp_ecriture on demandes for insert to authenticated
  with check (exists (select 1 from plombiers p where p.id = plombier_id
                      and p.entreprise_id = cp_entreprise_courante()));
drop policy if exists cp_modification on demandes;
create policy cp_modification on demandes for update to authenticated
  using (exists (select 1 from plombiers p where p.id = plombier_id
                 and p.entreprise_id = cp_entreprise_courante()))
  with check (exists (select 1 from plombiers p where p.id = plombier_id
                      and p.entreprise_id = cp_entreprise_courante()));

drop policy if exists cp_lecture on rendez_vous;
create policy cp_lecture on rendez_vous for select to authenticated
  using (cp_peut_voir_plombier(plombier_id));
drop policy if exists cp_ecriture on rendez_vous;
create policy cp_ecriture on rendez_vous for insert to authenticated
  with check (exists (select 1 from plombiers p where p.id = plombier_id
                      and p.entreprise_id = cp_entreprise_courante()));
drop policy if exists cp_modification on rendez_vous;
create policy cp_modification on rendez_vous for update to authenticated
  using (exists (select 1 from plombiers p where p.id = plombier_id
                 and p.entreprise_id = cp_entreprise_courante()))
  with check (exists (select 1 from plombiers p where p.id = plombier_id
                      and p.entreprise_id = cp_entreprise_courante()));

drop policy if exists cp_lecture on notifications;
create policy cp_lecture on notifications for select to authenticated
  using (cp_peut_voir_entreprise(entreprise_id));
drop policy if exists cp_ecriture on notifications;
create policy cp_ecriture on notifications for insert to authenticated
  with check (entreprise_id = cp_entreprise_courante());

-- Rappels : lecture directe, écriture uniquement par
-- rappel_mettre_a_jour(), qui valide les transitions.
drop policy if exists cp_lecture on rappels;
create policy cp_lecture on rappels for select to authenticated
  using (cp_peut_voir_plombier(plombier_id));
revoke insert, update, delete on rappels from anon, authenticated;

-- Tables réservées à l'administration.
drop policy if exists cp_lecture on administrateurs;
create policy cp_lecture on administrateurs for select to authenticated
  using (cp_est_admin());
revoke insert, update, delete on administrateurs from anon, authenticated;

drop policy if exists cp_lecture on journal;
create policy cp_lecture on journal for select to authenticated
  using (cp_est_admin());

drop policy if exists cp_lecture on evenements_webhook;
create policy cp_lecture on evenements_webhook for select to authenticated
  using (cp_est_admin());

-- ===============================================================
-- 7. Rappels créés automatiquement
-- ===============================================================
-- Quand une demande passe « à rappeler » (agenda injoignable, hors
-- créneau…), un rappel est créé s'il n'y en a pas déjà un ouvert.
-- Quand elle est traitée ou transformée en rendez-vous, les rappels
-- encore ouverts sont clos. Les endpoints Retell n'ont rien à savoir.

create or replace function cp_demande_vers_rappel() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Le seed de démonstration crée ses rappels lui-même.
  if current_setting('cp.seed', true) = 'on' then
    return new;
  end if;

  if new.statut = 'a_rappeler'
     and (tg_op = 'INSERT' or old.statut is distinct from new.statut)
     and not exists (select 1 from rappels r where r.demande_id = new.id
                     and r.statut in ('a_faire', 'reporte')) then
    insert into rappels (plombier_id, appel_id, demande_id, client_id,
                         nom_client, telephone, motif, raison, priorite)
    values (coalesce(new.assigne_a, new.plombier_id), new.appel_id, new.id,
            new.client_id, new.nom_client, new.telephone_client,
            new.type_probleme,
            coalesce(nullif(new.questions_en_suspens, ''),
                     'Aucun rendez-vous n''a pu être réservé pendant l''appel.'),
            new.urgence);
  end if;

  if tg_op = 'UPDATE' and new.statut in ('traitee', 'rdv_pris')
     and old.statut is distinct from new.statut then
    update rappels
       set statut = 'effectue', effectue_le = now(), traite_par = auth.uid(),
           note = coalesce(note || E'\n', '')
                  || 'Clos automatiquement : demande passée « '
                  || case new.statut when 'traitee' then 'traitée' else 'RDV pris' end || ' ».'
     where demande_id = new.id and statut in ('a_faire', 'reporte');
  end if;

  -- Le webhook de fin d'appel rattache la demande à son appel après
  -- coup : le rappel suit.
  if tg_op = 'UPDATE' and new.appel_id is not null
     and old.appel_id is distinct from new.appel_id then
    update rappels set appel_id = new.appel_id
     where demande_id = new.id and appel_id is null;
  end if;

  return new;
end $$;

drop trigger if exists cp_demande_vers_rappel on demandes;
create trigger cp_demande_vers_rappel after insert or update on demandes
  for each row execute function cp_demande_vers_rappel();

-- ===============================================================
-- 8. Vues lues par le tableau de bord
-- ===============================================================
-- security_invoker : la vue applique le RLS de la personne connectée.
-- Un plombier qui interroge v_appels n'y voit que son entreprise.

create or replace view v_appels with (security_invoker = true) as
select
  a.id,
  a.plombier_id,
  p.entreprise_id,
  e.nom                                   as entreprise_nom,
  coalesce(e.demo, false)                 as demo,
  p.nom                                   as plombier_nom,
  coalesce(a.debut, a.cree_le)            as date_appel,
  a.fin,
  a.duree_s,
  a.statut,
  a.numero_appelant,
  coalesce(nullif(a.nom_appelant, ''), d.nom_client, c.nom) as nom_appelant,
  coalesce(nullif(a.motif, ''), d.type_probleme)            as motif,
  a.resume,
  coalesce(a.resultat,
           case d.statut
             when 'rdv_pris'       then 'rdv_pris'
             when 'a_rappeler'     then 'a_rappeler'
             when 'hors_perimetre' then 'hors_perimetre'
           end,
           case when a.statut = 'transfere' then 'transfere' end) as resultat,
  -- Ce qu'il reste à faire, indépendamment du résultat de l'appel.
  case
    when a.statut = 'en_cours'  then 'en_cours'
    when r.ouverts > 0          then 'a_rappeler'
    when a.statut = 'echec'     then 'echec'
    else 'traite'
  end                                     as traitement,
  coalesce(r.ouverts, 0)                  as rappels_ouverts,
  d.id                                    as demande_id,
  d.urgence,
  a.client_id
from appels a
join plombiers p           on p.id = a.plombier_id
left join entreprises e    on e.id = p.entreprise_id
left join clients c        on c.id = a.client_id
left join lateral (
  select dd.* from demandes dd where dd.appel_id = a.id
  order by dd.cree_le desc limit 1
) d on true
left join lateral (
  select count(*)::int as ouverts from rappels rr
  where rr.statut in ('a_faire', 'reporte')
    and (rr.appel_id = a.id or (d.id is not null and rr.demande_id = d.id))
) r on true;

create or replace view v_rendez_vous with (security_invoker = true) as
select
  rv.id,
  rv.plombier_id,
  p.entreprise_id,
  e.nom                                   as entreprise_nom,
  coalesce(e.demo, false)                 as demo,
  coalesce(pa.nom, p.nom)                 as plombier_nom,
  rv.debut,
  rv.fin,
  rv.statut,
  -- Statut lisible. « confirme » n'est affiché que si la base le dit ;
  -- tout statut inconnu retombe sur « en attente », jamais sur
  -- « confirmé ».
  case
    when rv.termine_le is not null       then 'termine'
    when rv.statut = 'annule'            then 'annule'
    when rv.statut = 'echec_creation'    then 'echec'
    when rv.statut = 'confirme'          then 'confirme'
    else 'en_attente'
  end                                     as statut_affiche,
  coalesce(rv.origine, 'assistant') <> 'manuel' as par_ia,
  rv.origine,
  rv.confirme_par_client,
  rv.google_event_id is not null          as dans_agenda,
  rv.termine_le,
  rv.annule_le,
  rv.motif_annulation,
  rv.cree_le,
  d.id                                    as demande_id,
  d.appel_id,
  d.nom_client,
  d.telephone_client,
  d.type_probleme,
  d.description_client,
  d.adresse,
  d.commune,
  d.urgence
from rendez_vous rv
join plombiers p           on p.id = rv.plombier_id
left join plombiers pa     on pa.id = rv.assigne_a
left join entreprises e    on e.id = p.entreprise_id
left join demandes d       on d.id = rv.demande_id;

create or replace view v_rappels with (security_invoker = true) as
select
  r.*,
  p.entreprise_id,
  e.nom                                   as entreprise_nom,
  coalesce(e.demo, false)                 as demo,
  p.nom                                   as plombier_nom,
  coalesce(a.debut, a.cree_le, d.cree_le, r.cree_le) as date_appel,
  r.statut in ('a_faire', 'reporte')      as ouvert,
  r.statut in ('a_faire', 'reporte') and r.echeance is not null
    and r.echeance < now()                as en_retard
from rappels r
join plombiers p           on p.id = r.plombier_id
left join entreprises e    on e.id = p.entreprise_id
left join appels a         on a.id = r.appel_id
left join demandes d       on d.id = r.demande_id;

create or replace view v_entreprises with (security_invoker = true) as
select
  e.*,
  t.nom                                   as titulaire_nom,
  (select count(*) from plombiers p where p.entreprise_id = e.id)::int as nb_plombiers,
  (select count(*) from appels a join plombiers p on p.id = a.plombier_id
    where p.entreprise_id = e.id)::int    as nb_appels,
  (select count(*) from appels a join plombiers p on p.id = a.plombier_id
    where p.entreprise_id = e.id
      and coalesce(a.debut, a.cree_le) >= cp_debut_fenetre(7))::int as nb_appels_7j,
  (select count(*) from rendez_vous rv join plombiers p on p.id = rv.plombier_id
    where p.entreprise_id = e.id and rv.statut <> 'echec_creation')::int as nb_rdv,
  (select count(*) from rappels r join plombiers p on p.id = r.plombier_id
    where p.entreprise_id = e.id and r.statut in ('a_faire', 'reporte'))::int as nb_rappels_ouverts,
  (select max(coalesce(a.debut, a.cree_le)) from appels a join plombiers p on p.id = a.plombier_id
    where p.entreprise_id = e.id)         as dernier_appel
from entreprises e
left join lateral (
  select p.nom from plombiers p where p.entreprise_id = e.id
  order by (p.role = 'titulaire') desc, p.cree_le limit 1
) t on true;

-- ===============================================================
-- 9. Indicateurs
-- ===============================================================
-- Calculés en base, à partir des mêmes vues que les listes : le
-- chiffre affiché et la liste derrière ne peuvent pas diverger.
-- security invoker : le RLS restreint le périmètre tout seul.

create or replace function cp_indicateurs(p_entreprise uuid default null)
returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  with f as (select cp_debut_fenetre(7) as debut)
  select jsonb_build_object(
    'depuis', (select debut from f),
    'appels_7j', (select count(*) from v_appels, f
                  where date_appel >= f.debut
                    and (p_entreprise is null or entreprise_id = p_entreprise)),
    'appels_traites_7j', (select count(*) from v_appels, f
                  where date_appel >= f.debut and traitement = 'traite'
                    and (p_entreprise is null or entreprise_id = p_entreprise)),
    'rdv_ia_7j', (select count(*) from v_rendez_vous, f
                  where cree_le >= f.debut and par_ia and statut_affiche <> 'echec'
                    and (p_entreprise is null or entreprise_id = p_entreprise)),
    'rdv_a_venir', (select count(*) from v_rendez_vous
                  where debut >= now() and statut_affiche in ('confirme', 'en_attente')
                    and (p_entreprise is null or entreprise_id = p_entreprise)),
    'rappels_en_attente', (select count(*) from v_rappels
                  where ouvert
                    and (p_entreprise is null or entreprise_id = p_entreprise)),
    'rappels_en_retard', (select count(*) from v_rappels
                  where en_retard
                    and (p_entreprise is null or entreprise_id = p_entreprise)),
    'rappels_priorite_haute', (select count(*) from v_rappels
                  where ouvert and priorite = 'haute'
                    and (p_entreprise is null or entreprise_id = p_entreprise))
  )
$$;

-- Vue d'ensemble de la plateforme. Refuse tout autre qu'un admin,
-- plutôt que de renvoyer des zéros trompeurs.
create or replace function cp_indicateurs_plateforme()
returns jsonb
language plpgsql stable security invoker set search_path = public, pg_temp as $$
begin
  if not cp_est_admin() then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;

  return cp_indicateurs(null) || jsonb_build_object(
    'entreprises_total',   (select count(*) from entreprises where statut <> 'resilie'),
    'entreprises_actives', (select count(*) from entreprises where statut in ('actif', 'essai')),
    'entreprises_suspendues', (select count(*) from entreprises where statut = 'suspendu'),
    'plombiers_actifs',    (select count(*) from plombiers where actif),
    'entreprises_sans_appel_7j', (select count(*) from v_entreprises
                                  where statut in ('actif', 'essai') and nb_appels_7j = 0),
    'webhooks_en_erreur_7j', (select count(*) from evenements_webhook
                              where erreur is not null and recu_le >= cp_debut_fenetre(7)),
    'plombiers_sans_compte', (select count(*) from plombiers
                              where actif and auth_user_id is null)
  );
end $$;

-- ===============================================================
-- 10. Session : qui est connecté ?
-- ===============================================================
-- Appelée juste après la connexion. Rattache le compte Supabase Auth
-- au plombier ou à l'administrateur qui porte la même adresse e-mail
-- (adresse prouvée par le code reçu), puis décrit l'espace auquel la
-- personne a droit.

create or replace function cp_session()
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  uid   uuid := auth.uid();
  mail  text := lower(auth.jwt() ->> 'email');
  pl    plombiers%rowtype;
  ent   entreprises%rowtype;
  adm   administrateurs%rowtype;
begin
  if uid is null then
    return jsonb_build_object('role', null);
  end if;

  if mail is not null then
    update administrateurs set auth_user_id = uid
     where lower(email) = mail and auth_user_id is null;
    update plombiers set auth_user_id = uid
     where lower(email) = mail and auth_user_id is null
       and not exists (select 1 from plombiers x where x.auth_user_id = uid);
  end if;

  select * into adm from administrateurs where auth_user_id = uid and actif;
  select * into pl from plombiers where auth_user_id = uid and actif;
  if pl.id is not null then
    select * into ent from entreprises where id = pl.entreprise_id;
  end if;

  return jsonb_build_object(
    'role', case when adm.id is not null then 'admin'
                 when pl.id is not null then 'user' end,
    'email', mail,
    'admin', case when adm.id is null then null
                  else jsonb_build_object('id', adm.id, 'nom', adm.nom) end,
    'plombier', case when pl.id is null then null
                     else jsonb_build_object('id', pl.id, 'nom', pl.nom, 'role', pl.role) end,
    'entreprise', case when ent.id is null then null
                       else jsonb_build_object('id', ent.id, 'nom', ent.nom,
                                               'statut', ent.statut, 'demo', ent.demo) end
  );
end $$;

-- ===============================================================
-- 11. Actions du plombier
-- ===============================================================

create or replace function rappel_mettre_a_jour(
  p_id        uuid,
  p_statut    text,
  p_echeance  timestamptz default null,
  p_note      text default null
) returns rappels
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  r rappels%rowtype;
begin
  select * into r from rappels where id = p_id for update;
  -- Même message qu'il n'existe pas ou qu'il appartienne à un autre :
  -- on ne révèle pas l'existence des données d'une autre entreprise.
  if r.id is null or not cp_peut_voir_plombier(r.plombier_id) then
    raise exception 'Rappel introuvable' using errcode = 'P0002';
  end if;

  if p_statut not in ('a_faire', 'reporte', 'effectue', 'abandonne') then
    raise exception 'Statut de rappel invalide' using errcode = '22023';
  end if;
  if p_statut = 'reporte' and (p_echeance is null or p_echeance <= now()) then
    raise exception 'Un report demande une date future' using errcode = '22023';
  end if;
  if p_note is not null and length(p_note) > 2000 then
    raise exception 'Note trop longue (2000 caractères au plus)' using errcode = '22023';
  end if;

  update rappels set
    statut      = p_statut,
    echeance    = case when p_statut = 'reporte' then p_echeance else echeance end,
    effectue_le = case when p_statut in ('effectue', 'abandonne') then now() else null end,
    traite_par  = case when p_statut in ('effectue', 'abandonne') then auth.uid() else null end,
    note        = coalesce(nullif(trim(p_note), ''), note)
  where id = p_id
  returning * into r;

  -- Le rappel effectué solde la demande qui l'avait déclenché.
  if p_statut = 'effectue' and r.demande_id is not null then
    update demandes set statut = 'traitee'
     where id = r.demande_id and statut = 'a_rappeler';
  end if;

  insert into journal (plombier_id, appel_id, action, detail)
  values (r.plombier_id, r.appel_id, 'rappel_' || p_statut,
          jsonb_build_object('rappel_id', r.id, 'par', auth.uid(),
                             'echeance', r.echeance));
  return r;
end $$;

create or replace function rendez_vous_changer_statut(
  p_id      uuid,
  p_action  text,
  p_motif   text default null
) returns rendez_vous
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  rv rendez_vous%rowtype;
begin
  select * into rv from rendez_vous where id = p_id for update;
  if rv.id is null or not cp_peut_voir_plombier(rv.plombier_id) then
    raise exception 'Rendez-vous introuvable' using errcode = 'P0002';
  end if;
  if p_motif is not null and length(p_motif) > 500 then
    raise exception 'Motif trop long (500 caractères au plus)' using errcode = '22023';
  end if;

  if p_action = 'confirmer' then
    if rv.statut <> 'propose' then
      raise exception 'Seul un rendez-vous en attente peut être confirmé' using errcode = '22023';
    end if;
    update rendez_vous set statut = 'confirme' where id = p_id returning * into rv;

  elsif p_action = 'terminer' then
    if rv.statut <> 'confirme' or rv.termine_le is not null then
      raise exception 'Seul un rendez-vous confirmé et non terminé peut être terminé' using errcode = '22023';
    end if;
    update rendez_vous set termine_le = now() where id = p_id returning * into rv;
    update demandes set statut = 'traitee' where id = rv.demande_id and statut <> 'traitee';

  elsif p_action = 'annuler' then
    if rv.statut not in ('propose', 'confirme') or rv.termine_le is not null then
      raise exception 'Ce rendez-vous ne peut plus être annulé' using errcode = '22023';
    end if;
    update rendez_vous
       set statut = 'annule', annule_le = now(),
           motif_annulation = coalesce(nullif(trim(p_motif), ''), 'Annulé depuis le tableau de bord')
     where id = p_id returning * into rv;

  else
    raise exception 'Action inconnue' using errcode = '22023';
  end if;

  insert into journal (plombier_id, action, detail)
  values (rv.plombier_id, 'rendez_vous_' || p_action,
          jsonb_build_object('rendez_vous_id', rv.id, 'par', auth.uid()));
  return rv;
end $$;

-- ===============================================================
-- 12. Actions d'administration
-- ===============================================================

create or replace function cp_exiger_admin() returns void
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not cp_est_admin() then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
end $$;

create or replace function cp_email_valide(v text) returns boolean
language sql immutable as $$
  select v ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(v) <= 254
$$;

-- Crée (p_id null) ou met à jour une entreprise.
create or replace function admin_enregistrer_entreprise(
  p_id          uuid,
  p_nom         text,
  p_contact_nom text,
  p_email       text,
  p_telephone   text,
  p_ville       text,
  p_statut      text
) returns uuid
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
begin
  perform cp_exiger_admin();

  if coalesce(trim(p_nom), '') = '' or length(p_nom) > 200 then
    raise exception 'Nom d''entreprise obligatoire (200 caractères au plus)' using errcode = '22023';
  end if;
  if nullif(trim(p_email), '') is not null and not cp_email_valide(trim(p_email)) then
    raise exception 'Adresse e-mail invalide' using errcode = '22023';
  end if;
  if p_statut not in ('essai', 'actif', 'suspendu', 'resilie') then
    raise exception 'Statut d''entreprise invalide' using errcode = '22023';
  end if;

  if p_id is null then
    insert into entreprises (nom, contact_nom, email, telephone, ville, statut)
    values (trim(p_nom), nullif(trim(p_contact_nom), ''), nullif(lower(trim(p_email)), ''),
            nullif(trim(p_telephone), ''), nullif(trim(p_ville), ''), p_statut)
    returning id into v_id;
  else
    update entreprises set
      nom = trim(p_nom),
      contact_nom = nullif(trim(p_contact_nom), ''),
      email = nullif(lower(trim(p_email)), ''),
      telephone = nullif(trim(p_telephone), ''),
      ville = nullif(trim(p_ville), ''),
      statut = p_statut
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Entreprise introuvable' using errcode = 'P0002';
    end if;
  end if;

  insert into journal (action, detail)
  values (case when p_id is null then 'admin_entreprise_creee' else 'admin_entreprise_modifiee' end,
          jsonb_build_object('entreprise_id', v_id, 'statut', p_statut, 'par', auth.uid()));
  return v_id;
end $$;

-- Crée (p_id null) ou met à jour le compte d'un plombier. Désactiver
-- (p_actif = false) coupe son accès au tableau de bord sans rien
-- effacer de son historique.
create or replace function admin_enregistrer_plombier(
  p_id            uuid,
  p_entreprise_id uuid,
  p_nom           text,
  p_email         text,
  p_telephone     text,
  p_role          text,
  p_actif         boolean
) returns uuid
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_id   uuid;
  v_ent  entreprises%rowtype;
  v_mail text := lower(trim(p_email));
  v_ancien text;
begin
  perform cp_exiger_admin();

  select * into v_ent from entreprises where id = p_entreprise_id;
  if v_ent.id is null then
    raise exception 'Entreprise introuvable' using errcode = 'P0002';
  end if;
  if coalesce(trim(p_nom), '') = '' or length(p_nom) > 200 then
    raise exception 'Nom obligatoire (200 caractères au plus)' using errcode = '22023';
  end if;
  if not cp_email_valide(v_mail) then
    raise exception 'Adresse e-mail invalide' using errcode = '22023';
  end if;
  if coalesce(trim(p_telephone), '') = '' then
    raise exception 'Téléphone obligatoire' using errcode = '22023';
  end if;
  if p_role not in ('titulaire', 'technicien', 'secretariat') then
    raise exception 'Rôle invalide' using errcode = '22023';
  end if;
  if exists (select 1 from plombiers where lower(email) = v_mail
             and (p_id is null or id <> p_id)) then
    raise exception 'Cette adresse e-mail est déjà utilisée' using errcode = '23505';
  end if;

  if p_id is null then
    insert into plombiers (entreprise_id, nom, entreprise, email, telephone, ville, role, actif)
    values (v_ent.id, trim(p_nom), v_ent.nom, v_mail, trim(p_telephone),
            coalesce(v_ent.ville, ''), p_role, coalesce(p_actif, true))
    returning id into v_id;
  else
    select lower(email) into v_ancien from plombiers where id = p_id;
    update plombiers set
      entreprise_id = v_ent.id,
      entreprise = v_ent.nom,
      nom = trim(p_nom),
      email = v_mail,
      telephone = trim(p_telephone),
      role = p_role,
      actif = coalesce(p_actif, actif),
      -- Nouvelle adresse : l'ancien compte de connexion ne vaut plus.
      auth_user_id = case when v_ancien is distinct from v_mail then null else auth_user_id end
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Plombier introuvable' using errcode = 'P0002';
    end if;
  end if;

  insert into journal (plombier_id, action, detail)
  values (v_id, case when p_id is null then 'admin_plombier_cree' else 'admin_plombier_modifie' end,
          jsonb_build_object('actif', p_actif, 'par', auth.uid()));
  return v_id;
end $$;

-- Ajoute un administrateur, ou l'active / le désactive. Garde-fous :
-- on ne se retire pas soi-même, et il reste toujours un admin actif.
create or replace function admin_definir_administrateur(
  p_email text,
  p_nom   text,
  p_actif boolean
) returns uuid
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_mail text := lower(trim(p_email));
  v_id   uuid;
begin
  perform cp_exiger_admin();

  if not cp_email_valide(v_mail) then
    raise exception 'Adresse e-mail invalide' using errcode = '22023';
  end if;

  if not p_actif then
    if v_mail = lower(auth.jwt() ->> 'email') then
      raise exception 'Vous ne pouvez pas retirer vos propres droits' using errcode = '22023';
    end if;
    if (select count(*) from administrateurs where actif and lower(email) <> v_mail) = 0 then
      raise exception 'Il doit rester au moins un administrateur actif' using errcode = '22023';
    end if;
  end if;

  insert into administrateurs (email, nom, actif)
  values (v_mail, coalesce(nullif(trim(p_nom), ''), v_mail), p_actif)
  on conflict (lower(email)) do update
    set actif = excluded.actif,
        nom = coalesce(nullif(trim(p_nom), ''), administrateurs.nom)
  returning id into v_id;

  insert into journal (action, detail)
  values ('admin_administrateur_' || case when p_actif then 'active' else 'desactive' end,
          jsonb_build_object('administrateur_id', v_id, 'par', auth.uid()));
  return v_id;
end $$;

-- ===============================================================
-- 13. Droits d'exécution
-- ===============================================================
-- Aucune fonction n'est appelable sans être connecté.

revoke execute on function
  cp_session(),
  cp_indicateurs(uuid),
  cp_indicateurs_plateforme(),
  rappel_mettre_a_jour(uuid, text, timestamptz, text),
  rendez_vous_changer_statut(uuid, text, text),
  admin_enregistrer_entreprise(uuid, text, text, text, text, text, text),
  admin_enregistrer_plombier(uuid, uuid, text, text, text, text, boolean),
  admin_definir_administrateur(text, text, boolean)
from public, anon;

grant execute on function
  cp_session(),
  cp_indicateurs(uuid),
  cp_indicateurs_plateforme(),
  rappel_mettre_a_jour(uuid, text, timestamptz, text),
  rendez_vous_changer_statut(uuid, text, text),
  admin_enregistrer_entreprise(uuid, text, text, text, text, text, text),
  admin_enregistrer_plombier(uuid, uuid, text, text, text, text, boolean),
  admin_definir_administrateur(text, text, boolean)
to authenticated;
