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

## Ce qui n'est pas encore là

- L'écran OAuth Google (le plombier autorise son agenda) — squelette créé
- L'envoi du SMS de confirmation
- L'interface artisan
- Les tests

À faire dans cet ordre. Le SMS avant l'interface : un rendez-vous non
confirmé au client est plus grave qu'un plombier qui n'a pas de tableau
de bord.
