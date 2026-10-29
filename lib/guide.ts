/**
 * Contenu du guide intégré (bulle « Aide »). Des réponses écrites à la
 * main, pas une IA : le guide cherche la fiche la plus proche des mots
 * de la question, et le dit quand il n'en trouve pas.
 *
 * Une fiche décrit ce que l'écran fait vraiment. Si une page change,
 * sa fiche change dans le même commit.
 */

export type EspaceGuide = "plombier" | "admin";

export type Fiche = {
  id: string;
  question: string;
  reponse: string[];                         // un paragraphe par entrée
  liens?: { href: string; libelle: string }[];
  motsCles: string[];
  espaces: EspaceGuide[];
  pages?: string[];                          // pages où la fiche est suggérée
};

const P: EspaceGuide[] = ["plombier"];
const A: EspaceGuide[] = ["admin"];
const TOUS: EspaceGuide[] = ["plombier", "admin"];

export const FICHES: Fiche[] = [
  // --- Prise en main --------------------------------------------------
  {
    id: "connexion",
    question: "Comment se connecter ?",
    reponse: [
      "Saisissez votre adresse e-mail sur la page d'accueil : un code à usage unique vous est envoyé. Il n'y a pas de mot de passe.",
      "L'adresse décide de l'espace ouvert : celle d'un administrateur ouvre l'administration, celle d'un plombier ouvre l'espace de son entreprise. Une adresse inconnue n'ouvre rien.",
    ],
    motsCles: ["connexion", "connecter", "code", "mot de passe", "login", "identifiant", "acces", "email", "e-mail"],
    espaces: TOUS,
  },
  {
    id: "tour",
    question: "Que contient chaque page ?",
    reponse: [
      "Vue d'ensemble : la journée, les chiffres des 7 derniers jours et le calendrier de la semaine.",
      "Appels : tout ce que l'assistant a pris au téléphone. À rappeler : les personnes qui attendent votre rappel. Rendez-vous et Planning : les interventions, en liste ou en semaine. Clients : l'historique de chaque appelant. Réglages : vos horaires et votre secteur.",
    ],
    liens: [
      { href: "/demandes", libelle: "Vue d'ensemble" },
      { href: "/rappels", libelle: "À rappeler" },
      { href: "/agenda", libelle: "Planning" },
    ],
    motsCles: ["page", "menu", "navigation", "commencer", "debut", "tour", "aide", "fonctionne", "utiliser", "guide"],
    espaces: P,
    pages: ["/demandes"],
  },
  {
    id: "tour-admin",
    question: "Que contient l'administration ?",
    reponse: [
      "Vue d'ensemble : les chiffres de toute la plateforme et les entreprises qui demandent de l'attention.",
      "Entreprises : la liste des clients ChantierPilot et la fiche de chacun. Appels, Rappels, Rendez-vous : la supervision de toutes les entreprises, avec un filtre par entreprise. Comptes et accès : administrateurs et comptes plombiers.",
    ],
    liens: [
      { href: "/admin/entreprises", libelle: "Entreprises" },
      { href: "/admin/comptes", libelle: "Comptes et accès" },
    ],
    motsCles: ["page", "menu", "navigation", "commencer", "tour", "aide", "administration", "admin", "utiliser", "guide"],
    espaces: A,
    pages: ["/admin"],
  },

  // --- Accueil ----------------------------------------------------------
  {
    id: "chiffres",
    question: "D'où viennent les chiffres de l'accueil ?",
    reponse: [
      "Ils sont calculés en base à chaque ouverture, sur votre seule entreprise. « 7 derniers jours » compte à partir de minuit, heure de Paris, il y a six jours.",
      "« Appels traités » regroupe les appels qui n'attendent plus rien de vous (rendez-vous pris, client renseigné, hors secteur…). « Traités par l'assistant sans vous solliciter » applique la même règle aux appels du jour.",
    ],
    motsCles: ["chiffre", "indicateur", "kpi", "statistique", "7 jours", "semaine", "traite", "compteur", "calcul"],
    espaces: TOUS,
    pages: ["/demandes", "/admin"],
  },
  {
    id: "calendrier",
    question: "Comment lire le calendrier ?",
    reponse: [
      "Une colonne par jour, en heure de Paris ; la ligne rouge marque l'heure actuelle. Les flèches changent de semaine, « Aujourd'hui » y revient.",
      "Bloc plein : confirmé. Bloc orange en pointillés : à confirmer. Bloc gris : réalisé. Une bordure en tirets signale un rendez-vous saisi à la main plutôt que pris par l'assistant. Cliquez un bloc pour ouvrir la demande.",
    ],
    liens: [{ href: "/agenda", libelle: "Ouvrir le Planning" }],
    motsCles: ["calendrier", "planning", "semaine", "agenda", "couleur", "pointille", "tiret", "ligne rouge", "bloc"],
    espaces: P,
    pages: ["/demandes", "/agenda"],
  },

  // --- Appels -------------------------------------------------------------
  {
    id: "rechercher",
    question: "Comment retrouver un appel ?",
    reponse: [
      "Tapez un nom ou un numéro dans la barre de recherche en haut de l'écran, puis Entrée : la recherche porte sur tout l'historique.",
      "Le numéro peut être saisi avec ou sans espaces, en entier ou en partie (« 2001 » trouve un numéro qui contient 20 01). Sur la page Appels, les filtres de période, de statut et de résultat affinent la liste.",
    ],
    liens: [{ href: "/appels", libelle: "Appels" }],
    motsCles: ["rechercher", "recherche", "trouver", "retrouver", "numero", "nom", "chercher", "filtre", "appel"],
    espaces: TOUS,
    pages: ["/appels", "/admin/appels"],
  },
  {
    id: "periode",
    question: "Pourquoi je ne vois que 7 jours d'appels ?",
    reponse: [
      "C'est la période par défaut, pour garder la liste courte. Changez « Période » : aujourd'hui, 30 jours, 90 jours, tout l'historique ou des dates précises.",
      "Une recherche lancée depuis la barre du haut passe automatiquement sur tout l'historique.",
    ],
    motsCles: ["7 jours", "periode", "ancien", "historique", "date", "manque", "vieux", "mois"],
    espaces: TOUS,
    pages: ["/appels", "/admin/appels"],
  },
  {
    id: "statuts-appel",
    question: "Que veulent dire les statuts d'un appel ?",
    reponse: [
      "Statut : « Rappel nécessaire » si quelqu'un attend votre rappel, « Traité » si l'appel n'attend plus rien, « En cours » si la conversation n'est pas terminée, « Appel échoué » si elle n'a pas abouti.",
      "Résultat : ce que l'appel a produit (RDV pris, À rappeler, Renseigné, Hors secteur, Sans suite, Transféré). « Non déterminé » signifie que l'assistant n'a pas enregistré de résultat : on ne le devine pas.",
    ],
    motsCles: ["statut", "resultat", "traite", "rappel necessaire", "echoue", "en cours", "non determine", "signifie", "veut dire"],
    espaces: TOUS,
    pages: ["/appels", "/admin/appels"],
  },
  {
    id: "detail-appel",
    question: "Que montre le détail d'un appel ?",
    reponse: [
      "Le résumé de la conversation, la transcription quand elle existe, l'appelant, la durée, et ce qui en est sorti : rendez-vous lié et rappels.",
      "Si un rappel est ouvert pour cet appel, vous pouvez le traiter directement depuis cette page.",
    ],
    motsCles: ["detail", "transcription", "conversation", "resume", "ecouter", "fiche appel", "ouvrir appel"],
    espaces: TOUS,
  },

  // --- Rappels --------------------------------------------------------------
  {
    id: "rappel-cree",
    question: "D'où viennent les rappels ?",
    reponse: [
      "Un rappel est créé automatiquement quand l'assistant conclut qu'un appelant doit être rappelé (devis, aucun créneau ne convenait, appel interrompu…). Il se ferme tout seul si la demande aboutit à un rendez-vous.",
      "Ils sont triés par priorité, puis par échéance ; « En retard » signale une échéance dépassée.",
    ],
    liens: [{ href: "/rappels", libelle: "À rappeler" }],
    motsCles: ["rappel", "rappeler", "cree", "pourquoi", "vient", "priorite", "retard", "automatique"],
    espaces: TOUS,
    pages: ["/rappels", "/admin/rappels", "/demandes"],
  },
  {
    id: "rappel-traiter",
    question: "Comment traiter un rappel ?",
    reponse: [
      "Appelez la personne depuis votre téléphone (le numéro est cliquable sur mobile), puis :",
      "« Marquer effectué » avec une note facultative ; « Reporter » à une date future (demain 9 h par défaut) ; « Abandonner » si le rappel n'a plus lieu d'être. Un rappel traité reste visible dans l'onglet « Traités » et peut être remis à faire.",
      "ChantierPilot ne passe aucun appel lui-même : il enregistre ce que vous avez fait.",
    ],
    liens: [{ href: "/rappels", libelle: "À rappeler" }],
    motsCles: ["traiter", "effectue", "fait", "reporter", "abandonner", "note", "rappel", "rappeler", "marquer", "remettre"],
    espaces: TOUS,
    pages: ["/rappels", "/admin/rappels", "/demandes"],
  },
  {
    id: "compteur",
    question: "À quoi correspond le chiffre orange dans le menu ?",
    reponse: [
      "C'est le nombre de rappels encore ouverts (à faire ou reportés). Il est recalculé à chaque changement de page.",
    ],
    motsCles: ["chiffre", "orange", "pastille", "badge", "compteur", "menu", "nombre"],
    espaces: TOUS,
  },

  // --- Rendez-vous ------------------------------------------------------------
  {
    id: "statuts-rdv",
    question: "Que veulent dire les statuts d'un rendez-vous ?",
    reponse: [
      "Confirmé : la base l'enregistre comme confirmé. En attente : tout le reste, y compris quand l'information manque — un rendez-vous n'est jamais affiché « confirmé » sans preuve.",
      "Terminé : marqué comme réalisé. Annulé : annulé avec un motif. Échec de création : l'assistant n'a pas réussi à l'enregistrer, à reprendre à la main.",
    ],
    motsCles: ["statut", "confirme", "attente", "annule", "termine", "echec", "rendez-vous", "rdv", "signifie"],
    espaces: TOUS,
    pages: ["/rendez-vous", "/agenda", "/admin/rendez-vous"],
  },
  {
    id: "rdv-actions",
    question: "Comment confirmer, terminer ou annuler un rendez-vous ?",
    reponse: [
      "Dans Rendez-vous, chaque ligne propose les actions possibles selon son statut : « Confirmer » pour un rendez-vous en attente, « Terminer » une fois l'intervention faite, « Annuler » avec un motif.",
      "Attention : le client n'est pas prévenu automatiquement d'une annulation. Appelez-le.",
    ],
    liens: [{ href: "/rendez-vous", libelle: "Rendez-vous" }],
    motsCles: ["confirmer", "terminer", "annuler", "annulation", "rendez-vous", "rdv", "intervention", "modifier"],
    espaces: TOUS,
    pages: ["/rendez-vous", "/admin/rendez-vous"],
  },
  {
    id: "rdv-ajouter",
    question: "Comment ajouter un rendez-vous moi-même ?",
    reponse: [
      "Planning → « Ajouter un rendez-vous ». Le créneau devient aussitôt indisponible pour l'assistant téléphonique.",
      "Ces rendez-vous apparaissent avec une bordure en tirets et la mention « Saisi à la main ».",
    ],
    liens: [{ href: "/rendez-vous/nouveau", libelle: "Ajouter un rendez-vous" }],
    motsCles: ["ajouter", "creer", "nouveau", "saisir", "main", "manuel", "rendez-vous", "rdv", "bloquer", "creneau"],
    espaces: P,
    pages: ["/agenda", "/rendez-vous"],
  },
  {
    id: "planning-filtre",
    question: "Comment voir le planning d'un seul plombier ?",
    reponse: [
      "En haut du Planning, chaque plombier de l'entreprise a sa pastille de couleur. Cliquez une pastille pour masquer ou afficher ses rendez-vous.",
    ],
    liens: [{ href: "/agenda", libelle: "Planning" }],
    motsCles: ["plombier", "collegue", "technicien", "filtre", "masquer", "couleur", "pastille", "equipe"],
    espaces: P,
    pages: ["/agenda"],
  },

  // --- Clients et réglages -----------------------------------------------------
  {
    id: "clients",
    question: "À quoi sert la page Clients ?",
    reponse: [
      "Elle regroupe les personnes qui ont appelé : coordonnées, nombre d'appels, prochain rendez-vous et rappels en attente. La fiche d'un client montre tout son historique.",
      "Les fiches se construisent à partir des appels : il n'y a rien à saisir. La recherche accepte un nom, un numéro, une adresse ou une commune.",
    ],
    liens: [{ href: "/clients", libelle: "Clients" }],
    motsCles: ["client", "fiche", "historique", "particulier", "appelant", "adresse", "commune"],
    espaces: P,
    pages: ["/clients"],
  },
  {
    id: "reglages",
    question: "Comment changer mes horaires ou mon secteur ?",
    reponse: [
      "Réglages → « Vos horaires » et « Secteur d'intervention ». L'assistant ne propose que des créneaux dans ces horaires et n'accepte que les adresses de ces communes.",
      "Les autres informations du compte (nom, e-mail, entreprise) sont gérées par l'équipe ChantierPilot.",
    ],
    liens: [{ href: "/reglages", libelle: "Réglages" }],
    motsCles: ["horaire", "secteur", "commune", "reglage", "parametre", "disponibilite", "zone", "ville", "conge"],
    espaces: P,
    pages: ["/reglages"],
  },
  {
    id: "assistant",
    question: "Comment fonctionne l'assistant téléphonique ?",
    reponse: [
      "Quand un client appelle votre numéro, l'assistant vocal décroche, comprend la demande, vérifie l'adresse et propose un créneau libre dans vos horaires.",
      "Chaque appel apparaît ensuite dans Appels avec son résumé. S'il n'a pas pu conclure, il crée un rappel pour vous.",
    ],
    motsCles: ["assistant", "ia", "vocal", "telephone", "decroche", "repond", "standard", "automatique", "robot"],
    espaces: P,
  },
  {
    id: "donnees",
    question: "Qui peut voir mes données ?",
    reponse: [
      "Les comptes de votre entreprise, et l'équipe ChantierPilot pour le support. Une autre entreprise ne voit jamais vos appels, clients ou rendez-vous : la base refuse la lecture, quel que soit l'écran.",
    ],
    motsCles: ["donnees", "confidentialite", "securite", "voir", "acces", "prive", "rgpd", "autre entreprise"],
    espaces: P,
  },

  // --- Administration ----------------------------------------------------------
  {
    id: "admin-entreprise",
    question: "Comment créer ou modifier une entreprise ?",
    reponse: [
      "Entreprises → « Nouvelle entreprise », ou « Modifier » sur la fiche d'une entreprise. Le nom est obligatoire ; e-mail et téléphone sont vérifiés.",
      "Statuts : Essai, Actif, Suspendu, Résilié. Il n'y a pas de suppression : résilier conserve toutes les données, consultables ensuite.",
    ],
    liens: [{ href: "/admin/entreprises", libelle: "Entreprises" }],
    motsCles: ["entreprise", "creer", "nouvelle", "modifier", "statut", "suspendre", "resilier", "supprimer", "client"],
    espaces: A,
    pages: ["/admin/entreprises"],
  },
  {
    id: "admin-plombier",
    question: "Comment ajouter un compte plombier ?",
    reponse: [
      "Comptes et accès → Comptes plombiers → « Ajouter un compte », ou l'onglet Comptes d'une fiche entreprise. Indiquez l'entreprise, le nom, le rôle et l'adresse e-mail de connexion (unique).",
      "Le plombier se connecte ensuite avec cette adresse et un code reçu par e-mail. Désactiver un compte coupe son accès sans effacer ses données.",
    ],
    liens: [{ href: "/admin/comptes", libelle: "Comptes et accès" }],
    motsCles: ["plombier", "compte", "ajouter", "creer", "utilisateur", "acces", "desactiver", "technicien", "inviter"],
    espaces: A,
    pages: ["/admin/comptes", "/admin/entreprises"],
  },
  {
    id: "admin-admin",
    question: "Comment ajouter un administrateur ?",
    reponse: [
      "Comptes et accès → « Ajouter un administrateur » : un nom et une adresse e-mail suffisent. La personne se connecte avec un code reçu par e-mail, sans mot de passe.",
      "Vous ne pouvez pas retirer votre propre accès, et il reste toujours au moins un administrateur actif.",
    ],
    liens: [{ href: "/admin/comptes", libelle: "Comptes et accès" }],
    motsCles: ["administrateur", "admin", "ajouter", "retirer", "droit", "role", "equipe", "permission"],
    espaces: A,
    pages: ["/admin/comptes"],
  },
  {
    id: "admin-supervision",
    question: "Comment surveiller une entreprise en particulier ?",
    reponse: [
      "Ouvrez sa fiche dans Entreprises : onglets Aperçu, Appels, Rappels, Rendez-vous et Comptes. Les pages Appels, Rappels et Rendez-vous de l'administration ont aussi un filtre « Entreprise ».",
      "La vue d'ensemble signale les entreprises sans appel depuis 7 jours et les webhooks en erreur.",
    ],
    liens: [{ href: "/admin/entreprises", libelle: "Entreprises" }],
    motsCles: ["surveiller", "superviser", "entreprise", "filtre", "fiche", "probleme", "erreur", "webhook", "sans appel"],
    espaces: A,
  },
  {
    id: "admin-demo",
    question: "Que signifie le badge « Démo » ?",
    reponse: [
      "Il marque les entreprises de démonstration, aux données entièrement fictives (numéros réservés à la fiction, adresses e-mail en .invalid). Elles servent aux tests et aux présentations.",
    ],
    motsCles: ["demo", "demonstration", "fictif", "test", "badge", "faux"],
    espaces: TOUS,
  },
];

