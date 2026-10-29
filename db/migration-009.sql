-- ChantierPilot — migration 009 : séparer l'éditeur de ses clients
--
-- Jusqu'ici, l'équipe ChantierPilot était rangée dans « plombiers »,
-- c'est-à-dire parmi les salariés d'une entreprise cliente. Ça tient
-- tant qu'on est entre soi sur une base de démonstration. Le jour où
-- un artisan se connecte, il voit des gens qui ne travaillent pas
-- chez lui — et l'équipe, elle, ne peut rien voir des autres clients.
--
-- Le modèle correct distingue deux natures de compte :
--   administrateurs  l'éditeur du logiciel, qui voit tous ses clients
--   plombiers        les artisans, qui ne voient que leur entreprise
--
-- L'astuce qui évite de réécrire les quinze politiques existantes :
-- entreprise_courante() répond désormais « l'entreprise que
-- l'administrateur consulte » quand c'en est un, et « mon
-- entreprise » quand c'est un artisan. Les politiques ne changent
-- pas d'un caractère.
--
-- Rejouable.

-- ---------------------------------------------------------------
-- 1. L'équipe ChantierPilot
-- ---------------------------------------------------------------

create table if not exists administrateurs (
  id             uuid primary key default gen_random_uuid(),
  auth_user_id   uuid unique references auth.users(id) on delete cascade,

  nom            text not null,
  email          text not null unique,

  -- fondateur | support | lecture
  role           text not null default 'fondateur',

  -- L'entreprise cliente actuellement consultée. C'est ce champ qui
  -- décide ce que l'administrateur voit dans toute l'interface.
  entreprise_active uuid references entreprises(id) on delete set null,

  actif          boolean not null default true,
  cree_le        timestamptz not null default now()
);

create index if not exists administrateurs_auth_idx on administrateurs(auth_user_id);

-- ---------------------------------------------------------------
-- 2. Les deux fonctions de contexte
-- ---------------------------------------------------------------

create or replace function est_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from administrateurs
     where auth_user_id = auth.uid() and actif
  );
$$;

-- Redéfinition : un administrateur prend le contexte de l'entreprise
-- qu'il consulte ; un artisan garde la sienne. Les politiques
-- écrites en migration 006 et durcies en 008 restent valables.
create or replace function entreprise_courante() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select entreprise_active from administrateurs
      where auth_user_id = auth.uid() and actif limit 1),
    (select entreprise_id from plombiers
      where auth_user_id = auth.uid() limit 1)
  );
$$;

revoke execute on function est_admin() from anon;
revoke execute on function entreprise_courante() from anon;
grant execute on function est_admin() to authenticated;

-- ---------------------------------------------------------------
-- 3. Qui voit quoi
-- ---------------------------------------------------------------

alter table administrateurs enable row level security;

-- Un administrateur voit sa propre fiche, et elle seule. Personne
-- d'autre ne voit cette table : un artisan n'a pas à savoir
-- qui édite le logiciel.
drop policy if exists "admin voit sa fiche" on administrateurs;
create policy "admin voit sa fiche" on administrateurs
  for select to authenticated using (auth_user_id = (select auth.uid()));

-- Il change l'entreprise qu'il consulte.
drop policy if exists "admin change d'entreprise" on administrateurs;
create policy "admin change d'entreprise" on administrateurs
  for update to authenticated using (auth_user_id = (select auth.uid()));

-- Pour choisir une entreprise, encore faut-il pouvoir les lister.
-- Cette politique s'ajoute à « equipe voit son entreprise » : un
-- artisan ne gagne rien, un administrateur voit tous les clients.
drop policy if exists "admin voit toutes les entreprises" on entreprises;
create policy "admin voit toutes les entreprises" on entreprises
  for select to authenticated using ((select est_admin()));

grant select on administrateurs to authenticated;
grant update (entreprise_active) on administrateurs to authenticated;

-- ---------------------------------------------------------------
-- 4. Déménagement des trois comptes
-- ---------------------------------------------------------------
-- Les fiches « plombiers » créées pour l'équipe sont retirées, mais
-- seulement si rien ne s'y accroche : une suppression en cascade
-- emporterait des demandes et des rendez-vous. Mieux vaut laisser
-- une fiche orpheline qu'effacer des données.

do $$
declare
  u record;
  e uuid;
  compte uuid;
  adresses text[] := array[
    'bailliet.mael35@gmail.com',
    'rbn.math@yahoo.com',
    'eliotbarre0@gmail.com'
  ];
begin
  select id into e from entreprises order by cree_le limit 1;

  for u in
    select au.id, au.email
      from auth.users au
     where lower(au.email) = any (array(select lower(a) from unnest(adresses) a))
  loop
    insert into administrateurs (auth_user_id, nom, email, role, entreprise_active)
    values (u.id, split_part(u.email, '@', 1), u.email, 'fondateur', e)
    on conflict (email) do update
      set auth_user_id      = excluded.auth_user_id,
          entreprise_active = coalesce(administrateurs.entreprise_active, excluded.entreprise_active),
          actif             = true;

    -- La fiche plombier correspondante : on coupe d'abord le lien
    -- vers le compte, pour que l'administrateur ne soit plus perçu
    -- comme un salarié de l'entreprise cliente.
    update plombiers set auth_user_id = null where auth_user_id = u.id;

    -- Puis on supprime la fiche si elle ne porte aucune donnée.
    select id into compte from plombiers where lower(email) = lower(u.email) limit 1;
    if compte is not null
       and not exists (select 1 from demandes    where plombier_id = compte)
       and not exists (select 1 from rendez_vous where plombier_id = compte)
       and not exists (select 1 from appels      where plombier_id = compte)
    then
      delete from plombiers where id = compte;
      raise notice 'Fiche plombier supprimée pour %', u.email;
    elsif compte is not null then
      raise notice 'Fiche plombier conservée pour % : des données y sont rattachées.', u.email;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------
-- 5. Vérification
-- ---------------------------------------------------------------

select
  a.email,
  a.role,
  e.nom as entreprise_consultee,
  (a.auth_user_id is not null) as rattache
from administrateurs a
left join entreprises e on e.id = a.entreprise_active
order by a.cree_le;
