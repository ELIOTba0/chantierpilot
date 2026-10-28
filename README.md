# Astio — interface de supervision (prototype frontend)

Astio prend les appels entrants d'un plombier indépendant grâce à un agent vocal.
Cette interface permet au professionnel de voir ce qu'Astio a géré et de ne
traiter que les décisions qui lui reviennent.

> Prototype 100 % navigateur : aucune API, aucun backend, aucune clé. Les données
> sont fictives et les SMS au client sont simulés.

## Démarrer

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:3000. Vérifications : `npm run lint`, `npx tsc --noEmit`, `npm run build`.

## Règle métier

L'agent vocal **ne fixe jamais de rendez-vous**. Il recueille les disponibilités du
client et suggère un créneau ; le plombier répond **oui** (rendez-vous confirmé,
SMS au client) ou **non** (autre créneau, ou refus de la demande).

Quatre dimensions sont modélisées séparément : statut du dossier, état du
rendez-vous, priorité et décision requise (transversale aux statuts).

## Pages

| Page | Contenu |
| --- | --- |
| Vue d'ensemble | Appels reçus aujourd'hui, appels à planifier, calendrier Jour / Semaine / Mois |
| Appels | Kanban (glisser-déposer sur ordinateur) et liste, filtres, tri, panneau de détail avec transcription et historique |
| Planning | Calendrier, plages libres cliquables, suggestions à confirmer, reprogrammation |
| Clients | Recherche, fiche avec coordonnées, appels et rendez-vous |
| Réglages | Profil, horaires, gestion des appels, réinitialisation de la démo |

## Structure

```
src/
  app/                 Routes (App Router)
  components/
    layout/            Barre latérale, barre supérieure, recherche, notifications
    ui/                Composants génériques (boutons, badges, modales, panneau latéral…)
    calls/             Kanban, liste, panneau d'appel, actions et dialogues
    calendar/          Calendrier et dialogues de rendez-vous
    planning/          Panneau « À planifier »
    clients/           Liste et fiche client
    settings/          Formulaire de réglages
    dashboard/         Tuiles de la vue d'ensemble
  lib/
    types.ts           Modèle de données
    demo-data.ts       Données fictives (relatives à la date du jour)
    store.ts           Store local, règles métier, persistance localStorage
    selectors.ts       Données dérivées (décisions, appels à planifier, clients)
    slots.ts           Créneaux libres et suggestions (simulation)
    messages.ts        Modèles de SMS
    format.ts          Dates, heures, téléphones
```

Les données de démonstration sont régénérées chaque jour (les réglages sont
conservés) et peuvent être réinitialisées depuis la page Réglages.
