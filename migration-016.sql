-- ------------------------------------------------------------------
-- 016 — ne plus perdre le lien entre un compte et sa fiche
--
-- Le rattachement ne se faisait qu'à la CRÉATION du compte. Si le
-- lien se défait ensuite — compte supprimé puis recréé, fiche
-- ajoutée après coup —, plus rien ne le rétablit, et l'utilisateur
-- se retrouve devant « Compte sans accès » sans comprendre pourquoi.
-- C'est exactement ce qui est arrivé.
--
-- Désormais le rattachement est aussi tenté à chaque connexion.
-- C'est peu coûteux (un UPDATE qui ne touche rien dans le cas
-- normal) et ça fait disparaître toute une classe de pannes.
--
-- Rejouable sans dommage.
-- ------------------------------------------------------------------

create or replace function public.lier_plombier_au_compte()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Le rapprochement se fait sur l'adresse, insensible à la casse.
  -- On ne touche qu'aux fiches orphelines : jamais on ne vole une
  -- fiche déjà rattachée à un autre compte.
  update plombiers
     set auth_user_id = new.id
   where lower(email) = lower(new.email)
     and auth_user_id is null;
  return new;
end;
$function$;

-- À la connexion : last_sign_in_at change, on retente le lien.
drop trigger if exists on_auth_user_signed_in on auth.users;
create trigger on_auth_user_signed_in
  after update on auth.users
  for each row
  when (new.last_sign_in_at is distinct from old.last_sign_in_at)
  execute function public.lier_plombier_au_compte();

select 'migration 016 appliquée' as resultat,
       count(*) filter (where auth_user_id is not null) as fiches_rattachees,
       count(*) as fiches_total
  from public.plombiers;
