-- ChantierPilot — schéma de base
-- Postgres / Supabase. À exécuter dans l'éditeur SQL.
--
-- Principe : tout ce qui se passe pendant un appel atterrit ici.
-- Retell est un fournisseur remplaçable ; cette base est l'actif.

-- ---------------------------------------------------------------
-- Plombiers (les clients de ChantierPilot)
-- ---------------------------------------------------------------
create table if not exists plombiers (
  id                uuid primary key default gen_random_uuid(),
  nom               text not null,
  entreprise        text not null,
  email             text not null unique,
  telephone         text not null,          -- le numéro vers lequel on transfère
  ville             text not null,

  -- Zone d'intervention : liste de communes acceptées
  communes          text[] not null default '{}',

  -- Horaires de travail, au format "HH:MM-HH:MM" par jour (1 = lundi)
  horaires          jsonb not null default
                      '{"1":"08:00-18:00","2":"08:00-18:00","3":"08:00-18:00","4":"08:00-18:00","5":"08:00-18:00"}'::jsonb,

  -- Google Calendar : OAuth par plombier, il autorise lui-même
  google_refresh_token  text,
  google_calendar_id    text default 'primary',

  -- Retell
  retell_agent_id   text,
  numero_entrant    text,                   -- le numéro que ses clients appellent

  actif             boolean not null default true,
  cree_le           timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Appels : un enregistrement par appel reçu
-- ---------------------------------------------------------------
create table if not exists appels (
  id                uuid primary key default gen_random_uuid(),
  plombier_id       uuid not null references plombiers(id) on delete cascade,

  -- Identifiant côté Retell. UNIQUE : c'est la clé de l'idempotence.
  retell_call_id    text not null unique,

  numero_appelant   text,
  debut             timestamptz,
  fin               timestamptz,
  duree_s           integer,

  -- en_cours | termine | transfere | echec
  statut            text not null default 'en_cours',

  transcript        text,
  enregistrement_url text,
  resume            text,
  cout_usd          numeric(10,4),

  -- La charge utile brute, pour pouvoir tout reconstruire si besoin.
  brut              jsonb,

  cree_le           timestamptz not null default now()
);

create index if not exists appels_plombier_idx on appels(plombier_id, debut desc);

-- ---------------------------------------------------------------
-- Demandes : la fiche produite par l'appel
-- ---------------------------------------------------------------
create table if not exists demandes (
  id                uuid primary key default gen_random_uuid(),
  appel_id          uuid references appels(id) on delete set null,
  plombier_id       uuid not null references plombiers(id) on delete cascade,

  type_probleme     text,                   -- fuite, chauffe-eau, wc, robinetterie, autre
  description_client text,                  -- les mots du client, NON reformulés
  adresse           text,
  commune           text,
  dans_zone         boolean,

  -- haute | moyenne | basse
  urgence           text,
  duree_estimee_min integer,

  nom_client        text,
  telephone_client  text,
  locataire         boolean,

  questions_en_suspens text,

  -- nouvelle | rdv_pris | a_rappeler | hors_perimetre | traitee
  statut            text not null default 'nouvelle',

  cree_le           timestamptz not null default now()
);

create index if not exists demandes_plombier_idx on demandes(plombier_id, cree_le desc);
create index if not exists demandes_statut_idx on demandes(plombier_id, statut);

-- ---------------------------------------------------------------
-- Rendez-vous
-- ---------------------------------------------------------------
create table if not exists rendez_vous (
  id                uuid primary key default gen_random_uuid(),
  demande_id        uuid references demandes(id) on delete set null,
  plombier_id       uuid not null references plombiers(id) on delete cascade,

  debut             timestamptz not null,
  fin               timestamptz not null,

  google_event_id   text,

  -- confirme | annule | echec_creation
  statut            text not null default 'confirme',

  -- Trace explicite : le client a-t-il dit oui à voix haute ?
  confirme_par_client boolean not null default false,

  sms_envoye        boolean not null default false,
  cree_le           timestamptz not null default now()
);

create index if not exists rdv_plombier_idx on rendez_vous(plombier_id, debut);

-- ---------------------------------------------------------------
-- Événements webhook : la table qui empêche les doublons
-- ---------------------------------------------------------------
-- Retell peut livrer deux fois le même événement. Sans cette table,
-- on crée deux rendez-vous. La contrainte unique fait tout le travail.
create table if not exists evenements_webhook (
  id                uuid primary key default gen_random_uuid(),
  source            text not null default 'retell',
  evenement_id      text not null,
  type              text,
  recu_le           timestamptz not null default now(),
  traite            boolean not null default false,
  erreur            text,
  payload           jsonb,
  unique (source, evenement_id)
);

-- ---------------------------------------------------------------
-- Journal d'audit : qui a fait quoi, pour le RGPD et le débogage
-- ---------------------------------------------------------------
create table if not exists journal (
  id                bigserial primary key,
  plombier_id       uuid references plombiers(id) on delete set null,
  appel_id          uuid references appels(id) on delete set null,
  niveau            text not null default 'info',   -- info | avertissement | erreur
  action            text not null,
  detail            jsonb,
  cree_le           timestamptz not null default now()
);

create index if not exists journal_appel_idx on journal(appel_id, cree_le);
