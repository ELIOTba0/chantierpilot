# ChantierPilot — backend

Le backend de l'assistant vocal pour plombiers. C'est la partie du
produit qui t'appartient : la plateforme vocale (Retell aujourd'hui)
est un fournisseur remplaçable, cette base et ces endpoints non.

## Principe d'architecture

```
Appel entrant
    ↓
Retell          ← loué, remplaçable
    ↓ custom functions pendant l'appel
    ↓ webhook après l'appel
CE BACKEND      ← le tien
    ↓
Supabase        ← tes données, exportables
    ↓
Google Calendar ← l'agenda du plombier
```

Règle qui rend tout remplaçable : **chaque appel atterrit dans ta base**,
même si Retell le garde aussi. Changer de plateforme vocale = réécrire
un connecteur, pas perdre l'historique.

## Ce qu'il y a dedans

| Fichier | Rôle |
|---|---|
| `db/schema.sql` | Le schéma Postgres complet |
| `lib/db.ts` | Client Supabase serveur + journal |
| `lib/retell.ts` | Vérification des signatures |
| `lib/agenda.ts` | Lecture des disponibilités, création d'événement |
| `lib/metier.ts` | Durées, zone, urgence, formatage français |
| `app/api/functions/check-availability` | Appelée pendant l'appel |
| `app/api/functions/book-appointment` | Appelée après confirmation |
| `app/api/webhooks/retell` | Événements d'appel |

## Les trois garde-fous

Ce qui sépare un prototype d'un produit, et qui est déjà codé :

**Signature vérifiée.** Les trois endpoints sont des URL publiques.
Sans vérification, n'importe qui crée de faux rendez-vous.

**Idempotence.** Retell peut livrer deux fois le même événement. La
contrainte unique sur `evenements_webhook(source, evenement_id)` fait
le travail : le doublon est rejeté par la base, pas par du code.

**Jamais d'invention.** Agenda injoignable, erreur quelconque : les
endpoints renvoient `disponible: false` ou `reserve: false`. L'agent
prend un message. Il ne dit jamais « c'est noté » sans que ça le soit.

## Mise en route

```bash
npm install
cp .env.example .env    # puis remplir
npm run dev
```

1. Crée un projet Supabase, exécute `db/schema.sql` dans son éditeur SQL
2. Copie l'URL et la clé service role dans `.env`
3. Crée un projet Google Cloud, active l'API Calendar, génère des
   identifiants OAuth (type application web), ajoute l'URI de redirection
4. Choisis toi-même une valeur pour `RETELL_FUNCTION_SECRET` — tu la
   mettras en en-tête `x-chantierpilot-cle` des custom functions Retell

## Côté Retell

Deux custom functions à déclarer, en POST, avec l'en-tête
`x-chantierpilot-cle` :

| Fonction | URL |
|---|---|
| `check_availability` | `https://<ton-domaine>/api/functions/check-availability` |
| `book_appointment` | `https://<ton-domaine>/api/functions/book-appointment` |

Et le webhook sur `https://<ton-domaine>/api/webhooks/retell`.

Le `plombier_id` doit être passé dans les métadonnées de l'agent Retell
pour que les fonctions sachent de quel plombier il s'agit.

## Le tableau de bord

Deux espaces, une même application :

| Espace | Pour qui | Pages |
|---|---|---|
| Plombier (`user`) | un plombier, limité à **son** entreprise | Vue d'ensemble (`/demandes`, avec le calendrier de la semaine), Appels, À rappeler, Rendez-vous (liste + Planning), Clients, Réglages |
| Administration (`admin`) | l'équipe ChantierPilot | `/admin` : vue globale, Entreprises (fiche détaillée), Appels, Rappels, Rendez-vous, Comptes et accès |

