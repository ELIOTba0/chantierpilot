-- ------------------------------------------------------------------
-- 014 — le courriel du client sur le devis
--
-- Le devis est un document figé : il recopie les coordonnées du
-- client plutôt que d'y renvoyer, pour qu'un changement d'adresse
-- l'an prochain ne réécrive pas un devis signé. Le courriel manquait
-- à l'appel, et sans lui le bouton « envoyer » ouvre un message sans
-- destinataire.
--
-- Rejouable sans dommage.
-- ------------------------------------------------------------------

alter table public.devis
  add column if not exists client_email text;

-- Les devis déjà créés récupèrent le courriel connu du client, sans
-- écraser ce qui aurait été saisi à la main.
update public.devis d
   set client_email = c.email
  from public.clients c
 where d.client_id = c.id
   and d.client_email is null
   and c.email is not null;

-- Retrouver les prestations par libellé est ce que fait l'import de
-- tarifs ; sans cet index il relit la table entière à chaque ligne.
create index if not exists prestations_entreprise_libelle_idx
  on public.prestations (entreprise_id, lower(libelle));

select 'migration 014 appliquée' as resultat,
       count(*) filter (where client_email is not null) as devis_avec_courriel,
       count(*) as devis_total
  from public.devis;
