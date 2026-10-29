-- ChantierPilot — données de démonstration
--
-- TOUT CE QUI EST ICI EST FICTIF.
--   · les entreprises portent la mention « (démo) » et demo = true ;
--   · les numéros de téléphone sont pris dans les plages que l'ARCEP
--     réserve à la fiction (01 99 00 xx xx et 06 39 98 xx xx) ;
--   · les adresses e-mail finissent en .invalid, domaine qui ne peut
--     pas exister ;
--   · les appels n'ont jamais eu lieu : aucun ne vient de Retell.
--
-- Reproductible : chaque ligne a un identifiant fixe, dérivé de son
-- numéro (md5('demo-appel-12')). Relancer le fichier n'ajoute rien et
-- ne touche pas aux lignes existantes : les statuts modifiés depuis le
-- tableau de bord sont conservés. Pour repartir de zéro, exécuter
-- d'abord seed-demo-reset.sql.
--
-- Les dates sont calculées par rapport au moment du seed : environ un
-- tiers des appels tombe dans les 7 derniers jours. Une semaine plus
-- tard, les appels « récents » ont vieilli ; il suffit de relancer
-- reset + seed.

begin;

-- Désactive la création automatique de rappels : le seed les écrit
-- lui-même, avec des identifiants fixes.
select set_config('cp.seed', 'on', true);

create or replace function pg_temp.id(texte text) returns uuid
language sql immutable as $$ select md5(texte)::uuid $$;

-- ---------------------------------------------------------------
-- Entreprises
-- ---------------------------------------------------------------
insert into entreprises (id, nom, contact_nom, email, telephone, ville, statut, demo, cree_le)
values
  (pg_temp.id('demo-entreprise-1'), 'Plomberie Martin & Fils (démo)', 'Julien Martin',
   'contact@martin-plomberie.demo.invalid', '01 99 00 10 01', 'Angers', 'actif', true, now() - interval '120 days'),
  (pg_temp.id('demo-entreprise-2'), 'Hydro Services Loire (démo)', 'Sophie Lambert',
   'bonjour@hydro-loire.demo.invalid', '01 99 00 10 02', 'Nantes', 'actif', true, now() - interval '75 days'),
  (pg_temp.id('demo-entreprise-3'), 'Dépann''Eau Express (démo)', 'Romain Petit',
   'romain@depanneau.demo.invalid', '01 99 00 10 03', 'Tours', 'essai', true, now() - interval '12 days'),
  (pg_temp.id('demo-entreprise-4'), 'Les Tuyaux du Val (démo)', 'Nadia Roux',
   'nadia@tuyaux-du-val.demo.invalid', '01 99 00 10 04', 'Saumur', 'suspendu', true, now() - interval '200 days')
on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- Plombiers (comptes « user »). Sans compte de connexion : pour se
-- connecter en tant que l'un d'eux, un admin remplace son adresse par
-- une adresse réelle depuis l'écran Comptes.
-- ---------------------------------------------------------------
insert into plombiers (id, entreprise_id, nom, entreprise, email, telephone, ville,
                       communes, role, couleur, recoit_rdv, actif, retell_agent_id, cree_le)
select pg_temp.id('demo-plombier-' || v.n), pg_temp.id('demo-entreprise-' || v.e),
       v.nom, v.ent, v.email, v.tel, v.ville, v.communes, v.role, v.couleur, true, true,
       null, now() - interval '100 days'
