import type {
  AgentStep,
  AppState,
  Appointment,
  Call,
  Client,
  HistoryEvent,
  Settings,
  SlotProposal,
  TranscriptLine,
} from "./types";
import { addDays, dayKey, isSameDay, startOfDay } from "./format";

export const STATE_VERSION = 2;

/**
 * Jeu de données de démonstration, généré relativement à la date du jour
 * pour que le tableau de bord et le planning restent cohérents.
 */
export function buildDemoState(nowMs: number): AppState {
  const now = new Date(nowMs);
  const today = startOfDay(now);

  const at = (day: Date, h: number, m = 0) => {
    const d = new Date(day);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  /** n-ième jour ouvré à partir d'aujourd'hui (0 = aujourd'hui, négatif = passé). */
  const workday = (n: number) => {
    let d = new Date(today);
    let left = Math.abs(n);
    const step = n >= 0 ? 1 : -1;
    while (left > 0) {
      d = addDays(d, step);
      if (d.getDay() !== 0 && d.getDay() !== 6) left--;
    }
    return d;
  };

  /** Prochain jour de la semaine donné (0 = dimanche), au moins demain. */
  const nextDow = (dow: number) => {
    let d = addDays(today, 1);
    while (d.getDay() !== dow) d = addDays(d, 1);
    return d;
  };

  /**
   * Appels du jour : les heures « théoriques » (entre 7 h et 17 h) sont
   * ramenées dans l'intervalle déjà écoulé de la journée.
   */
  const dayStart = at(today, 7);
  const elapsed = Math.max(nowMs - new Date(dayStart).getTime() - 5 * 60_000, 60 * 60_000);
  const todayCall = (h: number, m: number) => {
    const ratio = (h - 7 + m / 60) / 10;
    const ms = new Date(dayStart).getTime() + Math.min(ratio, 1) * Math.min(elapsed, 10 * 3_600_000);
    return new Date(ms).toISOString();
  };

  const plus = (iso: string, minutes: number) =>
    new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();

  /** Premier créneau possible : dans l'heure qui suit (arrondi à la demi-heure), sinon le prochain jour ouvré à 8 h. */
  const asap = (durationMin: number, availability: SlotProposal["availability"], note: string): SlotProposal => {
    const half = 30 * 60_000;
    let start = new Date(Math.ceil((nowMs + 60 * 60_000) / half) * half);
    const weekend = start.getDay() === 0 || start.getDay() === 6;
    if (weekend || start.getHours() + durationMin / 60 > 19 || !isSameDay(start, today)) {
      start = new Date(workday(1));
      start.setHours(8, 0, 0, 0);
    }
    return { start: start.toISOString(), end: plus(start.toISOString(), durationMin), availability, note };
  };

  const slot = (day: Date, h: number, m: number, durationMin: number) => {
    const start = at(day, h, m);
    return { start, end: plus(start, durationMin) };
  };

  const proposal = (
    day: Date,
    h: number,
    m: number,
    durationMin: number,
    availability: SlotProposal["availability"],
    note?: string,
  ): SlotProposal => ({ ...slot(day, h, m, durationMin), availability, note });

  const transcript = (lines: [TranscriptLine["speaker"], string][]): TranscriptLine[] => {
    let t = 0;
    return lines.map(([speaker, text]) => {
      const line = { speaker, t, text };
      t += Math.max(4, Math.round(text.length / 14));
      return line;
    });
  };

  const steps = (items: [string, boolean][]): AgentStep[] =>
    items.map(([label, done]) => ({ label, done }));

  const history = (
    callId: string,
    items: [string, HistoryEvent["actor"], string, string?][],
  ): HistoryEvent[] =>
    items.map(([iso, actor, label, detail], i) => ({ id: `${callId}-h${i}`, at: iso, actor, label, detail }));

  // ---------------------------------------------------------------- Clients

  const clients: Client[] = [
    { id: "cl-01", name: "Claire Fontaine", phone: "0612483371", address: "14 rue Duguesclin, 69006 Lyon", zone: "Lyon 6e", since: at(addDays(today, -21), 9) },
    { id: "cl-02", name: "Karim Benali", phone: "0764190823", address: "8 avenue Roger Salengro, 69100 Villeurbanne", zone: "Villeurbanne", since: todayCall(12, 5) },
    { id: "cl-03", name: "Sophie Lambert", phone: "0633587102", address: "27 cours Vitton, 69006 Lyon", zone: "Lyon 6e", since: todayCall(11, 30) },
    { id: "cl-04", name: "Gérard Petit", phone: "0478624519", address: "3 place Jean Macé, 69007 Lyon", zone: "Lyon 7e", since: at(addDays(today, -1), 16, 10) },
    { id: "cl-05", name: "Nathalie Roux", phone: "0687241136", address: "52 rue de la République, 69002 Lyon", zone: "Lyon 2e", since: at(addDays(today, -9), 10) },
    { id: "cl-06", name: "M. Durand", phone: "0781220954", address: undefined, zone: "Lyon 3e", since: todayCall(10, 10) },
    { id: "cl-07", name: "Lucas Martin", phone: "0652873340", address: "15 rue Garibaldi, 69003 Lyon", zone: "Lyon 3e", since: todayCall(9, 40) },
    { id: "cl-08", name: "Solaris Énergie", phone: "0975180432", address: undefined, since: todayCall(9, 5) },
    { id: "cl-09", name: "Isabelle Garnier", phone: "0614927785", address: "6 rue Masséna, 69006 Lyon", zone: "Lyon 6e", since: todayCall(8, 30) },
    { id: "cl-10", name: "Thomas Girard", phone: "0672318854", address: "41 rue Inkermann, 69006 Lyon", zone: "Lyon 6e", since: todayCall(8, 50) },
    { id: "cl-11", name: "Émilie Chevalier", phone: "0623459017", address: "9 rue Dumenge, 69004 Lyon", zone: "Lyon 4e", since: at(addDays(today, -2), 8, 15) },
    { id: "cl-12", name: "Paul Lefebvre", phone: "0698712046", address: undefined, zone: "Villeurbanne", since: todayCall(11, 50) },
    { id: "cl-13", name: "Marie Dubois", phone: "0645203378", address: "18 rue Ney, 69006 Lyon", zone: "Lyon 6e", since: todayCall(9, 20) },
    { id: "cl-14", name: "Antoine Mercier", phone: "0661580392", address: "33 boulevard des Belges, 69006 Lyon", zone: "Lyon 6e", since: todayCall(7, 50) },
    { id: "cl-15", name: "Appelant inconnu", phone: "0749035521", address: undefined, since: todayCall(12, 40) },
    { id: "cl-16", name: "Camille Bernard", phone: "0617745280", address: "5 rue Bossuet, 69006 Lyon", zone: "Lyon 6e", since: todayCall(10, 25) },
    { id: "cl-17", name: "Hugo Fournier", phone: "0656128849", address: "22 rue Paul Bert, 69003 Lyon", zone: "Lyon 3e", since: at(addDays(today, -4), 10) },
    { id: "cl-18", name: "Jean-Pierre Roche", phone: "0478952361", address: "11 rue Servient, 69003 Lyon", zone: "Lyon 3e", since: at(addDays(today, -12), 9) },
    { id: "cl-19", name: "Léa Vidal", phone: "0629847713", address: "70 cours Émile Zola, 69100 Villeurbanne", zone: "Villeurbanne", since: at(addDays(today, -6), 14) },
    { id: "cl-20", name: "Marc Olivier", phone: "0685531290", address: "4 rue Créqui, 69006 Lyon", zone: "Lyon 6e", since: at(addDays(today, -30), 11) },
  ];

  // ----------------------------------------------------------- Rendez-vous

  const c05Original = slot(workday(1), 17, 0, 60);

  const appointments: Appointment[] = [
    { id: "rdv-03", clientId: "cl-04", callId: "AP-1038", ...slot(workday(1), 10, 0, 60), state: "confirme", motif: "Entretien annuel chaudière", address: "3 place Jean Macé, 69007 Lyon", zone: "Lyon 7e" },
    { id: "rdv-04", clientId: "cl-10", callId: "AP-1041", ...slot(workday(1), 14, 0, 150), state: "confirme", motif: "Remplacement chauffe-eau 200 L", address: "41 rue Inkermann, 69006 Lyon", zone: "Lyon 6e" },
    { id: "rdv-05", clientId: "cl-05", callId: "AP-1048", ...c05Original, state: "confirme", motif: "Remplacement mitigeur de douche", address: "52 rue de la République, 69002 Lyon", zone: "Lyon 2e" },
    { id: "rdv-06", clientId: "cl-11", callId: "AP-1036", ...slot(workday(-1), 9, 0, 60), state: "realise", motif: "Débouchage évier", address: "9 rue Dumenge, 69004 Lyon", zone: "Lyon 4e" },
    { id: "rdv-07", clientId: "cl-13", callId: "AP-1039", ...slot(workday(3), 11, 0, 45), state: "confirme", motif: "Robinet de cuisine qui goutte", address: "18 rue Ney, 69006 Lyon", zone: "Lyon 6e" },
    { id: "rdv-08", clientId: "cl-14", callId: "AP-1043", ...slot(today, 11, 0, 90), state: "confirme", motif: "Fuite sur chauffe-eau", address: "33 boulevard des Belges, 69006 Lyon", zone: "Lyon 6e" },
    { id: "rdv-10", clientId: "cl-17", callId: "AP-1033", ...slot(workday(-2), 14, 0, 120), state: "realise", motif: "Recherche de fuite", address: "22 rue Paul Bert, 69003 Lyon", zone: "Lyon 3e" },
    { id: "rdv-11", clientId: "cl-01", callId: "AP-1012", ...slot(addDays(today, -19), 9, 0, 90), state: "realise", motif: "Détartrage chauffe-eau", address: "14 rue Duguesclin, 69006 Lyon", zone: "Lyon 6e" },
    { id: "rdv-12", clientId: "cl-18", ...slot(today, 8, 30, 90), state: "confirme", motif: "Remplacement robinet d'arrêt", address: "11 rue Servient, 69003 Lyon", zone: "Lyon 3e" },
    { id: "rdv-13", clientId: "cl-19", ...slot(workday(2), 9, 0, 120), state: "confirme", motif: "Raccordement lave-vaisselle", address: "70 cours Émile Zola, 69100 Villeurbanne", zone: "Villeurbanne" },
    { id: "rdv-14", clientId: "cl-20", ...slot(workday(4), 14, 0, 180), state: "confirme", motif: "Pose receveur de douche", address: "4 rue Créqui, 69006 Lyon", zone: "Lyon 6e" },
  ];

  // ----------------------------------------------------------------- Appels

  const t1051 = todayCall(13, 20);
  const t1050 = todayCall(12, 5);
  const t1049 = todayCall(11, 30);
  const t1048 = todayCall(10, 45);
  const t1047 = todayCall(10, 10);
  const t1046 = todayCall(9, 40);
  const t1045 = todayCall(9, 5);
  const t1044 = todayCall(8, 30);
  const t1043 = todayCall(7, 50);
  const t1041 = todayCall(8, 50);
  const t1039 = todayCall(9, 20);
  const t1042 = todayCall(10, 25);
  const t1040 = todayCall(11, 50);
  const t1037 = todayCall(12, 40);

  const calls: Call[] = [
    {
      id: "AP-1051",
      clientId: "cl-01",
      receivedAt: t1051,
      durationSec: 214,
      motif: "Fuite d'eau sous l'évier",
      summary: "Fuite importante sous l'évier de cuisine, l'eau continue de couler après fermeture du robinet d'arrêt.",
      description:
        "La cliente signale une fuite importante au niveau du siphon et du flexible d'alimentation sous l'évier de cuisine. Elle a fermé le robinet d'arrêt de la cuisine mais l'écoulement continue. Une bassine est en place, le meuble est déjà humide.",
      interventionType: "Dépannage – recherche et réparation de fuite",
      address: "14 rue Duguesclin, 69006 Lyon (2e étage, digicode 4821)",
      clientAvailability: ["Aujourd'hui, dès que possible", "Présente toute la journée"],
      estimatedDurationMin: 60,
      missingInfo: ["Accès au compteur général non confirmé"],
      priority: "urgente",
      urgencyNote:
        "Urgence probable d'après les propos de la cliente : écoulement continu malgré la fermeture du robinet d'arrêt. À confirmer par vos soins.",
      status: "a_confirmer",
      decision: {
        kind: "verifier_urgence",
        reason:
          "Écoulement continu signalé malgré la fermeture du robinet d'arrêt. Astio suggère le créneau le plus proche mais ne peut pas évaluer la gravité réelle.",
        expectedAction: "Vérifier l'urgence et confirmer le créneau",
      },
      proposedSlots: [asap(60, "libre", "Créneau le plus proche, la cliente est présente toute la journée")],
      agentSteps: steps([
        ["Appel pris en charge", true],
        ["Identité et coordonnées recueillies", true],
        ["Problème identifié : fuite sous évier", true],
        ["Conseil de fermer l'arrivée d'eau générale", true],
        ["Disponibilités recueillies : toute la journée", true],
        ["Créneau le plus proche suggéré", true],
        ["Décision du professionnel", false],
      ]),
      transcript: transcript([
        ["astio", "Moreau Plomberie bonjour, je suis Astio, l'assistant de Julien Moreau. Comment puis-je vous aider ?"],
        ["client", "Bonjour, j'ai une grosse fuite sous l'évier de la cuisine, ça coule beaucoup."],
        ["astio", "Je comprends. Avez-vous pu fermer l'arrivée d'eau ?"],
        ["client", "J'ai fermé le petit robinet sous l'évier, mais ça continue de couler."],
        ["astio", "Dans ce cas, je vous conseille de fermer le robinet général, souvent situé près du compteur d'eau. Savez-vous où il se trouve ?"],
        ["client", "Je crois qu'il est dans la cave, je vais demander au gardien."],
        ["astio", "Très bien. Pouvez-vous me donner votre nom et l'adresse de l'intervention ?"],
        ["client", "Claire Fontaine, 14 rue Duguesclin dans le 6e. Deuxième étage, le code c'est 4821."],
        ["astio", "Merci madame Fontaine. Quelles sont vos disponibilités ?"],
        ["client", "Je suis là toute la journée, le plus tôt sera le mieux. J'ai peur que ça abîme le meuble."],
        ["astio", "Je transmets votre demande à Julien Moreau en la signalant comme urgente. Il vous confirmera l'horaire au plus vite par SMS."],
        ["client", "D'accord, merci beaucoup."],
        ["astio", "Je vous en prie. Pensez à couper l'eau au compteur. À tout à l'heure."],
      ]),
      history: history("AP-1051", [
        [t1051, "client", "Appel reçu", "Durée 3 min 34 s"],
        [plus(t1051, 2), "astio", "Demande qualifiée", "Fuite – urgence probable"],
        [plus(t1051, 3), "astio", "Créneau suggéré par Astio", "Au plus tôt – en attente de votre décision"],
        [plus(t1051, 4), "astio", "Vérification de l'urgence demandée au professionnel"],
      ]),
    },
    {
      id: "AP-1050",
      clientId: "cl-02",
      receivedAt: t1050,
      durationSec: 187,
      motif: "Chaudière en panne",
      summary: "Chaudière gaz à l'arrêt depuis ce matin : plus de chauffage ni d'eau chaude. Code F28 affiché.",
      description:
        "Le client indique que sa chaudière gaz murale affiche le code F28 depuis ce matin. Plus de chauffage ni d'eau chaude. Il a tenté un redémarrage sans succès. Pas d'odeur de gaz signalée. Foyer avec un nourrisson.",
      interventionType: "Dépannage chaudière gaz",
      address: "8 avenue Roger Salengro, 69100 Villeurbanne",
      clientAvailability: ["Demain matin", "Après-demain après 14 h"],
      estimatedDurationMin: 90,
      missingInfo: ["Marque et modèle de la chaudière"],
      priority: "haute",
      urgencyNote: "Priorité haute suggérée : foyer avec un nourrisson sans chauffage. Aucune odeur de gaz signalée.",
      status: "a_confirmer",
      decision: {
        kind: "choisir_creneau",
        reason:
          "Aucun créneau compatible avec les disponibilités du client ne respecte votre marge de 30 min. Astio suggère le plus proche, avec une marge réduite.",
        expectedAction: "Choisir un créneau parmi les propositions",
      },
      proposedSlots: [
        proposal(workday(1), 8, 0, 90, "serre", "Marge réduite à 30 min avant l'entretien de 10:00"),
        proposal(workday(1), 11, 30, 90, "libre", "Fin de matinée, compatible avec « demain matin »"),
        proposal(workday(2), 14, 0, 90, "libre", "Correspond aux disponibilités annoncées"),
      ],
      agentSteps: steps([
        ["Appel pris en charge", true],
        ["Identité et coordonnées recueillies", true],
        ["Problème identifié : chaudière en défaut (F28)", true],
        ["Absence d'odeur de gaz vérifiée verbalement", true],
        ["Disponibilités du client recueillies", true],
        ["Choix du créneau par le professionnel", false],
      ]),
      transcript: transcript([
        ["astio", "Moreau Plomberie bonjour, je suis Astio, l'assistant de Julien Moreau. Que puis-je faire pour vous ?"],
        ["client", "Bonjour, ma chaudière ne marche plus depuis ce matin, on n'a plus d'eau chaude."],
        ["astio", "Je suis désolé. Avant tout, sentez-vous une odeur de gaz chez vous ?"],
        ["client", "Non, aucune odeur."],
        ["astio", "Très bien. Un code s'affiche-t-il sur la chaudière ?"],
        ["client", "Oui, F28. J'ai essayé de la redémarrer mais rien."],
        ["astio", "Merci. Pouvez-vous me donner votre nom et votre adresse ?"],
        ["client", "Karim Benali, 8 avenue Roger Salengro à Villeurbanne. On a un bébé de trois mois, c'est un peu compliqué sans chauffage."],
        ["astio", "Je le note et je le signale à Julien Moreau. Quelles sont vos disponibilités ?"],
        ["client", "Demain matin, ou après-demain après 14 heures."],
        ["astio", "Je transmets ces informations. Julien Moreau choisira le créneau le plus adapté et vous serez recontacté pour confirmation."],
      ]),
      history: history("AP-1050", [
        [t1050, "client", "Appel reçu", "Durée 3 min 07 s"],
        [plus(t1050, 2), "astio", "Demande qualifiée", "Dépannage chaudière – priorité haute"],
        [plus(t1050, 3), "astio", "3 créneaux préparés", "Aucun ne respecte toutes vos préférences"],
      ]),
    },
    {
      id: "AP-1049",
      clientId: "cl-03",
      receivedAt: t1049,
      durationSec: 242,
      motif: "Devis rénovation salle de bain",
      summary: "Remplacement de la baignoire par une douche à l'italienne. Visite technique souhaitée pour établir un devis.",
      description:
        "La cliente souhaite remplacer sa baignoire par une douche à l'italienne et déplacer l'arrivée d'eau du lavabo. Salle de bain d'environ 6 m² dans un immeuble ancien. Elle souhaite une visite pour obtenir un devis détaillé.",
      interventionType: "Visite technique / devis",
      address: "27 cours Vitton, 69006 Lyon (4e étage avec ascenseur)",
      clientAvailability: ["En fin de journée, en semaine"],
      estimatedDurationMin: 45,
      missingInfo: [],
      priority: "normale",
      urgencyNote: "Aucune urgence : projet de rénovation planifié.",
      status: "a_confirmer",
      decision: {
        kind: "confirmer_creneau",
        reason:
          "La cliente n'est disponible qu'en fin de journée. Le créneau suggéré dépasse vos horaires habituels (fin à 18:00).",
        expectedAction: "Confirmer le rendez-vous",
      },
      proposedSlots: [proposal(workday(2), 17, 30, 45, "serre", "Termine à 18:15, après vos horaires habituels")],
      agentSteps: steps([
        ["Appel pris en charge", true],
        ["Identité et coordonnées recueillies", true],
        ["Projet décrit : douche à l'italienne", true],
        ["Disponibilités de la cliente recueillies", true],
        ["Créneau suggéré d'après ses disponibilités", true],
        ["Décision du professionnel", false],
      ]),
      transcript: transcript([
        ["astio", "Moreau Plomberie bonjour, je suis Astio. Comment puis-je vous aider ?"],
        ["client", "Bonjour, je voudrais un devis pour refaire ma salle de bain. Remplacer la baignoire par une douche à l'italienne."],
        ["astio", "Avec plaisir. Quelle est la surface approximative de la pièce ?"],
        ["client", "À peu près 6 mètres carrés. Et je voudrais aussi déplacer le lavabo."],
        ["astio", "C'est noté. Julien Moreau devra passer pour une visite technique d'environ 45 minutes. Quand êtes-vous disponible ?"],
        ["client", "Plutôt en fin de journée, je travaille."],
        ["astio", "C'est noté. À partir de quelle heure ?"],
        ["client", "17 h 30, idéalement."],
        ["astio", "Votre nom et votre adresse, s'il vous plaît ?"],
        ["client", "Sophie Lambert, 27 cours Vitton, 4e étage, il y a un ascenseur."],
        ["astio", "Merci madame Lambert. Julien Moreau vous confirmera un créneau par SMS au plus vite."],
      ]),
      history: history("AP-1049", [
        [t1049, "client", "Appel reçu", "Durée 4 min 02 s"],
        [plus(t1049, 2), "astio", "Demande qualifiée", "Visite technique pour devis"],
        [plus(t1049, 3), "astio", "Créneau suggéré par Astio", "En attente de votre décision"],
      ]),
    },
    {
      id: "AP-1048",
      clientId: "cl-05",
      receivedAt: t1048,
      durationSec: 128,
      motif: "Déplacement d'un rendez-vous",
      summary: "Ne peut plus être présente pour le remplacement du mitigeur prévu demain. Souhaite décaler en fin de semaine.",
      description:
        "La cliente avait un rendez-vous confirmé pour le remplacement de son mitigeur de douche. Un imprévu professionnel l'empêche d'être présente. Elle souhaite un nouveau créneau en fin de semaine, le matin.",
      interventionType: "Remplacement mitigeur de douche",
      address: "52 rue de la République, 69002 Lyon",
      clientAvailability: ["En fin de semaine, le matin"],
      estimatedDurationMin: 60,
      missingInfo: [],
      priority: "normale",
      urgencyNote: "Aucune urgence : intervention de confort déjà planifiée.",
      status: "a_confirmer",
      appointmentId: "rdv-05",
      decision: {
        kind: "confirmer_creneau",
        reason:
          "Report demandé pour un rendez-vous confirmé. Le rendez-vous actuel reste en place tant que vous n'avez pas confirmé le nouveau créneau.",
        expectedAction: "Confirmer le nouveau créneau",
      },
      proposedSlots: [proposal(nextDow(5), 11, 30, 60, "libre", "Fin de semaine en matinée ; 9:00 – 11:00 déjà occupé")],
      agentSteps: steps([
        ["Appel pris en charge", true],
        ["Rendez-vous existant retrouvé", true],
        ["Motif du report recueilli", true],
        ["Nouvelles disponibilités recueillies", true],
        ["Nouveau créneau suggéré", true],
        ["Décision du professionnel", false],
      ]),
      transcript: transcript([
        ["astio", "Moreau Plomberie bonjour, je suis Astio. Que puis-je faire pour vous ?"],
        ["client", "Bonjour, c'est Nathalie Roux. J'ai rendez-vous demain à 17 heures pour mon mitigeur, mais je ne pourrai pas être là."],
        ["astio", "Je retrouve votre rendez-vous, madame Roux. Souhaitez-vous le décaler ?"],
        ["client", "Oui, plutôt en fin de semaine, le matin si possible."],
        ["astio", "C'est noté. À partir de quelle heure ?"],
        ["client", "Dès 9 heures."],
        ["astio", "Je transmets votre demande à Julien Moreau. Votre rendez-vous actuel reste en place tant qu'il ne vous a pas confirmé le nouvel horaire par SMS."],
      ]),
      history: history("AP-1048", [
        [at(addDays(today, -9), 10), "plombier", "Rendez-vous confirmé", "Remplacement mitigeur – créneau initial"],
        [t1048, "client", "Appel reçu", "Demande de report"],
        [plus(t1048, 2), "astio", "Nouveau créneau suggéré par Astio", "En attente de votre décision"],
      ]),
    },
    {
      id: "AP-1047",
      clientId: "cl-06",
      receivedAt: t1047,
      durationSec: 74,
      motif: "Chasse d'eau qui coule en continu",
      summary: "Chasse d'eau qui coule en permanence. Appel interrompu avant la fin de la collecte des informations.",
      description:
        "Le client signale une chasse d'eau qui coule en continu depuis deux jours. L'appel a été coupé alors qu'il communiquait son adresse : seul le nom de la rue a été recueilli.",
      interventionType: "Réparation mécanisme de chasse d'eau",
      address: "Rue Paul Bert, Lyon 3e (numéro manquant)",
      clientAvailability: [],
      estimatedDurationMin: 45,
      missingInfo: ["Numéro de rue", "Étage et code d'accès", "Disponibilités du client"],
      priority: "normale",
      urgencyNote: "Pas d'urgence apparente, mais surconsommation d'eau probable.",
      status: "a_traiter",
      decision: {
        kind: "completer_infos",
        reason: "L'appel s'est interrompu : l'adresse est incomplète et aucune disponibilité n'a été recueillie.",
        expectedAction: "Rappeler le client pour compléter l'adresse",
      },
      proposedSlots: [],
      agentSteps: steps([
        ["Appel pris en charge", true],
        ["Problème identifié : chasse d'eau", true],
        ["Adresse recueillie partiellement", true],
        ["Disponibilités du client", false],
        ["Rappel du client pour compléter", false],
      ]),
      transcript: transcript([
        ["astio", "Moreau Plomberie bonjour, je suis Astio. Comment puis-je vous aider ?"],
        ["client", "Oui bonjour, Durand. Ma chasse d'eau coule tout le temps depuis deux jours."],
        ["astio", "D'accord monsieur Durand. À quelle adresse se trouve le logement ?"],
        ["client", "Rue Paul Bert, dans le 3e, au numéro…"],
        ["astio", "Excusez-moi, je n'ai pas entendu le numéro. Pouvez-vous répéter ?"],
        ["astio", "Monsieur Durand, m'entendez-vous ? — L'appel a été interrompu."],
      ]),
      history: history("AP-1047", [
        [t1047, "client", "Appel reçu", "Interrompu après 1 min 14 s"],
        [plus(t1047, 2), "astio", "Informations manquantes signalées", "Adresse incomplète"],
      ]),
    },
    {
      id: "AP-1046",
      clientId: "cl-07",
      receivedAt: t1046,
      durationSec: 96,
      motif: "Installation d'une climatisation",
      summary: "Demande de pose d'une climatisation réversible dans un appartement de 70 m².",
      description:
        "Le client souhaite faire installer une climatisation réversible (deux splits) dans son appartement. Il demande un devis et un délai.",
      interventionType: "Climatisation (hors prestations)",
      address: "15 rue Garibaldi, 69003 Lyon",
      clientAvailability: ["Le samedi matin"],
      estimatedDurationMin: 60,
      missingInfo: [],
      priority: "basse",
      urgencyNote: "Aucune urgence.",
      status: "a_traiter",
      decision: {
        kind: "hors_prestations",
        reason:
          "La pose de climatisation ne figure pas dans vos prestations. Astio a indiqué au client que sa demande serait étudiée, sans la refuser.",
        expectedAction: "Donner suite ou classer la demande",
      },
      proposedSlots: [],
      agentSteps: steps([
        ["Appel pris en charge", true],
        ["Identité et coordonnées recueillies", true],
        ["Demande identifiée hors prestations", true],
        ["Décision du professionnel", false],
      ]),
      transcript: transcript([
        ["astio", "Moreau Plomberie bonjour, je suis Astio. Que puis-je faire pour vous ?"],
        ["client", "Bonjour, je voudrais faire installer une clim réversible, deux pièces."],
        ["astio", "Merci. Cette prestation n'est pas habituellement proposée par Julien Moreau, mais je lui transmets votre demande. Puis-je avoir votre nom et votre adresse ?"],
        ["client", "Lucas Martin, 15 rue Garibaldi, Lyon 3e."],
        ["astio", "C'est noté, monsieur Martin. Vous serez recontacté si la demande peut être prise en charge."],
      ]),
      history: history("AP-1046", [
        [t1046, "client", "Appel reçu", "Durée 1 min 36 s"],
        [plus(t1046, 1), "astio", "Demande hors prestations détectée"],
      ]),
    },
    {
      id: "AP-1045",
      clientId: "cl-08",
      receivedAt: t1045,
      durationSec: 41,
      motif: "Démarchage commercial",
      summary: "Proposition commerciale pour des panneaux solaires. Aucune demande d'intervention.",
      description: "Appel d'un démarcheur proposant un partenariat pour la pose de panneaux photovoltaïques.",
      interventionType: "—",
      clientAvailability: [],
      estimatedDurationMin: 0,
      missingInfo: [],
      priority: "basse",
      urgencyNote: "Sans objet.",
      status: "non_qualifie",
      decision: null,
      proposedSlots: [],
      agentSteps: steps([
        ["Appel pris en charge", true],
        ["Démarchage identifié", true],
        ["Appel clôturé poliment", true],
      ]),
      transcript: transcript([
        ["astio", "Moreau Plomberie bonjour, je suis Astio. Comment puis-je vous aider ?"],
        ["client", "Bonjour, Solaris Énergie, nous proposons aux artisans un partenariat sur le photovoltaïque…"],
        ["astio", "Merci pour votre appel. Cette ligne est réservée aux demandes d'intervention. Vous pouvez adresser votre proposition par écrit. Bonne journée."],
      ]),
      history: history("AP-1045", [
        [t1045, "client", "Appel reçu", "Durée 41 s"],
        [plus(t1045, 1), "astio", "Classé non qualifié", "Démarchage commercial"],
      ]),
    },
    {
      id: "AP-1044",
      clientId: "cl-09",
      receivedAt: t1044,
      durationSec: 156,
      motif: "WC qui fuit au pied",
      summary: "Petite fuite au pied des WC. Souhaite vous parler avant de fixer un rendez-vous (réparation ou remplacement).",
      description:
        "La cliente constate une petite fuite au pied de la cuvette, sol humide autour. Elle hésite entre une réparation et le remplacement complet des WC (modèle ancien) et souhaite un avis avant de fixer un rendez-vous.",
      interventionType: "Réparation ou remplacement WC",
      address: "6 rue Masséna, 69006 Lyon",
      clientAvailability: ["En semaine, toute la journée"],
      estimatedDurationMin: 90,
      missingInfo: ["Choix entre réparation et remplacement"],
      priority: "normale",
      urgencyNote: "Pas d'urgence apparente : fuite légère selon la cliente.",
      status: "a_traiter",
      decision: {
        kind: "rappeler",
        reason: "La cliente souhaite échanger avec vous avant de fixer un rendez-vous : elle hésite entre réparation et remplacement.",
        expectedAction: "Rappeler la cliente",
      },
      proposedSlots: [],
      agentSteps: steps([
        ["Appel pris en charge", true],
        ["Identité et coordonnées recueillies", true],
        ["Problème identifié : fuite au pied des WC", true],
        ["Disponibilités de la cliente recueillies", true],
        ["Rappel par le professionnel", false],
      ]),
      transcript: transcript([
        ["astio", "Moreau Plomberie bonjour, je suis Astio. Comment puis-je vous aider ?"],
        ["client", "Bonjour, j'ai une petite fuite au pied de mes toilettes, le sol est humide."],
        ["astio", "D'accord. La fuite est-elle importante ?"],
        ["client", "Non, c'est léger. Mais les toilettes sont vieilles, je me demande s'il vaut mieux tout changer."],
        ["astio", "Souhaitez-vous que Julien Moreau vous rappelle pour en discuter avant de fixer un rendez-vous ?"],
        ["client", "Oui, je préfère. Isabelle Garnier, 6 rue Masséna. Je suis disponible toute la journée."],
        ["astio", "C'est noté, madame Garnier. Julien Moreau vous rappellera."],
      ]),
      history: history("AP-1044", [
        [t1044, "client", "Appel reçu", "Durée 2 min 36 s"],
        [plus(t1044, 2), "astio", "Rappel demandé par la cliente"],
      ]),
    },
    {
      id: "AP-1043",
      clientId: "cl-14",
      receivedAt: t1043,
      durationSec: 168,
      motif: "Fuite sur chauffe-eau",
      summary: "Eau au sol sous le chauffe-eau, groupe de sécurité qui goutte fortement. Intervention avancée.",
      description:
        "Le client a constaté de l'eau au sol sous le chauffe-eau électrique de 150 L. Le groupe de sécurité goutte fortement. Le chauffe-eau a été coupé électriquement sur conseil d'Astio.",
      interventionType: "Dépannage chauffe-eau",
      address: "33 boulevard des Belges, 69006 Lyon",
      clientAvailability: ["Aujourd'hui, toute la journée"],
      estimatedDurationMin: 90,
      missingInfo: [],
      priority: "urgente",
      urgencyNote: "Urgence vérifiée et confirmée par vos soins.",
      status: "rdv_confirme",
      appointmentId: "rdv-08",
      decision: null,
      proposedSlots: [],
      agentSteps: steps([
        ["Appel pris en charge", true],
        ["Identité et coordonnées recueillies", true],
        ["Problème identifié : fuite chauffe-eau", true],
        ["Conseil de couper l'alimentation électrique", true],
        ["Urgence vérifiée par le professionnel", true],
        ["Rendez-vous confirmé", true],
      ]),
      transcript: transcript([
        ["astio", "Moreau Plomberie bonjour, je suis Astio. Comment puis-je vous aider ?"],
        ["client", "Bonjour, il y a de l'eau partout sous mon chauffe-eau, ça goutte du petit robinet en bas."],
        ["astio", "Pour votre sécurité, coupez l'alimentation électrique du chauffe-eau au tableau. Pouvez-vous le faire ?"],
        ["client", "Oui, c'est fait."],
        ["astio", "Merci. Votre nom et votre adresse, s'il vous plaît ?"],
        ["client", "Antoine Mercier, 33 boulevard des Belges."],
        ["astio", "Je signale votre demande comme urgente à Julien Moreau, vous serez recontacté rapidement."],
      ]),
      history: history("AP-1043", [
        [t1043, "client", "Appel reçu", "Durée 2 min 48 s"],
        [plus(t1043, 2), "astio", "Demande qualifiée", "Fuite – urgence probable"],
        [plus(t1043, 12), "plombier", "Urgence confirmée par le professionnel"],
        [plus(t1043, 13), "plombier", "Rendez-vous confirmé", "Aujourd'hui 11:00"],
        [plus(t1043, 13), "astio", "SMS de confirmation envoyé (simulation)"],
      ]),
    },
    {
      id: "AP-1042",
      clientId: "cl-16",
      receivedAt: t1042,
      durationSec: 131,
      motif: "Pose d'un mitigeur thermostatique",
      summary: "Remplacement du mitigeur de baignoire par un mitigeur thermostatique fourni par la cliente.",
      description: "La cliente a acheté un mitigeur thermostatique et souhaite le faire poser à la place de l'ancien mélangeur.",
      interventionType: "Pose de robinetterie",
      address: "5 rue Bossuet, 69006 Lyon",
      clientAvailability: ["En milieu de semaine, l'après-midi"],
      estimatedDurationMin: 60,
      missingInfo: [],
      priority: "normale",
      urgencyNote: "Aucune urgence.",
      status: "a_confirmer",
      decision: {
        kind: "confirmer_creneau",
        reason: "Astio suggère ce créneau d'après les disponibilités de la cliente (milieu de semaine, l'après-midi).",
        expectedAction: "Confirmer le créneau",
      },
      proposedSlots: [proposal(workday(3), 14, 0, 60, "libre", "Correspond à « milieu de semaine, l'après-midi »")],
      agentSteps: steps([
        ["Appel pris en charge", true],
        ["Identité et coordonnées recueillies", true],
        ["Disponibilités recueillies", true],
        ["Décision du professionnel", false],
      ]),
      transcript: transcript([
        ["astio", "Moreau Plomberie bonjour, je suis Astio. Que puis-je faire pour vous ?"],
        ["client", "Bonjour, j'ai acheté un mitigeur thermostatique pour ma baignoire, il faudrait le poser."],
        ["astio", "Avec plaisir. Quelles sont vos disponibilités ?"],
        ["client", "En milieu de semaine, plutôt l'après-midi."],
        ["astio", "C'est noté. Julien Moreau vous confirmera un créneau par SMS. Puis-je avoir votre nom et votre adresse ?"],
        ["client", "Camille Bernard, 5 rue Bossuet."],
      ]),
      history: history("AP-1042", [
        [t1042, "client", "Appel reçu", "Durée 2 min 11 s"],
        [plus(t1042, 2), "astio", "Créneau suggéré par Astio", "En attente de votre décision"],
      ]),
    },
    {
      id: "AP-1041",
      clientId: "cl-10",
      receivedAt: t1041,
      durationSec: 176,
      motif: "Remplacement chauffe-eau",
      summary: "Chauffe-eau de 15 ans en fin de vie, eau tiède. Remplacement par un modèle 200 L.",
      description: "Le client souhaite remplacer son chauffe-eau électrique de 200 L installé il y a 15 ans. L'eau ne chauffe plus suffisamment.",
      interventionType: "Remplacement chauffe-eau",
      address: "41 rue Inkermann, 69006 Lyon",
      clientAvailability: ["Demain après-midi"],
      estimatedDurationMin: 150,
      missingInfo: [],
      priority: "normale",
      urgencyNote: "Aucune urgence : eau chaude encore disponible.",
      status: "rdv_confirme",
      appointmentId: "rdv-04",
      decision: null,
      proposedSlots: [],
      agentSteps: steps([
        ["Appel pris en charge", true],
        ["Identité et coordonnées recueillies", true],
        ["Besoin identifié : remplacement 200 L", true],
        ["Disponibilités recueillies", true],
        ["Rendez-vous confirmé par le professionnel", true],
      ]),
      transcript: transcript([
        ["astio", "Moreau Plomberie bonjour, je suis Astio. Comment puis-je vous aider ?"],
        ["client", "Bonjour, mon chauffe-eau a quinze ans, l'eau est à peine tiède. Je voudrais le remplacer."],
        ["astio", "Quelle est sa capacité ?"],
        ["client", "200 litres."],
        ["astio", "Quand êtes-vous disponible ? L'intervention dure environ deux heures et demie."],
        ["client", "Demain après-midi. Thomas Girard, 41 rue Inkermann."],
        ["astio", "Merci monsieur Girard. Julien Moreau vous confirmera l'horaire par SMS."],
      ]),
      history: history("AP-1041", [
        [t1041, "client", "Appel reçu"],
        [plus(t1041, 3), "plombier", "Créneau confirmé"],
        [plus(t1041, 3), "astio", "SMS de confirmation envoyé (simulation)"],
      ]),
    },
    {
      id: "AP-1040",
      clientId: "cl-12",
      receivedAt: t1040,
      durationSec: 112,
      motif: "Demande de tarifs",
      summary: "Renseignement sur le prix d'un déplacement et d'un débouchage. Tarifs indicatifs communiqués.",
      description: "Le client souhaitait connaître le coût indicatif d'un déplacement et d'un débouchage de canalisation. Il rappellera s'il a besoin d'une intervention.",
      interventionType: "Renseignement",
      clientAvailability: [],
      estimatedDurationMin: 0,
      missingInfo: [],
      priority: "basse",
      urgencyNote: "Sans objet.",
      status: "termine",
      decision: null,
      proposedSlots: [],
      agentSteps: steps([
        ["Appel pris en charge", true],
        ["Tarifs indicatifs communiqués", true],
        ["Demande clôturée sans rendez-vous", true],
      ]),
      transcript: transcript([
        ["astio", "Moreau Plomberie bonjour, je suis Astio. Que puis-je faire pour vous ?"],
        ["client", "Bonjour, combien coûte un déplacement pour un débouchage ?"],
        ["astio", "À titre indicatif, le déplacement est facturé 49 € et un débouchage simple à partir de 90 €. Le prix exact dépend de la situation sur place."],
        ["client", "Merci, je vous rappellerai si besoin."],
      ]),
      history: history("AP-1040", [
        [t1040, "client", "Appel reçu"],
        [plus(t1040, 2), "astio", "Dossier terminé", "Renseignement sans rendez-vous"],
      ]),
    },
    {
      id: "AP-1039",
      clientId: "cl-13",
      receivedAt: t1039,
      durationSec: 98,
      motif: "Robinet qui goutte",
      summary: "Robinet de cuisine qui goutte en permanence. Remplacement de la cartouche probable.",
      description: "Le mitigeur de cuisine goutte même fermé. La cliente souhaite une réparation simple.",
      interventionType: "Réparation robinetterie",
      address: "18 rue Ney, 69006 Lyon",
      clientAvailability: ["En fin de semaine, en matinée"],
      estimatedDurationMin: 45,
      missingInfo: [],
      priority: "basse",
      urgencyNote: "Aucune urgence.",
      status: "rdv_confirme",
      appointmentId: "rdv-07",
      decision: null,
      proposedSlots: [],
      agentSteps: steps([
        ["Appel pris en charge", true],
        ["Problème identifié : robinet qui goutte", true],
        ["Disponibilités recueillies", true],
        ["Rendez-vous confirmé par le professionnel", true],
      ]),
      transcript: transcript([
        ["astio", "Moreau Plomberie bonjour, je suis Astio. Comment puis-je vous aider ?"],
        ["client", "Mon robinet de cuisine goutte tout le temps."],
        ["astio", "Quelles sont vos disponibilités ?"],
        ["client", "En fin de semaine, en matinée. Marie Dubois, 18 rue Ney."],
        ["astio", "Merci, vous recevrez un SMS de confirmation."],
      ]),
      history: history("AP-1039", [
        [t1039, "client", "Appel reçu"],
        [plus(t1039, 2), "plombier", "Créneau confirmé"],
        [plus(t1039, 2), "astio", "SMS de confirmation envoyé (simulation)"],
      ]),
    },
    {
      id: "AP-1038",
      clientId: "cl-04",
      receivedAt: at(addDays(today, -1), 16, 10),
      durationSec: 104,
      motif: "Entretien annuel chaudière",
      summary: "Entretien annuel obligatoire de la chaudière gaz.",
      description: "Le client demande l'entretien annuel de sa chaudière gaz, effectué l'an dernier par Moreau Plomberie.",
      interventionType: "Entretien chaudière",
      address: "3 place Jean Macé, 69007 Lyon",
      clientAvailability: ["Demain en matinée"],
      estimatedDurationMin: 60,
      missingInfo: [],
      priority: "basse",
      urgencyNote: "Aucune urgence.",
      status: "rdv_confirme",
      appointmentId: "rdv-03",
      decision: null,
      proposedSlots: [],
      agentSteps: steps([
        ["Appel pris en charge", true],
        ["Client identifié", true],
        ["Disponibilités recueillies", true],
        ["Rendez-vous confirmé par le professionnel", true],
      ]),
      transcript: transcript([
        ["astio", "Moreau Plomberie bonjour, je suis Astio. Que puis-je faire pour vous ?"],
        ["client", "Bonjour, c'est pour l'entretien annuel de ma chaudière. Gérard Petit, place Jean Macé."],
        ["astio", "Quand êtes-vous disponible ?"],
        ["client", "Demain en matinée."],
        ["astio", "C'est noté, Julien Moreau vous confirmera l'horaire par SMS."],
      ]),
      history: history("AP-1038", [
        [at(addDays(today, -1), 16, 10), "client", "Appel reçu"],
        [at(addDays(today, -1), 16, 12), "plombier", "Créneau confirmé"],
        [at(addDays(today, -1), 16, 12), "astio", "SMS de confirmation envoyé (simulation)"],
      ]),
    },
    {
      id: "AP-1037",
      clientId: "cl-15",
      receivedAt: t1037,
      durationSec: 22,
      motif: "Erreur de numéro",
      summary: "L'appelant cherchait à joindre un cabinet médical.",
      description: "Appel sans rapport avec l'activité.",
      interventionType: "—",
      clientAvailability: [],
      estimatedDurationMin: 0,
      missingInfo: [],
      priority: "basse",
      urgencyNote: "Sans objet.",
      status: "non_qualifie",
      decision: null,
      proposedSlots: [],
      agentSteps: steps([
        ["Appel pris en charge", true],
        ["Erreur de numéro identifiée", true],
      ]),
      transcript: transcript([
        ["astio", "Moreau Plomberie bonjour, je suis Astio."],
        ["client", "Ah pardon, je cherchais le cabinet du docteur Lemaire."],
        ["astio", "Il s'agit d'une entreprise de plomberie. Bonne journée."],
      ]),
      history: history("AP-1037", [
        [t1037, "client", "Appel reçu"],
        [plus(t1037, 1), "astio", "Classé non qualifié", "Erreur de numéro"],
      ]),
    },
    {
      id: "AP-1036",
      clientId: "cl-11",
      receivedAt: at(addDays(today, -2), 8, 15),
      durationSec: 119,
      motif: "Évier bouché",
      summary: "Évier de cuisine complètement bouché, l'eau ne s'évacue plus.",
      description: "Évacuation de l'évier bouchée malgré l'utilisation d'un déboucheur chimique.",
      interventionType: "Débouchage",
      address: "9 rue Dumenge, 69004 Lyon",
      clientAvailability: ["Dès que possible"],
      estimatedDurationMin: 60,
      missingInfo: [],
      priority: "normale",
      urgencyNote: "Gêne importante mais pas d'urgence.",
      status: "termine",
      appointmentId: "rdv-06",
      decision: null,
      proposedSlots: [],
      agentSteps: steps([
        ["Appel pris en charge", true],
        ["Rendez-vous confirmé", true],
        ["Intervention réalisée", true],
      ]),
      transcript: transcript([
        ["astio", "Moreau Plomberie bonjour, je suis Astio."],
        ["client", "Bonjour, mon évier est complètement bouché."],
        ["astio", "Quand êtes-vous disponible ?"],
        ["client", "Dès que possible, demain matin. Émilie Chevalier, 9 rue Dumenge."],
      ]),
      history: history("AP-1036", [
        [at(addDays(today, -2), 8, 15), "client", "Appel reçu"],
        [at(addDays(today, -2), 8, 17), "plombier", "Créneau confirmé"],
        [at(addDays(today, -2), 8, 17), "astio", "SMS de confirmation envoyé (simulation)"],
        [plus(appointments[5].end, 5), "plombier", "Intervention réalisée", "Dossier terminé"],
      ]),
    },
    {
      id: "AP-1033",
      clientId: "cl-17",
      receivedAt: at(addDays(today, -4), 10),
      durationSec: 205,
      motif: "Recherche de fuite",
      summary: "Facture d'eau anormalement élevée, suspicion de fuite non visible.",
      description: "Le client a reçu une facture d'eau trois fois supérieure à la normale. Aucune fuite visible.",
      interventionType: "Recherche de fuite",
      address: "22 rue Paul Bert, 69003 Lyon",
      clientAvailability: ["En début d'après-midi"],
      estimatedDurationMin: 120,
      missingInfo: [],
      priority: "normale",
      urgencyNote: "Pas d'urgence immédiate.",
      status: "termine",
      appointmentId: "rdv-10",
      decision: null,
      proposedSlots: [],
      agentSteps: steps([
        ["Appel pris en charge", true],
        ["Rendez-vous confirmé", true],
        ["Intervention réalisée", true],
      ]),
      transcript: transcript([
        ["astio", "Moreau Plomberie bonjour, je suis Astio."],
        ["client", "Bonjour, ma facture d'eau a triplé, je pense qu'il y a une fuite quelque part."],
        ["astio", "Quand êtes-vous disponible pour une recherche de fuite ?"],
        ["client", "En début d'après-midi. Hugo Fournier, 22 rue Paul Bert."],
      ]),
      history: history("AP-1033", [
        [at(addDays(today, -4), 10), "client", "Appel reçu"],
        [at(addDays(today, -4), 10, 4), "plombier", "Rendez-vous confirmé"],
        [at(addDays(today, -4), 10, 4), "astio", "SMS de confirmation envoyé (simulation)"],
        [plus(appointments[9].end, 5), "plombier", "Intervention réalisée", "Dossier terminé"],
      ]),
    },
    {
      id: "AP-1012",
      clientId: "cl-01",
      receivedAt: at(addDays(today, -21), 9),
      durationSec: 140,
      motif: "Détartrage chauffe-eau",
      summary: "Détartrage du chauffe-eau électrique.",
      description: "Entretien et détartrage du chauffe-eau de 100 L.",
      interventionType: "Entretien chauffe-eau",
      address: "14 rue Duguesclin, 69006 Lyon",
      clientAvailability: [],
      estimatedDurationMin: 90,
      missingInfo: [],
      priority: "basse",
      urgencyNote: "Aucune urgence.",
      status: "termine",
      appointmentId: "rdv-11",
      decision: null,
      proposedSlots: [],
      agentSteps: steps([
        ["Appel pris en charge", true],
        ["Rendez-vous confirmé", true],
        ["Intervention réalisée", true],
      ]),
      transcript: transcript([
        ["astio", "Moreau Plomberie bonjour, je suis Astio."],
        ["client", "Bonjour, je voudrais faire détartrer mon chauffe-eau."],
        ["astio", "Quand êtes-vous disponible ?"],
        ["client", "Le matin, plutôt. Claire Fontaine, rue Duguesclin."],
      ]),
      history: history("AP-1012", [
        [at(addDays(today, -21), 9), "client", "Appel reçu"],
        [at(addDays(today, -21), 9, 3), "plombier", "Créneau confirmé"],
        [at(addDays(today, -21), 9, 3), "astio", "SMS de confirmation envoyé (simulation)"],
        [plus(appointments[10].end, 5), "plombier", "Intervention réalisée", "Dossier terminé"],
      ]),
    },
  ];

  return {
    version: STATE_VERSION,
    seededOn: dayKey(today),
    clients,
    calls,
    appointments,
    settings: DEFAULT_SETTINGS,
  };
}

export const DEFAULT_SETTINGS: Settings = {
  profile: {
    name: "Julien Moreau",
    company: "Moreau Plomberie",
    phone: "0671254890",
    zone: "Lyon 2e, 3e, 4e, 6e, 7e et Villeurbanne",
    services: [
      "Dépannage et recherche de fuite",
      "Chaudière gaz : dépannage et entretien",
      "Chauffe-eau : pose et entretien",
      "Robinetterie et sanitaires",
      "Débouchage de canalisations",
      "Rénovation de salle de bain",
    ],
  },
  hours: {
    workdays: [1, 2, 3, 4, 5],
    start: "08:00",
    end: "18:00",
    breakStart: "12:30",
    breakEnd: "13:30",
    defaultDurationMin: 60,
    bufferMin: 30,
    emergencySlots: ["Lundi au vendredi, 18:00 – 19:00"],
  },
  handling: {
    smsOnDecision: true,
    flagUrgent: true,
    priorityTopics: ["Fuite d'eau", "Panne de chauffage ou d'eau chaude", "Dégât des eaux"],
  },
};
