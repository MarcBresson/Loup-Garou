import { MULTI_PACKS } from "./rolesData.js";

/**
 * Assistant MJ basé sur un état (vivants/morts, tours, première nuit).
 *
 * Objectif:
 * - Ne réveiller que les joueurs vivants
 * - Ne proposer les rôles "première nuit" qu'une seule fois
 * - Rendre le déroulé Nuit → Résolution → Aube dépendant des choix (cibles, potions, protections)
 */

// Rôles qui ne se réveillent qu'en première nuit.
const FIRST_NIGHT_ONLY = new Set([
  "Cupidon",
  "Deux Sœurs",
  "Trois Frères",
  "Enfant Sauvage",
  "Voleur",
  "Chien-Loup",
]);

const NIGHT_ORDER = [
  "Salvateur",
  "Voyante",
  "Voyante d'Aura",
  "Renard",
  "Noctambule",
  "Corbeau",
  "Joueur de Flûte",
  "Loups-Garous",
  "Grand-Méchant-Loup",
  "Infect Père des Loups",
  "Sorcière",
  "Servante Dévouée",
];

function playersWithRole(state, roleName) {
  return state.players.filter((p) => p.role === roleName);
}

function alivePlayers(state) {
  return state.players.filter((p) => p.alive);
}

function alivePlayersWithRole(state, roleName) {
  return state.players.filter((p) => p.alive && p.role === roleName);
}

function hasAnyAlive(state, roleName) {
  return alivePlayersWithRole(state, roleName).length > 0;
}

function roleIsPackCorrect(state, roleName) {
  const needed = MULTI_PACKS[roleName];
  if (!needed) return true;
  return playersWithRole(state, roleName).length === needed;
}

function killPlayer(state, playerId) {
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return;
  p.alive = false;

  // Grand-Méchant-Loup: si un loup meurt, la condition « aucun loup mort » n'est plus vraie.
  if (p.role.includes("Loup") || p.role === "Simple Loup-Garou") {
    state.gml.noWolfDeadYet = false;
  }
}

function applyCoupleChainDeaths(state, deaths) {
  const couple = state.relationships?.couple;
  if (!couple || !Array.isArray(couple) || couple.length !== 2) return;
  const [a, b] = couple;
  if (!a || !b) return;
  if (deaths.has(a) && state.players.find((p) => p.id === b)?.alive) deaths.add(b);
  if (deaths.has(b) && state.players.find((p) => p.id === a)?.alive) deaths.add(a);
}

function applyNightResolution(state) {
  const deaths = new Set();
  const saved = new Set();

  if (state.night.sorciereSaveId) saved.add(state.night.sorciereSaveId);
  if (state.night.sorciereKillId) deaths.add(state.night.sorciereKillId);
  if (state.night.wolvesTargetId) deaths.add(state.night.wolvesTargetId);
  if (state.night.gmlExtraTargetId) deaths.add(state.night.gmlExtraTargetId);

  // Protection Salvateur
  if (state.night.salvateurProtectId && deaths.has(state.night.salvateurProtectId)) {
    deaths.delete(state.night.salvateurProtectId);
    saved.add(state.night.salvateurProtectId);
  }

  // Soin Sorcière
  for (const id of saved) {
    if (deaths.has(id)) deaths.delete(id);
  }

  // Amoureux: si un des deux meurt, l'autre meurt aussi.
  applyCoupleChainDeaths(state, deaths);

  const killed = [];
  for (const id of deaths) {
    const p = state.players.find((x) => x.id === id);
    if (p && p.alive) {
      killPlayer(state, id);
      killed.push(p);
    }
  }

  // reset nuit (les effets "persistants" sont gérés ailleurs)
  state.night.salvateurProtectId = null;
  state.night.wolvesTargetId = null;
  state.night.gmlExtraTargetId = null;
  state.night.sorciereSaveId = null;
  state.night.sorciereKillId = null;

  return { killed };
}

export function createInitialGameState(roleNames, nPlayers) {
  return {
    turn: 1,
    isFirstNight: true,
    // Notes MJ (persistantes)
    gameNote: "",
    turnNotes: {},
    players: Array.from({ length: nPlayers }, (_, i) => ({
      id: String(i + 1),
      name: `Joueur ${i + 1}`,
      role: roleNames[i] ?? "(inconnu)",
      alive: true,
      note: "",
    })),
    sorciere: { heal: true, kill: true },
    salvateur: { lastProtectedId: null },
    gml: { noWolfDeadYet: true },
    night: {
      salvateurProtectId: null,
      wolvesTargetId: null,
      gmlExtraTargetId: null,
      sorciereSaveId: null,
      sorciereKillId: null,
      corbeauTargetId: null,
      noctambuleTargetId: null,
    },
    relationships: {
      // Couple désigné par Cupidon (persistant)
      couple: null,
      // Joueur de flûte: joueurs charmés (persistant)
      charmedIds: [],
    },
  };
}