from (values
  (1, 1, 'Julien Martin', 'Plomberie Martin & Fils (démo)', 'julien.martin@demo.chantierpilot.invalid',
      '06 39 98 20 01', 'Angers', array['Angers', 'Avrillé', 'Beaucouzé', 'Trélazé'], 'titulaire', '#0F6B62'),
  (2, 1, 'Kevin Morel', 'Plomberie Martin & Fils (démo)', 'kevin.morel@demo.chantierpilot.invalid',
      '06 39 98 20 02', 'Angers', array['Angers', 'Avrillé', 'Beaucouzé', 'Trélazé'], 'technicien', '#3B5BA9'),
  (3, 2, 'Sophie Lambert', 'Hydro Services Loire (démo)', 'sophie.lambert@demo.chantierpilot.invalid',
      '06 39 98 20 03', 'Nantes', array['Nantes', 'Rezé', 'Saint-Herblain', 'Orvault'], 'titulaire', '#0F6B62'),
  (4, 3, 'Romain Petit', 'Dépann''Eau Express (démo)', 'romain.petit@demo.chantierpilot.invalid',
      '06 39 98 20 04', 'Tours', array['Tours', 'Joué-lès-Tours', 'Saint-Cyr-sur-Loire'], 'titulaire', '#0F6B62'),
  (5, 4, 'Nadia Roux', 'Les Tuyaux du Val (démo)', 'nadia.roux@demo.chantierpilot.invalid',
      '06 39 98 20 05', 'Saumur', array['Saumur', 'Montreuil-Bellay'], 'titulaire', '#0F6B62')
) as v(n, e, nom, ent, email, tel, ville, communes, role, couleur)
on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- Paramètres des appels, calculés une fois pour toutes les tables
-- ---------------------------------------------------------------
create temp table demo_appels on commit drop as
with base as (
  select n,
         -- Répartition : la moitié des appels pour l'entreprise 1,
         -- qui sert de compte principal pour la démonstration.
         case when n % 10 < 5 then 1 when n % 10 < 7 then 2 when n % 10 < 9 then 3 else 4 end as e,
         (n * 5) % 20 as jours,
         (n * 37) % 600 + 15 as minutes
  from generate_series(1, 80) n
)
select b.*,
       case b.e when 1 then (case when b.n % 3 = 0 then 2 else 1 end)
                when 2 then 3 when 3 then 4 else 5 end as pl,
       now() - make_interval(days => b.jours, mins => b.minutes) as debut,
       (array['fuite', 'debouchage', 'chauffe_eau_depannage', 'wc', 'robinetterie',
              'recherche_fuite', 'chauffe_eau_remplacement', 'entretien_chaudiere',
              'devis', 'fuite'])[1 + b.n % 10] as motif,
       (array['Mme Arnaud', 'M. Bertin', 'Mme Caron', 'M. Delmas', 'Mme Etienne',
              'M. Fabre', 'Mme Garnier', 'M. Hubert', 'Mme Imbert', 'M. Jacquet',
              'Mme Klein', 'M. Leclerc', 'Mme Marchand', 'M. Noël', 'Mme Olivier',
              'M. Perrin', 'Mme Quentin', 'M. Renaud', 'Mme Simon', 'M. Thibault'])[1 + b.n % 20] as nom,
       -- Un numéro et une adresse par client (nom + entreprise).
       '06 39 98 ' || lpad((b.e * 20 + b.n % 20)::text, 2, '0') || ' '
                   || lpad(((b.n % 20) * 4 + b.e)::text, 2, '0') as tel,
       (array['12 rue des Lilas', '4 impasse du Moulin', '27 avenue de la Gare',
              '8 rue Pasteur', '15 boulevard des Écoles', '3 place du Marché',
              '41 rue Victor Hugo', '6 allée des Tilleuls'])[1 + (b.n % 20) % 8] as adresse,
       case
         when b.n = 1 then 'en_cours'
         when b.n % 17 = 0 then 'transfere'
         when b.n % 23 = 0 then 'echec'
         else 'termine'
       end as statut,
       -- Résultat de l'appel, selon un motif régulier mais varié.
       case
         when b.n = 1 or b.n % 23 = 0 then null
         when b.n % 17 = 0 then 'transfere'
         else (array['rdv_pris', 'a_rappeler', 'renseigne', 'rdv_pris',
                     'hors_perimetre', 'a_rappeler', 'sans_suite'])[1 + b.n % 7]
       end as resultat
from base b;

-- Communes de chaque entreprise, pour des adresses cohérentes.
create temp table demo_communes on commit drop as
select * from (values (1, 'Angers'), (2, 'Nantes'), (3, 'Tours'), (4, 'Saumur')) v(e, commune);

-- ---------------------------------------------------------------
-- Clients : un par nom et par entreprise
-- ---------------------------------------------------------------
insert into clients (id, entreprise_id, nom, telephone, adresse, commune, nb_demandes,
                     premier_appel, notes, cree_le)
select pg_temp.id('demo-client-' || a.e || '-' || a.nom),
       pg_temp.id('demo-entreprise-' || a.e),
       a.nom, min(a.tel), min(a.adresse), c.commune, count(*)::int, min(a.debut),
       case when a.nom = 'Mme Arnaud' then 'Code portail 1234B. Chien dans le jardin (fictif).' end,
       min(a.debut)
from demo_appels a join demo_communes c on c.e = a.e
group by a.e, a.nom, c.commune
on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- Appels
-- ---------------------------------------------------------------
insert into appels (id, plombier_id, retell_call_id, numero_appelant, nom_appelant,
                    client_id, motif, resultat, debut, fin, duree_s, statut,
                    resume, transcript, cree_le)