**Où sont vérifiés les droits.** Dans la base, jamais seulement dans
l'interface. Les pages lisent Supabase avec la clé anon et la session
de la personne connectée : le RLS (migration 005) ne renvoie que les
lignes de son entreprise, ou tout pour un admin. Les écritures
sensibles (rappels, statut des rendez-vous, administration) passent par
des fonctions SQL qui revérifient les droits et valident les données.
Forcer l'adresse d'une page ne donne accès à rien.

**Rôles.** Un compte est `admin` s'il figure, actif, dans la table
`administrateurs` ; `user` s'il est rattaché à un plombier actif. Le
rattachement se fait à la première connexion, par l'adresse e-mail
prouvée par le code reçu. Il n'y a aucun mot de passe.

**Couches.** `app/` affiche, `lib/donnees/` est le seul module qui
parle à la base, les règles et les indicateurs sont en SQL
(`v_appels`, `v_rendez_vous`, `v_rappels`, `v_clients`, `v_entreprises`,
`cp_indicateurs()`). Les données de démonstration vivent à part
(`db/seed-demo.sql`) : les remplacer par les vrais appels de
l'assistant ne touche pas au code.

**Guide intégré.** La bulle « Aide » répond à partir des fiches écrites
dans `lib/guide.ts` : pas d'IA, pas d'appel réseau, et elle le dit.
Une fiche décrit ce que l'écran fait vraiment : quand une page change,
sa fiche change dans le même commit.

### Base de données : ordre d'exécution

Dans l'éditeur SQL de Supabase :

1. `db/schema.sql`
2. `db/migration-002-003-reconstitution.sql` (sans effet si la base a
   déjà ces objets, ce qui est le cas en production)
3. `db/migration-004.sql`
4. `db/migration-005-dashboard.sql`

Tous ces fichiers sont rejouables.

### Premier administrateur

Une seule fois, dans l'éditeur SQL, avec une vraie adresse :

```sql
insert into administrateurs (email, nom) values ('prenom@exemple.fr', 'Prénom');
```

La personne se connecte ensuite sur la page d'accueil avec cette
adresse. Les autres administrateurs s'ajoutent depuis
**Administration → Comptes et accès**.

### Données de démonstration

```sql
-- db/seed-demo.sql : 4 entreprises fictives, 80 appels, rappels et RDV
-- db/seed-demo-reset.sql : efface les données de démo, et elles seules
```

Tout est fictif et marqué : entreprises « (démo) » avec `demo = true`,
numéros dans les plages réservées à la fiction par l'ARCEP (01 99 00…,
06 39 98…), e-mails en `.invalid`. Le seed ne crée jamais de doublon.
Les dates sont relatives au moment du seed : une semaine plus tard,
relancer reset puis seed pour retrouver des appels « récents ».

Pour se connecter comme un plombier de démo, un admin remplace son
adresse e-mail par une adresse réelle (Entreprises → fiche → Comptes).

### Tests

```bash
# Postgres local requis (variables PGHOST, PGPORT, PGUSER)
npm run test:db
```

Monte une base neuve, applique migrations et seed deux fois (pour
vérifier qu'ils sont rejouables), puis vérifie par assertions
l'isolation entre entreprises, les droits admin, les actions sur les
rappels et les rendez-vous, et la mise à jour des indicateurs.

## Ce qui n'est pas encore là

- L'écran OAuth Google (le plombier autorise son agenda) — squelette créé
- L'envoi du SMS de confirmation
- Le webhook Retell ne remplit pas encore `appels.resultat`,
  `nom_appelant` ni `motif` : le tableau de bord les déduit de la fiche
  demande quand elle existe, sinon affiche « Non déterminé »
- Annuler un rendez-vous depuis le tableau de bord ne supprime pas
  l'événement Google Agenda et ne prévient pas le client (l'écran le dit)

À faire dans cet ordre. Le SMS avant l'interface : un rendez-vous non
confirmé au client est plus grave qu'un plombier qui n'a pas de tableau
de bord.