export function getStateSummary(state) {
  const alive = alivePlayers(state).length;
  const dead = state.players.length - alive;
  return { alive, dead, turn: state.turn, isFirstNight: state.isFirstNight };
}

function buildFirstNightSteps(state) {
  const steps = [];

  if (hasAnyAlive(state, "Cupidon")) {
    steps.push({
      id: "first-cupidon",
      kind: "pick-couple",
      title: "Première nuit — Cupidon",
      body:
        "Réveille Cupidon (s'il est vivant). Il désigne 2 amoureux, puis tu réveilles les amoureux pour qu’ils se reconnaissent.",
      checklist: ["Noter le couple", "Réveiller les amoureux", "Rendormir"],
    });
  }

  if (hasAnyAlive(state, "Deux Sœurs") && roleIsPackCorrect(state, "Deux Sœurs")) {
    steps.push({
      id: "first-sisters",
      kind: "info",
      title: "Première nuit — Deux Sœurs",
      body: "Réveille les Deux Sœurs vivantes : elles se reconnaissent silencieusement.",
    });
  }

  if (hasAnyAlive(state, "Trois Frères") && roleIsPackCorrect(state, "Trois Frères")) {
    steps.push({
      id: "first-brothers",
      kind: "info",
      title: "Première nuit — Trois Frères",
      body: "Réveille les Trois Frères vivants : ils se reconnaissent silencieusement.",
    });
  }

  if (hasAnyAlive(state, "Enfant Sauvage")) {
    steps.push({
      id: "first-wildchild",
      kind: "pick-mentor",
      title: "Première nuit — Enfant Sauvage",
      body:
        "Réveille l’Enfant Sauvage (vivant). Il désigne un mentor. Note-le secrètement.",
    });
  }

  if (hasAnyAlive(state, "Voleur")) {
    steps.push({
      id: "first-thief",
      kind: "info",
      title: "Première nuit — Voleur",
      body:
        "Si tu joues avec le Voleur, prévois 2 cartes supplémentaires. Réveille-le : il peut échanger sa carte.",
    });
  }

  if (hasAnyAlive(state, "Chien-Loup")) {
    steps.push({
      id: "first-dogwolf",
      kind: "choose-side",
      title: "Première nuit — Chien-Loup",
      body:
        "Réveille le Chien-Loup (vivant). Il choisit définitivement son camp (Villageois ou Loup) pour la partie.",
    });
  }

  return steps;
}