select pg_temp.id('demo-appel-' || a.n),
       pg_temp.id('demo-plombier-' || a.pl),
       'demo-' || a.n,
       a.tel,
       case when a.n % 9 = 0 then null else a.nom end,
       pg_temp.id('demo-client-' || a.e || '-' || a.nom),
       a.motif,
       a.resultat,
       a.debut,
       case when a.statut = 'en_cours' then null
            else a.debut + make_interval(secs => 60 + (a.n * 13) % 240) end,
       case when a.statut = 'en_cours' then null else 60 + (a.n * 13) % 240 end,
       a.statut,
       case
         when a.statut = 'en_cours' then null
         when a.resultat = 'rdv_pris' then
           '[Démo] ' || a.nom || ' signale : ' || (array[
             'fuite sous l''évier de la cuisine, eau qui goutte en continu',
             'canalisation de la salle de bain bouchée depuis deux jours',
             'chauffe-eau qui ne chauffe plus depuis ce matin',
             'chasse d''eau qui coule sans arrêt',
             'robinet de la douche qui fuit au niveau du mitigeur'])[1 + a.n % 5]
           || '. Rendez-vous réservé et confirmé oralement par le client.'
         when a.resultat = 'a_rappeler' then
           '[Démo] ' || a.nom || ' souhaite un devis ou un conseil avant intervention. '
           || 'Aucun créneau n''a convenu : le client attend un rappel.'
         when a.resultat = 'renseigne' then
           '[Démo] Demande d''information sur les tarifs et délais. Réponse donnée, pas d''intervention demandée.'
         when a.resultat = 'hors_perimetre' then
           '[Démo] Adresse hors du secteur d''intervention. Le client a été informé.'
         when a.resultat = 'transfere' then
           '[Démo] Urgence signalée : appel transféré au plombier.'
         when a.resultat = 'sans_suite' then
           '[Démo] Appel interrompu avant la fin de la conversation.'
       end,
       case when a.n % 4 = 0 and a.statut = 'termine' then
         'Assistant : Bonjour, Plomberie, je vous écoute.' || E'\n' ||
         'Client : Bonjour, j''ai un souci de ' || replace(a.motif, '_', ' ') || ' chez moi.' || E'\n' ||
         'Assistant : Je note. Pouvez-vous me donner votre adresse ?' || E'\n' ||
         'Client : ' || a.adresse || '.' || E'\n' ||
         'Assistant : Merci. Je regarde les disponibilités du plombier.' || E'\n' ||
         'Client : D''accord, merci.'
       end,
       a.debut
from demo_appels a
on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- Demandes : produites par les appels qui ont abouti à un rendez-vous
-- ou à un rappel.
-- ---------------------------------------------------------------
insert into demandes (id, appel_id, plombier_id, client_id, retell_call_id, type_probleme,
                      description_client, adresse, commune, dans_zone, urgence,
                      duree_estimee_min, nom_client, telephone_client, statut, origine, cree_le)
select pg_temp.id('demo-demande-' || a.n),
       pg_temp.id('demo-appel-' || a.n),
       pg_temp.id('demo-plombier-' || a.pl),
       pg_temp.id('demo-client-' || a.e || '-' || a.nom),
       'demo-' || a.n,
       a.motif,
       '[Démo] Description fictive du problème : ' || replace(a.motif, '_', ' ') || '.',
       a.adresse, c.commune, true,
       (array['haute', 'moyenne', 'basse'])[1 + a.n % 3],
       60 + (a.n % 3) * 30,
       a.nom, a.tel,
       case
         when a.resultat = 'rdv_pris' then 'rdv_pris'
         -- Les rappels anciens ont été faits : la demande est traitée.
         when a.jours >= 10 then 'traitee'
         else 'a_rappeler'
       end,
       'assistant',
       a.debut + interval '2 minutes'
from demo_appels a join demo_communes c on c.e = a.e
where a.resultat in ('rdv_pris', 'a_rappeler')
on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- Rendez-vous : un par demande « rdv_pris », aux statuts variés.
-- ---------------------------------------------------------------
insert into rendez_vous (id, demande_id, plombier_id, assigne_a, debut, fin, statut, origine,
                         confirme_par_client, termine_le, annule_le, motif_annulation, cree_le)
select pg_temp.id('demo-rdv-' || a.n),
       pg_temp.id('demo-demande-' || a.n),
       pg_temp.id('demo-plombier-' || a.pl),
       pg_temp.id('demo-plombier-' || a.pl),
       r.debut, r.debut + make_interval(mins => 60 + (a.n % 3) * 30),
       case when a.n % 11 = 0 then 'annule'
            when r.debut > now() and a.n % 3 = 0 then 'propose'
            else 'confirme' end,
       'assistant',
       not (r.debut > now() and a.n % 3 = 0),
       case when r.debut + interval '3 hours' < now() and a.n % 11 <> 0 and a.n % 4 <> 0
            then r.debut + interval '2 hours' end,
       case when a.n % 11 = 0 then a.debut + interval '1 day' end,
       case when a.n % 11 = 0 then '[Démo] Le client a trouvé une autre solution.' end,
       a.debut + interval '3 minutes'