/** Minuscules, sans accents ni ponctuation. */
export function normaliser(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 -]/g, " ").replace(/\s+/g, " ").trim();
}

const VIDES = new Set(["le", "la", "les", "un", "une", "des", "de", "du", "je", "j", "on", "il",
  "est", "a", "au", "aux", "et", "ou", "en", "mon", "ma", "mes", "ce", "cet", "cette", "que",
  "qui", "quoi", "comment", "pourquoi", "dans", "sur", "pour", "par", "pas", "ne", "se", "me",
  "faire", "peux", "puis", "veux", "est-ce", "c", "l", "d", "qu", "y", "il", "ca"]);

/**
 * Fiches les plus proches d'une question. Un mot-clé compte double
 * quand il figure en entier ; les mots de la question de la fiche
 * comptent une fois. Score nul : aucune fiche, on le dit.
 */
export function chercher(question: string, espace: EspaceGuide, max = 3): Fiche[] {
  const q = normaliser(question);
  const mots = q.split(" ").filter((m) => m.length >= 2 && !VIDES.has(m));
  if (mots.length === 0) return [];
  const proche = (a: string, b: string) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));

  return FICHES
    .filter((f) => f.espaces.includes(espace))
    .map((f) => {
      let score = 0;
      for (const cle of f.motsCles.map(normaliser)) {
        if (cle.includes(" ") ? q.includes(cle) : mots.some((m) => proche(m, cle))) score += 2;
      }
      const titre = normaliser(f.question).split(" ");
      score += mots.filter((m) => titre.some((t) => proche(m, t))).length;
      return { f, score };
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.f);
}

/** Questions suggérées pour la page ouverte. */
export function suggestions(chemin: string, espace: EspaceGuide, max = 4): Fiche[] {
  const dEspace = FICHES.filter((f) => f.espaces.includes(espace));
  const ici = dEspace.filter((f) => f.pages?.some((p) => chemin === p || chemin.startsWith(p + "/")));
  const reste = dEspace.filter((f) => !ici.includes(f));
  return [...ici, ...reste].slice(0, max);
}
