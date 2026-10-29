-- ChantierPilot — migrations 002 et 003, reconstituées
--
-- Le code utilise des tables et des colonnes qui ne figurent pas dans
-- schema.sql : entreprises, clients, notifications, plombiers.role,
-- demandes.client_id, rendez_vous.origine… Elles existent dans la
-- base Supabase de production, mais leurs migrations n'ont jamais été
-- versionnées. Sans elles, une base neuve ne démarre pas (migration
-- 004 échoue sur demandes.retell_call_id).
--
-- Ce fichier les reconstitue à partir de ce que le code lit et écrit.
-- Tout est en « if not exists » : sur la base de production, où ces
-- objets existent déjà, il ne change rien. Sur une base neuve, il
-- comble le trou entre schema.sql et migration-004.
--
-- Ordre d'exécution : schema.sql → ce fichier → migration-004.sql
--                     → migration-005-dashboard.sql

-- ---------------------------------------------------------------
-- Entreprises : le client de ChantierPilot est l'entreprise, qui
-- peut compter plusieurs plombiers (titulaire, salariés).
-- ---------------------------------------------------------------
create table if not exists entreprises (
  id                uuid primary key default gen_random_uuid(),
  nom               text not null,
  cree_le           timestamptz not null default now()
);

alter table plombiers
  add column if not exists entreprise_id uuid references entreprises(id) on delete restrict,
  -- Rôle dans l'entreprise (titulaire, technicien…), à ne pas confondre
  -- avec le rôle sur la plateforme (admin / user), voir migration 005.
  add column if not exists role          text not null default 'titulaire',
  add column if not exists couleur       text not null default '#0F6B62',
  add column if not exists recoit_rdv    boolean not null default true,
  -- Le compte Supabase Auth du plombier.
  add column if not exists auth_user_id  uuid unique;

create index if not exists plombiers_entreprise_idx on plombiers(entreprise_id);

-- ---------------------------------------------------------------
-- Clients : les particuliers qui appellent le plombier.
-- ---------------------------------------------------------------
create table if not exists clients (
  id                uuid primary key default gen_random_uuid(),
  entreprise_id     uuid not null references entreprises(id) on delete cascade,
  nom               text,
  telephone         text,
  adresse           text,
  commune           text,
  nb_demandes       integer not null default 0,
  premier_appel     timestamptz,
  notes             text,
  cree_le           timestamptz not null default now()
);

create index if not exists clients_entreprise_idx on clients(entreprise_id);
create index if not exists clients_telephone_idx on clients(entreprise_id, telephone);

-- ---------------------------------------------------------------
-- Demandes et rendez-vous : colonnes ajoutées après schema.sql
-- ---------------------------------------------------------------
alter table demandes
  add column if not exists retell_call_id     text,
  add column if not exists client_id          uuid references clients(id) on delete set null,
  add column if not exists assigne_a          uuid references plombiers(id) on delete set null,
  add column if not exists origine            text,
  add column if not exists adresse_verifiee   boolean,
  add column if not exists score_adresse      numeric(4,3),
  add column if not exists adresse_normalisee text;

create index if not exists demandes_retell_call_idx on demandes(retell_call_id);

alter table rendez_vous
  add column if not exists assigne_a          uuid references plombiers(id) on delete set null,
  add column if not exists cree_par           uuid references plombiers(id) on delete set null,
  -- assistant | manuel. Vide pour les rendez-vous créés par
  -- book-appointment avant l'ajout de la colonne : c'est l'assistant.
  add column if not exists origine            text,
  add column if not exists trajet_min         integer,
  add column if not exists termine_le         timestamptz,
  add column if not exists annule_le          timestamptz,
  add column if not exists motif_annulation   text;

-- ---------------------------------------------------------------
-- Notifications : la trace des messages à envoyer au client.
-- ---------------------------------------------------------------
create table if not exists notifications (
  id                uuid primary key default gen_random_uuid(),
  entreprise_id     uuid not null references entreprises(id) on delete cascade,
  demande_id        uuid references demandes(id) on delete set null,
  rendez_vous_id    uuid references rendez_vous(id) on delete set null,
  destinataire      text not null,            -- client | plombier
  adresse_dest      text,
  canal             text not null default 'interface',
  modele            text,
  contenu           text,
  statut            text not null default 'a_envoyer',
  cree_le           timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- plombier_courant() : l'écran d'erreur s'y réfère. On ne la crée que
-- si elle n'existe pas, pour ne pas remplacer celle de production.
-- ---------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'plombier_courant'
  ) then
    execute $f$
      create function public.plombier_courant() returns uuid
      language sql stable security definer set search_path = public as $b$
        select id from plombiers where auth_user_id = auth.uid() limit 1
      $b$
    $f$;
  end if;
end $$;
