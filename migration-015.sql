-- ------------------------------------------------------------------
-- 015 — la base de calcul
--
-- Un plombier ne connaît pas ses prix par cœur : il connaît son taux
-- horaire, le temps que prend un travail, et ce que lui coûtent les
-- pièces. Le prix se déduit des trois :
--
--     prix HT = (temps / 60) x taux horaire
--             + fournitures x coefficient
--
-- Le prix fixé à la main reste prioritaire : un forfait négocié ne
-- doit jamais être écrasé par une formule.
--
-- Rejouable sans dommage.
-- ------------------------------------------------------------------

alter table public.entreprises
  add column if not exists taux_horaire_ht      numeric(10,2),
  add column if not exists coef_fournitures     numeric(6,3) not null default 1,
  add column if not exists frais_deplacement_ht numeric(10,2);

alter table public.prestations
  add column if not exists temps_min     integer,
  add column if not exists fourniture_ht numeric(10,2);

-- Des bornes, parce qu'une virgule mal placée dans un import ne doit
-- pas produire un taux horaire à quatre chiffres sans que rien ne
-- bronche.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'entreprises_taux_horaire_sense') then
    alter table public.entreprises add constraint entreprises_taux_horaire_sense
      check (taux_horaire_ht is null or (taux_horaire_ht >= 0 and taux_horaire_ht <= 1000));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'entreprises_coef_sense') then
    alter table public.entreprises add constraint entreprises_coef_sense
      check (coef_fournitures > 0 and coef_fournitures <= 10);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'entreprises_deplacement_sense') then
    alter table public.entreprises add constraint entreprises_deplacement_sense
      check (frais_deplacement_ht is null or (frais_deplacement_ht >= 0 and frais_deplacement_ht <= 10000));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'prestations_temps_sense') then
    alter table public.prestations add constraint prestations_temps_sense
      check (temps_min is null or (temps_min >= 0 and temps_min <= 10080));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'prestations_fourniture_sense') then
    alter table public.prestations add constraint prestations_fourniture_sense
      check (fourniture_ht is null or fourniture_ht >= 0);
  end if;
end $$;

-- Ménage au passage : le rôle anonyme détenait des droits d'écriture
-- sur les entreprises. Aucune politique ne les lui accordait, donc
-- rien n'était exposé, mais un droit inutile est un droit à retirer
-- avant qu'une politique future ne l'active par mégarde.
revoke all on public.entreprises from anon;

select 'migration 015 appliquée' as resultat,
       (select count(*) from information_schema.columns
         where table_schema='public' and table_name='entreprises'
           and column_name in ('taux_horaire_ht','coef_fournitures','frais_deplacement_ht')) as colonnes_entreprise,
       (select count(*) from information_schema.columns
         where table_schema='public' and table_name='prestations'
           and column_name in ('temps_min','fourniture_ht')) as colonnes_prestation;
