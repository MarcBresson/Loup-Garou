import { MULTI_PACKS, DUPLICABLES } from "./rolesData.js";

/**
 * @typedef {{name:string, origin?:string, camp?:string, balance?:number}} Role
 * @typedef {{id:string, title:string, roles:string[], note?:string}} Composition
 */

export function recommendedWolfCount(nPlayers) {
  // Règle simple et robuste (sans rentrer dans les variantes officielles) :
  // 6-7 => 1 loup
  // 8-11 => 2 loups
  // 12-15 => 3 loups
  // 16-18 => 4 loups
  if (nPlayers <= 7) return 1;
  if (nPlayers <= 11) return 2;
  if (nPlayers <= 15) return 3;
  return 4;
}

export function expandPacks(roleNames) {
  /** @type {string[]} */
  const out = [];
  for (const name of roleNames) {
    const packSize = MULTI_PACKS[name];
    if (packSize) {
      for (let i = 0; i < packSize; i++) out.push(name);
    } else {
      out.push(name);
    }
  }
  return out;
}

export function countRoles(roleNames) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const r of roleNames) counts[r] = (counts[r] || 0) + 1;
  return counts;
}

export function validateComposition(roleNames, nPlayers) {
  const errors = [];
  if (roleNames.length !== nPlayers) {
    errors.push(
      `La composition contient ${roleNames.length} cartes mais il faut ${nPlayers} joueurs.`
    );
  }

  const counts = countRoles(roleNames);

  // Packs: doivent être exactement à la bonne taille.
  for (const [packName, packSize] of Object.entries(MULTI_PACKS)) {
    if ((counts[packName] || 0) > 0 && counts[packName] !== packSize) {
      errors.push(
        `Le rôle « ${packName} » doit être présent en ${packSize} exemplaires (actuel: ${counts[packName]}).`
      );
    }
  }

  // Uniques: si >1 et pas duplicable et pas pack => erreur.
  for (const [name, c] of Object.entries(counts)) {
    if (c <= 1) continue;
    if (MULTI_PACKS[name]) continue;
    if (DUPLICABLES.has(name)) continue;
    errors.push(`Le rôle « ${name} » est unique (doublon: ${c}).`);
  }

  return { ok: errors.length === 0, errors };
}

export function computeStats(roleNames, rolesByName) {
  let balance = 0;
  /** @type {Record<string, number>} */
  const camps = { village: 0, loup: 0, neutre: 0, variable: 0, inconnu: 0 };

  for (const name of roleNames) {
    const r = rolesByName.get(name);
    if (!r) {
      camps.inconnu++;
      continue;
    }
    balance += r.balance ?? 0;
    const camp = r.camp ?? "inconnu";
    if (camps[camp] === undefined) camps[camp] = 0;
    camps[camp]++;
  }

  return { balance, camps };
}

/**
 * Base de propositions "manuelles" (faciles à ajuster) inspirées des suggestions précédentes.
 * Les packs sont mis sous forme de cartes déjà expandées (2 sœurs, 3 frères) pour éviter toute ambiguïté.
 */
