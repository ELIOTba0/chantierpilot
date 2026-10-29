-- ChantierPilot — efface les données de démonstration, et elles seules.
--
-- Ne touche qu'aux entreprises marquées demo = true et à ce qui leur
-- est rattaché. Les vraies entreprises ne sont jamais concernées.
-- Ensuite, relancer seed-demo.sql pour des données fraîches.

begin;

create temp table demo_plombiers on commit drop as
  select p.id from plombiers p
  join entreprises e on e.id = p.entreprise_id
  where e.demo;

delete from rappels      where plombier_id in (select id from demo_plombiers);
delete from rendez_vous  where plombier_id in (select id from demo_plombiers);
delete from demandes     where plombier_id in (select id from demo_plombiers);
delete from appels       where plombier_id in (select id from demo_plombiers);
delete from notifications where entreprise_id in (select id from entreprises where demo);
delete from clients      where entreprise_id in (select id from entreprises where demo);
delete from plombiers    where id in (select id from demo_plombiers);
delete from entreprises  where demo;

commit;