function buildNightSteps(state) {
  const steps = [];

  steps.push({
    id: `night-start-${state.turn}`,
    kind: "info",
    title: `Nuit ${state.turn} — Début`,
    body: "Tout le village s’endort. Annonce la nuit et rappelle le silence.",
  });

  for (const role of NIGHT_ORDER) {
    if (FIRST_NIGHT_ONLY.has(role)) continue;

    if (role === "Salvateur" && hasAnyAlive(state, "Salvateur")) {
      steps.push({
        id: `night-salvateur-${state.turn}`,
        kind: "pick-salvateur",
        title: `Nuit ${state.turn} — Salvateur`,
        body:
          "Réveille le Salvateur (vivant). Il désigne une personne vivante à protéger (pas deux nuits de suite).",
      });
      continue;
    }

    if (role === "Voyante" && hasAnyAlive(state, "Voyante")) {
      steps.push({
        id: `night-seer-${state.turn}`,
        kind: "pick-seer",
        title: `Nuit ${state.turn} — Voyante`,
        body:
          "Réveille la Voyante (vivante). Elle désigne un joueur vivant. Indique-lui son rôle/camp selon ta règle.",
      });
      continue;
    }

    if (role === "Voyante d'Aura" && hasAnyAlive(state, "Voyante d'Aura")) {
      steps.push({
        id: `night-aura-${state.turn}`,
        kind: "pick-aura",
        title: `Nuit ${state.turn} — Voyante d’Aura`,
        body:
          "Réveille la Voyante d’Aura (vivante). Elle désigne un joueur vivant. Réponds « aura obscure » si le rôle peut tuer, sinon « aura claire ».",
      });
      continue;
    }

    if (role === "Renard" && hasAnyAlive(state, "Renard")) {
      steps.push({
        id: `night-fox-${state.turn}`,
        kind: "info",
        title: `Nuit ${state.turn} — Renard`,
        body:
          "Réveille le Renard (vivant). Il désigne 3 joueurs. Dis « oui » s’il y a au moins un loup parmi eux, sinon « non ».",
      });
      continue;
    }

    if (role === "Noctambule" && hasAnyAlive(state, "Noctambule")) {
      steps.push({
        id: `night-noctambule-${state.turn}`,
        kind: "pick-noctambule",
        title: `Nuit ${state.turn} — Noctambule`,
        body:
          "Réveille le Noctambule (vivant). Il choisit un joueur vivant chez qui dormir (ce joueur perd son pouvoir cette nuit).",
      });
      continue;
    }

    if (role === "Corbeau" && hasAnyAlive(state, "Corbeau")) {
      steps.push({
        id: `night-raven-${state.turn}`,
        kind: "pick-corbeau",
        title: `Nuit ${state.turn} — Corbeau`,
        body:
          "Réveille le Corbeau (vivant). Il désigne un joueur vivant. Au prochain vote, ce joueur prendra +2 voix.",
      });
      continue;
    }

    if (role === "Joueur de Flûte" && hasAnyAlive(state, "Joueur de Flûte")) {
      steps.push({
        id: `night-piper-${state.turn}`,
        kind: "pick-piper",
        title: `Nuit ${state.turn} — Joueur de Flûte`,
        body:
          "Réveille le Joueur de Flûte (vivant). Il charme des joueurs vivants (souvent 2) jusqu'à ce que tous soient charmés.",
      });
      continue;
    }

    if (role === "Loups-Garous") {
      const wolves = state.players.filter(
        (p) => p.alive && (p.role.includes("Loup") || p.role === "Simple Loup-Garou")
      );
      if (wolves.length > 0) {
        steps.push({
          id: `night-wolves-${state.turn}`,
          kind: "pick-wolves",
          title: `Nuit ${state.turn} — Loups-Garous`,
          body:
            "Réveille les Loups-Garous vivants. Ils se mettent d’accord sur une victime (joueur vivant).",
        });
      }
      continue;
    }

    if (role === "Grand-Méchant-Loup" && hasAnyAlive(state, "Grand-Méchant-Loup")) {
      steps.push({
        id: `night-gml-${state.turn}`,
        kind: "pick-gml",
        title: `Nuit ${state.turn} — Grand-Méchant-Loup`,
        body: state.gml.noWolfDeadYet
          ? "Si aucun loup n’est mort, le Grand-Méchant-Loup vivant peut choisir une 2e victime."
          : "Un loup est déjà mort : le pouvoir du Grand-Méchant-Loup ne s’applique plus.",
      });
      continue;
    }

    if (role === "Infect Père des Loups" && hasAnyAlive(state, "Infect Père des Loups")) {
      steps.push({
        id: `night-infect-${state.turn}`,
        kind: "info",
        title: `Nuit ${state.turn} — Infect Père des Loups`,
        body:
          "Rappel: 1 fois par partie, il peut transformer la victime des loups au lieu de la tuer (variant non simulé ici).",
      });
      continue;
    }

    if (role === "Sorcière" && hasAnyAlive(state, "Sorcière")) {
      steps.push({
        id: `night-witch-${state.turn}`,
        kind: "witch",
        title: `Nuit ${state.turn} — Sorcière`,
        body:
          "Annonce à la Sorcière la victime des loups (si elle existe). Elle peut utiliser une potion de soin et/ou une potion de mort (si disponibles).",
        checklist: [
          state.sorciere.heal ? "Potion de soin disponible" : "Potion de soin déjà utilisée",
          state.sorciere.kill ? "Potion de mort disponible" : "Potion de mort déjà utilisée",
        ],
      });
      continue;
    }

    if (role === "Servante Dévouée" && hasAnyAlive(state, "Servante Dévouée")) {
      steps.push({
        id: `night-maid-${state.turn}`,
        kind: "info",
        title: `Nuit ${state.turn} — Servante Dévouée`,
        body:
          "En fin de nuit, la Servante peut échanger son rôle avec une victime de la nuit (variant non simulé ici).",
      });
      continue;
    }
  }

  steps.push({
    id: `night-resolve-${state.turn}`,
    kind: "resolve-night",
    title: `Nuit ${state.turn} — Résolution`,
    body:
      "Applique protections et potions, puis détermine les morts (sans les annoncer encore).",
  });

  return steps;
}