export function getPresetCompositions(nPlayers) {
  /** @type {Record<number, Composition[]>} */
  const presets = {
    6: [
      {
        id: "6-a",
        title: "Simple & nerveux",
        roles: [
          "Voyante",
          "Salvateur",
          "Bouc Émissaire",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Loup-Garou",
        ],
      },
      {
        id: "6-b",
        title: "Lecture plutôt que protection",
        roles: [
          "Renard",
          "Petite Fille",
          "Idiot du Village",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Loup-Garou",
        ],
      },
    ],
    7: [
      {
        id: "7-a",
        title: "Contrôle + info",
        roles: [
          "Voyante",
          "Corbeau",
          "Noctambule",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Loup-Garou",
        ],
      },
      {
        id: "7-b",
        title: "Ours + protect",
        roles: [
          "Montreur d'Ours",
          "Salvateur",
          "Juge Bègue",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Loup-Garou",
        ],
      },
    ],
    8: [
      {
        id: "8-a",
        title: "Classique",
        roles: [
          "Voyante",
          "Salvateur",
          "Chasseur",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
        ],
      },
      {
        id: "8-b",
        title: "Plus de bluff",
        roles: [
          "Renard",
          "Corbeau",
          "Comédien",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
        ],
      },
    ],
    9: [
      {
        id: "9-a",
        title: "Avec Deux Sœurs",
        roles: [
          "Deux Sœurs",
          "Deux Sœurs",
          "Voyante",
          "Salvateur",
          "Bouc Émissaire",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
        ],
      },
      {
        id: "9-b",
        title: "Lecture agressive",
        roles: [
          "Montreur d'Ours",
          "Renard",
          "Petite Fille",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
        ],
      },
    ],
    10: [
      {
        id: "10-a",
        title: "Équilibré (classique)",
        roles: [
          "Voyante",
          "Sorcière",
          "Corbeau",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
        ],
      },
      {
        id: "10-b",
        title: "Variable maîtrisable",
        roles: [
          "Chien-Loup",
          "Salvateur",
          "Renard",
          "Chasseur",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
          "Simple Villageois",
        ],
        note:
          "Conseil MJ : rappeler que le Chien-Loup choisit son camp la 1ère nuit.",
      },
    ],
    11: [
      {
        id: "11-a",
        title: "Trois Frères",
        roles: [
          "Trois Frères",
          "Trois Frères",
          "Trois Frères",
          "Voyante",
          "Salvateur",
          "Juge Bègue",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
        ],
      },
      {
        id: "11-b",
        title: "Débat (moins swingy)",
        roles: [
          "Montreur d'Ours",
          "Corbeau",
          "Garde Champêtre",
          "Idiot du Village",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
          "Simple Villageois",
        ],
      },
    ],
    12: [
      {
        id: "12-a",
        title: "Standard (3 loups)",
        roles: [
          "Voyante",
          "Sorcière",
          "Salvateur",
          "Chasseur",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
        ],
      },
      {
        id: "12-b",
        title: "Loups spé (plus fun)",
        roles: [
          "Voyante",
          "Renard",
          "Corbeau",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Loup-Garou Voyant",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
        ],
      },
    ],
    13: [
      {
        id: "13-a",
        title: "Deux Sœurs + 3 loups",
        roles: [
          "Deux Sœurs",
          "Deux Sœurs",
          "Voyante",
          "Salvateur",
          "Corbeau",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
        ],
      },
      {
        id: "13-b",
        title: "Lecture, moins protect",
        roles: [
          "Montreur d'Ours",
          "Renard",
          "Petite Fille",
          "Noctambule",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
        ],
      },
    ],
    14: [
      {
        id: "14-a",
        title: "Setup complet",
        roles: [
          "Voyante",
          "Sorcière",
          "Salvateur",
          "Corbeau",
          "Bouc Émissaire",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
        ],
      },
      {
        id: "14-b",
        title: "Avec neutre liant",
        roles: [
          "Abominable Sectaire",
          "Voyante",
          "Salvateur",
          "Renard",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
          "Simple Villageois",
        ],
      },
    ],
    15: [
      {
        id: "15-a",
        title: "Trois Frères + 3 loups",
        roles: [
          "Trois Frères",
          "Trois Frères",
          "Trois Frères",
          "Voyante",
          "Salvateur",
          "Chasseur",
          "Juge Bègue",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
          "Simple Villageois",
        ],
      },
      {
        id: "15-b",
        title: "Loup blanc (mini-jeu loup)",
        roles: [
          "Loup-Garou Blanc",
          "Voyante",
          "Sorcière",
          "Montreur d'Ours",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
          "Simple Villageois",
          "Simple Villageois",
        ],
      },
    ],
    16: [
      {
        id: "16-a",
        title: "4 loups, riche",
        roles: [
          "Voyante",
          "Sorcière",
          "Salvateur",
          "Corbeau",
          "Renard",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
        ],
      },
      {
        id: "16-b",
        title: "Loups spé (infect + voyant)",
        roles: [
          "Voyante",
          "Salvateur",
          "Chasseur",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Infect Père des Loups",
          "Loup-Garou Voyant",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
          "Simple Villageois",
        ],
      },
    ],
    17: [
      {
        id: "17-a",
        title: "Deux Sœurs + 4 loups",
        roles: [
          "Deux Sœurs",
          "Deux Sœurs",
          "Voyante",
          "Sorcière",
          "Salvateur",
          "Corbeau",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
        ],
      },
      {
        id: "17-b",
        title: "Table talk",
        roles: [
          "Montreur d'Ours",
          "Renard",
          "Petite Fille",
          "Garde Champêtre",
          "Idiot du Village",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
        ],
      },
    ],
    18: [
      {
        id: "18-a",
        title: "Très complet",
        roles: [
          "Voyante",
          "Sorcière",
          "Salvateur",
          "Renard",
          "Corbeau",
          "Chasseur",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
        ],
      },
      {
        id: "18-b",
        title: "Avec Joueur de Flûte",
        roles: [
          "Joueur de Flûte",
          "Voyante",
          "Sorcière",
          "Salvateur",
          "Montreur d'Ours",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Villageois",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
          "Simple Loup-Garou",
        ],
      },
    ],
  };

  return presets[nPlayers] ?? [];
}