from demo_appels a
cross join lateral (
  -- Entre 1 et 4 jours après l'appel, entre 8 h et 16 h (heure de Paris).
  select (date_trunc('day', a.debut at time zone 'Europe/Paris')
          + make_interval(days => 1 + a.n % 4, hours => 8 + a.n % 8, mins => (a.n % 2) * 30))
         at time zone 'Europe/Paris' as debut
) r
where a.resultat = 'rdv_pris'
on conflict (id) do nothing;

-- Deux rendez-vous saisis à la main par le plombier (pas par l'IA),
-- pour montrer la distinction dans les listes.
insert into demandes (id, plombier_id, client_id, type_probleme, description_client, adresse,
                      commune, dans_zone, urgence, duree_estimee_min, nom_client, telephone_client,
                      statut, origine, cree_le)
select pg_temp.id('demo-demande-manuel-' || k), pg_temp.id('demo-plombier-1'), null,
       (array['entretien_chaudiere', 'devis'])[k],
       '[Démo] Rendez-vous pris directement par le plombier.',
       (array['9 rue des Vignes', '22 quai de la Maine'])[k], 'Angers', true, 'basse', 120,
       (array['M. Vasseur', 'Mme Weber'])[k],
       (array['01 99 00 20 01', '01 99 00 20 02'])[k],
       'rdv_pris', 'manuel', now() - interval '1 day'
from generate_series(1, 2) k
on conflict (id) do nothing;

insert into rendez_vous (id, demande_id, plombier_id, assigne_a, debut, fin, statut, origine,
                         confirme_par_client, cree_le)
select pg_temp.id('demo-rdv-manuel-' || k), pg_temp.id('demo-demande-manuel-' || k),
       pg_temp.id('demo-plombier-1'),
       pg_temp.id('demo-plombier-' || k),
       (date_trunc('day', now() at time zone 'Europe/Paris')
        + make_interval(days => k + 1, hours => 10)) at time zone 'Europe/Paris',
       (date_trunc('day', now() at time zone 'Europe/Paris')
        + make_interval(days => k + 1, hours => 12)) at time zone 'Europe/Paris',
       'confirme', 'manuel', false, now() - interval '1 day'
from generate_series(1, 2) k
on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- Rappels : un par demande « à rappeler » ou ancienne demande traitée,
-- plus quelques appels « sans suite » à recontacter.
-- ---------------------------------------------------------------
insert into rappels (id, plombier_id, appel_id, demande_id, client_id, nom_client, telephone,
                     motif, raison, priorite, statut, echeance, note, effectue_le, cree_le)
select pg_temp.id('demo-rappel-' || a.n),
       pg_temp.id('demo-plombier-' || a.pl),
       pg_temp.id('demo-appel-' || a.n),
       pg_temp.id('demo-demande-' || a.n),
       pg_temp.id('demo-client-' || a.e || '-' || a.nom),
       a.nom, a.tel, a.motif,
       (array['Le client souhaite un devis avant de fixer un rendez-vous.',
              'Aucun créneau proposé ne convenait au client.',
              'Question technique à laquelle l''assistant n''a pas pu répondre.',
              'Le client veut parler directement au plombier.'])[1 + a.n % 4],
       (array['haute', 'moyenne', 'basse'])[1 + a.n % 3],
       case when a.jours >= 10 then 'effectue'
            when a.n % 4 = 0 then 'reporte'
            else 'a_faire' end,
       case when a.jours >= 10 then null
            when a.n % 4 = 0 then now() + interval '2 days'
            -- Quelques rappels dont l'échéance est déjà passée.
            when a.n % 3 = 0 then now() - interval '1 day'
            else now() + interval '1 day' end,
       case when a.jours >= 10 then '[Démo] Client rappelé, devis envoyé.' end,
       case when a.jours >= 10 then a.debut + interval '1 day' end,
       a.debut + interval '2 minutes'
from demo_appels a
where a.resultat = 'a_rappeler'
on conflict (id) do nothing;

insert into rappels (id, plombier_id, appel_id, client_id, nom_client, telephone, motif,
                     raison, priorite, statut, echeance, cree_le)
select pg_temp.id('demo-rappel-' || a.n),
       pg_temp.id('demo-plombier-' || a.pl),
       pg_temp.id('demo-appel-' || a.n),
       pg_temp.id('demo-client-' || a.e || '-' || a.nom),
       a.nom, a.tel, a.motif,
       'Appel interrompu : rappeler pour comprendre la demande.',
       null, 'a_faire', null, a.debut + interval '5 minutes'
from demo_appels a
where a.resultat = 'sans_suite' and a.jours < 7
on conflict (id) do nothing;

commit;