function buildDawnSteps(state, killedPlayers) {
  const steps = [];

  steps.push({
    id: `dawn-${state.turn}`,
    kind: "announce-deaths",
    title: `Aube — Nuit ${state.turn}`,
    body:
      killedPlayers.length === 0
        ? "Réveille le village. Annonce qu'il n'y a eu aucun mort cette nuit."
        : "Réveille le village. Annonce les morts de la nuit (sans révéler les rôles, sauf effet).",
    payload: { killedIds: killedPlayers.map((p) => p.id) },
    checklist:
      killedPlayers.length === 0
        ? []
        : [
            `Morts: ${killedPlayers.map((p) => p.name).join(", ")}`,
            "Gérer les pouvoirs à la mort (Chasseur, etc.)",
          ],
  });

  steps.push({
    id: `day-debate-${state.turn}`,
    kind: "info",
    title: `Jour ${state.turn} — Débat`,
    body: "Laisse les joueurs discuter.",
  });

  steps.push({
    id: `day-vote-${state.turn}`,
    kind: "vote",
    title: `Jour ${state.turn} — Vote`,
    body:
      "Organise le vote d’exécution. Après le vote, marque le joueur exécuté comme mort dans l’état.",
  });

  steps.push({
    id: `end-turn-${state.turn}`,
    kind: "end-turn",
    title: `Fin du tour ${state.turn}`,
    body:
      "Si la partie n’est pas terminée, passe au tour suivant (Nuit suivante).",
  });

  return steps;
}

export function buildTurnScript(state) {
  const steps = [];

  if (state.isFirstNight) {
    steps.push({
      id: "setup",
      kind: "setup",
      title: "Mise en place",
      body:
        "Distribue les cartes, puis utilise le panneau 'Joueurs' pour nommer les joueurs et suivre vivants/morts.",
    });
    steps.push(...buildFirstNightSteps(state));
  }

  steps.push(...buildNightSteps(state));
  return steps;
}

export function applyStepEffect(state, step) {
  if (!step) return {};

  if (step.kind === "resolve-night") {
    const { killed } = applyNightResolution(state);
    const dawn = buildDawnSteps(state, killed);
    if (state.isFirstNight) state.isFirstNight = false;
    return { insertSteps: dawn };
  }

  if (step.kind === "end-turn") {
    state.turn += 1;
    // Effets “jour suivant”; on reset ce qui doit l'être.
    state.night.corbeauTargetId = null;
    return {};
  }

  return {};
}

export function setNightChoice(state, key, value) {
  // Sorcière: si la potion est déjà utilisée, on ignore toute tentative de sélection.
  if (key === "sorciereSaveId" && !state.sorciere.heal) return;
  if (key === "sorciereKillId" && !state.sorciere.kill) return;
  state.night[key] = value;
}

export function setCouple(state, loverAId, loverBId) {
  if (!loverAId || !loverBId) return;
  if (loverAId === loverBId) return;
  state.relationships.couple = [loverAId, loverBId];
}

export function toggleCharmed(state, playerId, isCharmed) {
  if (!playerId) return;
  const set = new Set(state.relationships.charmedIds);
  if (isCharmed) set.add(playerId);
  else set.delete(playerId);
  state.relationships.charmedIds = [...set];
}

export function setSorcierePotionUsed(state, which) {
  if (which === "heal") state.sorciere.heal = false;
  if (which === "kill") state.sorciere.kill = false;
}

export function setSorcierePotionAvailable(state, which, available) {
  if (which !== "heal" && which !== "kill") return;
  state.sorciere[which] = Boolean(available);

  // Si on remet disponible, on ne force pas de cible; si on rend indisponible,
  // on nettoie les choix pour éviter un état incohérent.
  if (!available) {
    if (which === "heal") state.night.sorciereSaveId = null;
    if (which === "kill") state.night.sorciereKillId = null;
  }
}

export function setSalvateurProtected(state, playerId) {
  state.night.salvateurProtectId = playerId;
  state.salvateur.lastProtectedId = playerId;
}

export function setWolvesTarget(state, playerId) {
  state.night.wolvesTargetId = playerId;
}

export function setGmlTarget(state, playerId) {
  state.night.gmlExtraTargetId = playerId;
}

export function markDead(state, playerId) {
  killPlayer(state, playerId);
}

export function renamePlayer(state, playerId, name) {
  const p = state.players.find((x) => x.id === playerId);
  if (p) p.name = name;
}

export function alivePlayerOptions(state) {
  return alivePlayers(state).map((p) => ({ id: p.id, name: p.name, role: p.role }));
}
