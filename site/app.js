import { loadRolesFromReadme } from "./rolesData.js";
import {
  validateComposition,
  computeStats,
  getPresetCompositions,
  recommendedWolfCount,
} from "./compositions.js";
import {
  createInitialGameState,
  getStateSummary,
  buildTurnScript,
  applyStepEffect,
  setSalvateurProtected,
  setWolvesTarget,
  setGmlTarget,
  setNightChoice,
  setSorcierePotionUsed,
  setSorcierePotionAvailable,
  setCouple,
  toggleCharmed,
  markDead,
  renamePlayer,
  alivePlayerOptions,
} from "./mjAssistant.js";

const $ = (sel) => document.querySelector(sel);

/** @type {Array<{name:string, origin:string, camp:string, balance:number}>} */
let ROLES = [];
/** @type {Map<string, {name:string, origin:string, camp:string, balance:number}>} */
let rolesByName = new Map();

let currentPlayers = 10;
/** @type {string[]} */
let currentComposition = []; // source unique (suggestion utilisée ou custom)

/** MJ state */
let gameState = null;
let mjSteps = [];
let mjIndex = 0;
/** @type {Array<{gameState:any, mjSteps:any[], mjIndex:number}>} */
let mjHistory = [];

function cloneGameState(state) {
  // Format simple et suffisant ici (state = données sérialisables)
  return JSON.parse(JSON.stringify(state));
}

function pushMjSnapshot() {
  if (!gameState || !mjSteps.length) return;
  mjHistory.push({
    gameState: cloneGameState(gameState),
    mjSteps: JSON.parse(JSON.stringify(mjSteps)),
    mjIndex,
  });
}

function updateMjPrevButton() {
  const btnPrev = $("#btn-mj-prev");
  if (!btnPrev) return;
  btnPrev.disabled = mjHistory.length === 0 || !mjSteps.length;
}

function setTab(active) {
  const tabs = {
    suggest: { btn: $("#tab-suggest"), view: $("#view-suggest") },
    custom: { btn: $("#tab-custom"), view: $("#view-custom") },
    mj: { btn: null, view: $("#view-mj") },
  };

  for (const [k, t] of Object.entries(tabs)) {
    const isActive = k === active;
    if (t.btn) t.btn.setAttribute("aria-selected", String(isActive));
    t.view.hidden = !isActive;
  }

  // En mode MJ, on masque le bandeau de configuration (joueurs + mode).
  const setupBar = $("#setup-bar");
  if (setupBar) setupBar.hidden = active === "mj";
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderRoleBadges(roleNames) {
  return roleNames
    .map((r) => `<span class="badge">${escapeHtml(r)}</span>`)
    .join("");
}

function renderRoleBadgesGrouped(roleNames) {
  const counts = new Map();
  for (const r of roleNames) counts.set(r, (counts.get(r) ?? 0) + 1);

  const items = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr"));
  return items
    .map(([name, c]) => {
      const prefix = c > 1 ? `${c}× ` : "";
      return `<span class="badge">${escapeHtml(prefix + name)}</span>`;
    })
    .join("");
}

function renderStats(roleNames, nPlayers) {
  const { balance, camps } = computeStats(roleNames, rolesByName);
  const wolfRec = recommendedWolfCount(nPlayers);
  const balanceBadge =
    Math.abs(balance) <= 2
      ? `<span class="badge ok">Balance totale: ${balance}</span>`
      : `<span class="badge danger">Balance totale: ${balance}</span>`;

  const campBadges = [
    `Village: ${camps.village}`,
    `Loups: ${camps.loup}`,
    `Neutres: ${camps.neutre}`,
    `Variables: ${camps.variable}`,
  ]
    .map((t) => `<span class="badge">${t}</span>`)
    .join("");

  const hint = `<div class="hint">Recommandation loups (règle simple): <strong>${wolfRec}</strong></div>`;

  return `
  <div class="kpi">
    ${balanceBadge}
    ${campBadges}
  </div>
  ${hint}
  `;
}

function renderSuggestions() {
  const wrap = $("#suggestions");
  wrap.innerHTML = "";

  const presets = getPresetCompositions(currentPlayers);
  if (presets.length === 0) {
    wrap.innerHTML =
      `<div class="hint">Aucune suggestion prédéfinie pour ${currentPlayers} joueurs.</div>`;
    return;
  }

  for (const p of presets) {
    const v = validateComposition(p.roles, currentPlayers);
    const statsHtml = renderStats(p.roles, currentPlayers);
    const errHtml = v.ok
      ? ""
      : `<div class="callout">${v.errors.map(escapeHtml).join("<br/>")}</div>`;

    const note = p.note ? `<div class="hint">${escapeHtml(p.note)}</div>` : "";

    const el = document.createElement("div");
    el.className = "compo";
    el.innerHTML = `
      <h3>${escapeHtml(p.title)}</h3>
      <div class="meta">${currentPlayers} joueurs · ${escapeHtml(p.id)}</div>
  <div class="roles">${renderRoleBadgesGrouped(p.roles)}</div>
      <div class="divider"></div>
      ${statsHtml}
      ${note}
      ${errHtml}
      <div class="divider"></div>
      <div class="actions">
        <button class="btn" data-use-mj="${escapeHtml(p.id)}">Utiliser dans l’assistant</button>
      </div>
    `;

    el.querySelector("[data-use-mj]").addEventListener("click", () => {
      currentComposition = [...p.roles];
      syncCustomFromCurrent();
      resetMj();
      setTab("mj");
      startMjIfValid();
      // S'assure qu'on est bien au début du script
      renderMj();
    });

    wrap.appendChild(el);
  }
}

function renderCustom() {
  const pills = $("#role-pills");
  pills.innerHTML = "";

  const counts = new Map();
  for (const r of currentComposition) {
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }

  for (const [name, c] of [...counts.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], "fr")
  )) {
    const p = document.createElement("span");
    p.className = "pill";
    p.innerHTML = `${escapeHtml(name)} <span style="opacity:.8">×${c}</span>`;

    const btn = document.createElement("button");
    btn.title = "Retirer une carte";
    btn.textContent = "×";
    btn.addEventListener("click", () => removeOne(name));

    p.appendChild(btn);
    pills.appendChild(p);
  }

  const v = validateComposition(currentComposition, currentPlayers);
  const errors = $("#custom-errors");
  if (v.ok) {
    errors.hidden = true;
    errors.innerHTML = "";
  } else {
    errors.hidden = false;
    errors.innerHTML = v.errors.map(escapeHtml).join("<br/>");
  }

  $("#custom-stats").innerHTML = renderStats(currentComposition, currentPlayers);
}

function removeOne(name) {
  const idx = currentComposition.lastIndexOf(name);
  if (idx >= 0) currentComposition.splice(idx, 1);
  renderCustom();
}

function addRoleByName(name) {
  const exact = ROLES.find((r) => r.name.toLowerCase() === name.toLowerCase());
  if (!exact) {
    alert("Rôle inconnu: " + name);
    return;
  }
  currentComposition.push(exact.name);
  renderCustom();
}

function syncCustomFromCurrent() {
  renderCustom();
}

function exportComposition() {
  const data = {
    players: currentPlayers,
    roles: currentComposition,
    createdAt: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `composition-${currentPlayers}j.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importComposition(file) {
  const text = await file.text();
  const json = JSON.parse(text);
  if (!json || !Array.isArray(json.roles)) {
    alert("Fichier invalide (attendu: { roles: [...] }).");
    return;
  }
  if (typeof json.players === "number") {
    currentPlayers = json.players;
    $("#players").value = String(currentPlayers);
  }
  currentComposition = json.roles.map(String);
  renderSuggestions();
  renderCustom();
  resetMj();
}

function resetMj() {
  mjSteps = [];
  mjIndex = 0;
  gameState = null;
  mjHistory = [];
  $("#mj-instructions").innerHTML = "";
  $("#mj-state").innerHTML = "";
  const playersWrap = $("#mj-players");
  if (playersWrap) playersWrap.innerHTML = "";
  const actionsWrap = $("#mj-actions");
  if (actionsWrap) actionsWrap.hidden = true;
  const actionsBody = $("#mj-actions-body");
  if (actionsBody) actionsBody.innerHTML = "";
  $("#mj-errors").hidden = true;
  $("#mj-errors").innerHTML = "";
  updateMjPrevButton();
}

function startMjIfValid() {
  const v = validateComposition(currentComposition, currentPlayers);
  const err = $("#mj-errors");
  if (!v.ok) {
    err.hidden = false;
    err.innerHTML =
      "La composition n'est pas valide :<br/>" +
      v.errors.map(escapeHtml).join("<br/>");
    return false;
  }

  err.hidden = true;
  err.innerHTML = "";

  // Initialiser l'état de partie.
  gameState = createInitialGameState(currentComposition, currentPlayers);
  mjSteps = buildTurnScript(gameState);
  mjIndex = 0;
  mjHistory = [];
  renderMj();
  return true;
}

function renderPlayersPanel() {
  const wrap = $("#mj-players");
  if (!wrap || !gameState) return;
  wrap.innerHTML = "";

  for (const p of gameState.players) {
    const row = document.createElement("div");
    row.className = "player-row";

    const meta = document.createElement("div");
    meta.className = "player-meta";

    const nameLine = document.createElement("div");
    nameLine.className = "name";

    const input = document.createElement("input");
    input.value = p.name;
    input.placeholder = "Nom du joueur";
    input.addEventListener("change", () => {
      renamePlayer(gameState, p.id, input.value.trim() || p.name);
      renderMj();
    });

    const status = document.createElement("label");
    status.className = `badge ${p.alive ? "ok" : "danger"}`;

    const cbAlive = document.createElement("input");
    cbAlive.type = "checkbox";
    cbAlive.checked = p.alive;
    cbAlive.addEventListener("change", () => {
      if (cbAlive.checked) {
        // On autorise la "résurrection" via checkbox (simple)
        p.alive = true;
      } else {
        markDead(gameState, p.id);
      }
      renderMj();
    });

    const statusText = document.createElement("span");
    statusText.textContent = p.alive ? "Vivant" : "Mort";

    status.appendChild(cbAlive);
    status.appendChild(statusText);

    nameLine.appendChild(input);
    nameLine.appendChild(status);

    const role = document.createElement("div");
    role.className = "role";
    role.textContent = `Rôle: ${p.role}`;

    const noteLabel = document.createElement("div");
    noteLabel.className = "hint";
    noteLabel.textContent = "Note (persistante)";

    const note = document.createElement("textarea");
    note.className = "textarea";
    note.rows = 2;
    note.placeholder = "Notes MJ (ex: soupçons, power, rappel...)";
    note.value = p.note ?? "";
    note.addEventListener("input", () => {
      p.note = note.value;
    });

    meta.appendChild(nameLine);
    meta.appendChild(role);
  meta.appendChild(noteLabel);
  meta.appendChild(note);

    row.appendChild(meta);
    wrap.appendChild(row);
  }
}

function renderMjActions(step) {
  const box = $("#mj-actions");
  const body = $("#mj-actions-body");
  if (!box || !body) return;
  body.innerHTML = "";

  if (!gameState || !step) {
    box.hidden = true;
    return;
  }

  /** helper */
  const addSelect = (labelText, onChange, includeEmpty = true, opts = {}) => {
    const wrap = document.createElement("div");
    const label = document.createElement("div");
    label.className = "hint";
    label.textContent = labelText;
    const sel = document.createElement("select");
    sel.className = "select";
    if (opts.disabled) sel.disabled = true;
    if (includeEmpty) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "—";
      sel.appendChild(opt);
    }
    const alive = alivePlayerOptions(gameState);
    if (alive.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "(Aucun joueur vivant)";
      sel.appendChild(opt);
    }

    for (const p of alive) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.name} (${p.role})`;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", () => onChange(sel.value || null));
    wrap.appendChild(label);
    wrap.appendChild(sel);
    body.appendChild(wrap);
  };

  if (
    step.kind === "pick-salvateur" ||
    step.kind === "pick-wolves" ||
    step.kind === "pick-gml" ||
    step.kind === "pick-corbeau" ||
    step.kind === "pick-noctambule" ||
    step.kind === "pick-piper" ||
    step.kind === "witch" ||
    step.kind === "vote" ||
    step.kind === "pick-couple"
  ) {
    box.hidden = false;
  } else {
    box.hidden = true;
    return;
  }

  if (step.kind === "pick-salvateur") {
    addSelect("Cible à protéger (Salvateur)", (id) => {
      if (id) setSalvateurProtected(gameState, id);
    });
  }

  if (step.kind === "pick-wolves") {
    addSelect("Victime des Loups-Garous", (id) => {
      if (id) setWolvesTarget(gameState, id);
    });
  }

  if (step.kind === "pick-gml") {
    addSelect("2e victime (Grand-Méchant-Loup)", (id) => {
      if (id) setGmlTarget(gameState, id);
    });
  }

  if (step.kind === "pick-corbeau") {
    addSelect("Cible du Corbeau (+2 voix au prochain vote)", (id) => {
      setNightChoice(gameState, "corbeauTargetId", id);
    });
  }

  if (step.kind === "pick-noctambule") {
    addSelect("Cible du Noctambule (perd son pouvoir cette nuit)", (id) => {
      setNightChoice(gameState, "noctambuleTargetId", id);
    });
  }

  if (step.kind === "witch") {
    // Disponibilité des potions (cases à cocher)
    const potions = document.createElement("div");
    potions.className = "stack";

    const mkPotionToggle = (labelText, which) => {
      const row = document.createElement("label");
      row.className = "toggle";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !gameState.sorciere[which];
      cb.addEventListener("change", () => {
        // checked = utilisée => available = false
        setSorcierePotionAvailable(gameState, which, !cb.checked);
        renderMj();
      });
      const text = document.createElement("span");
      text.textContent = labelText;
      row.appendChild(cb);
      row.appendChild(text);
      return row;
    };

    potions.appendChild(mkPotionToggle("Potion de soin utilisée", "heal"));
    potions.appendChild(mkPotionToggle("Potion de mort utilisée", "kill"));
    body.appendChild(potions);

    const div = document.createElement("div");
    div.className = "divider";
    body.appendChild(div);

    // Save
    const saveWrap = document.createElement("div");
    saveWrap.className = "hint";
    saveWrap.textContent =
      "Potion de soin: sélectionner une cible à sauver (facultatif).";
    body.appendChild(saveWrap);
    addSelect(
      "Sauver (Sorcière)",
      (id) => {
        if (id && gameState.sorciere.heal) {
          setNightChoice(gameState, "sorciereSaveId", id);
          setSorcierePotionUsed(gameState, "heal");
          renderMj();
        }
      },
      true,
      { disabled: !gameState.sorciere.heal }
    );

    // Kill
    const killWrap = document.createElement("div");
    killWrap.className = "hint";
    killWrap.textContent =
      "Potion de mort: sélectionner une cible à tuer (facultatif).";
    body.appendChild(killWrap);
    addSelect(
      "Tuer (Sorcière)",
      (id) => {
        if (id && gameState.sorciere.kill) {
          setNightChoice(gameState, "sorciereKillId", id);
          setSorcierePotionUsed(gameState, "kill");
          renderMj();
        }
      },
      true,
      { disabled: !gameState.sorciere.kill }
    );
  }

  if (step.kind === "vote") {
    addSelect("Joueur exécuté par le village", (id) => {
      if (id) markDead(gameState, id);
    });
  }

  if (step.kind === "pick-couple") {
    // couple: deux sélections
    let a = null;
    let b = null;
    addSelect("Amoureux A", (id) => {
      a = id;
      if (a && b) setCouple(gameState, a, b);
    });
    addSelect("Amoureux B", (id) => {
      b = id;
      if (a && b) setCouple(gameState, a, b);
    });

    const note = document.createElement("div");
    note.className = "hint";
    note.textContent = "Note: le couple est persistant, et si l'un meurt l'autre meurt aussi.";
    body.appendChild(note);
  }

  if (step.kind === "pick-piper") {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent =
      "Coche les joueurs charmés par le Joueur de Flûte (persistant). Astuce: en général 2 par nuit.";
    body.appendChild(hint);

    const alive = alivePlayerOptions(gameState);
    const charmed = new Set(gameState.relationships?.charmedIds ?? []);

    for (const p of alive) {
      const row = document.createElement("label");
      row.className = "toggle";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = charmed.has(p.id);
      cb.addEventListener("change", () => {
        toggleCharmed(gameState, p.id, cb.checked);
      });
      const text = document.createElement("span");
      text.textContent = `${p.name} (${p.role})`;
      row.appendChild(cb);
      row.appendChild(text);
      body.appendChild(row);
    }
  }
}

function renderMj() {
  const state = $("#mj-state");
  if (!gameState) {
    state.innerHTML = `
      <span class="badge">Joueurs: ${currentPlayers}</span>
      <span class="badge">Étape: 0/0</span>
    `;
    return;
  }

  updateMjPrevButton();

  const sum = getStateSummary(gameState);

  // Phase UI: on la déduit de l'étape courante (le plus fiable côté UI).
  const currentStep = mjSteps[mjIndex];
  /** @type {"night"|"dawn"|"day"} */
  let phase = "night";
  if (currentStep?.kind === "announce-deaths") phase = "dawn";
  else if (currentStep?.kind === "vote" || currentStep?.id?.startsWith("day-")) phase = "day";
  else if (currentStep?.kind === "end-turn") phase = "day";

  const phaseLabel =
    phase === "dawn"
      ? "Aube"
      : phase === "day"
        ? "Jour"
        : sum.isFirstNight
          ? "Première nuit"
          : "Nuit";

  state.innerHTML = `
    <span class="badge">Tour: ${sum.turn}</span>
    <span class="badge">Vivants: ${sum.alive}</span>
    <span class="badge">Morts: ${sum.dead}</span>
    <span class="badge">${phaseLabel}</span>
    <span class="badge">Étape: ${mjIndex + 1}/${mjSteps.length}</span>
  `;

  // Notes (partie + tour)
  const notesWrap = document.createElement("div");
  notesWrap.className = "stack";

  const mkNoteArea = (title, value, onInput) => {
    const wrap = document.createElement("div");
    const label = document.createElement("div");
    label.className = "hint";
    label.textContent = title;
    const ta = document.createElement("textarea");
    ta.className = "textarea";
    ta.rows = 3;
    ta.value = value ?? "";
    ta.addEventListener("input", () => onInput(ta.value));
    wrap.appendChild(label);
    wrap.appendChild(ta);
    return wrap;
  };

  notesWrap.appendChild(
    mkNoteArea("Note de partie (persistante)", gameState.gameNote, (v) => {
      gameState.gameNote = v;
    })
  );

  const turnKey = String(gameState.turn);
  notesWrap.appendChild(
    mkNoteArea(
      `Note du tour ${gameState.turn} (persistante)`,
      gameState.turnNotes?.[turnKey] ?? "",
      (v) => {
        if (!gameState.turnNotes) gameState.turnNotes = {};
        gameState.turnNotes[turnKey] = v;
      }
    )
  );

  state.appendChild(notesWrap);

  const out = $("#mj-instructions");
  out.innerHTML = "";

  const s = mjSteps[mjIndex];
  if (!s) return;

  const el = document.createElement("div");
  el.className = "step";
  el.innerHTML = `
    <h3>${escapeHtml(s.title)}</h3>
    <p>${escapeHtml(s.body)}</p>
  `;

  if (s.checklist && s.checklist.length) {
    const ul = document.createElement("ul");
    for (const item of s.checklist) {
      const li = document.createElement("li");
      li.textContent = item;
      ul.appendChild(li);
    }
    el.appendChild(ul);
  }

  out.appendChild(el);

  renderPlayersPanel();
  renderMjActions(s);
}

function mjPrev() {
  if (!mjHistory.length) return;
  const snap = mjHistory.pop();
  gameState = snap.gameState;
  mjSteps = snap.mjSteps;
  mjIndex = snap.mjIndex;
  renderMj();
}

function mjNext() {
  if (!mjSteps.length) {
    if (!startMjIfValid()) return;
    return;
  }

  // Snapshot avant application/avancement pour pouvoir revenir en arrière.
  pushMjSnapshot();

  const currentStep = mjSteps[mjIndex];

  // Appliquer effets (ex: résolution nuit -> injection aube)
  if (gameState && currentStep) {
    const res = applyStepEffect(gameState, currentStep);
    if (res?.insertSteps?.length) {
      mjSteps.splice(mjIndex + 1, 0, ...res.insertSteps);
    }

    // Fin de tour: on reconstruit le script pour le prochain tour
    if (currentStep.kind === "end-turn") {
      mjSteps = buildTurnScript(gameState);
      mjIndex = 0;
      renderMj();
      return;
    }
  }

  mjIndex++;
  if (mjIndex >= mjSteps.length) {
    // Si on arrive au bout (normalement ça ne devrait pas arriver souvent), on reboucle.
    mjIndex = 0;
  }
  renderMj();
}

function setupAutocomplete() {
  const input = $("#role-search");

  // datalist simple
  const dl = document.createElement("datalist");
  dl.id = "roles-datalist";
  for (const r of ROLES) {
    const opt = document.createElement("option");
    opt.value = r.name;
    dl.appendChild(opt);
  }
  document.body.appendChild(dl);
  input.setAttribute("list", dl.id);
}

async function main() {
  currentPlayers = Number.parseInt($("#players").value, 10);

  ROLES = await loadRolesFromReadme();
  rolesByName = new Map(ROLES.map((r) => [r.name, r]));

  // init compo: première suggestion si dispo, sinon vide
  const presets = getPresetCompositions(currentPlayers);
  currentComposition = presets[0]?.roles ? [...presets[0].roles] : [];

  setupAutocomplete();
  renderSuggestions();
  renderCustom();

  // tabs
  $("#tab-suggest").addEventListener("click", () => setTab("suggest"));
  $("#tab-custom").addEventListener("click", () => setTab("custom"));

  // MJ controls
  $("#btn-mj-prev").addEventListener("click", () => mjPrev());

  // players change
  $("#players").addEventListener("input", (e) => {
    const val = Number.parseInt(e.target.value, 10);
    if (!Number.isFinite(val)) return;
    currentPlayers = Math.max(6, Math.min(18, val));

    // si compo de taille différente, on essaie de charger une suggestion par défaut
    const p = getPresetCompositions(currentPlayers)[0];
    if (p?.roles) currentComposition = [...p.roles];

    renderSuggestions();
    renderCustom();
    resetMj();
  });

  // custom actions
  $("#btn-clear").addEventListener("click", () => {
    currentComposition = [];
    renderCustom();
    resetMj();
  });

  $("#btn-custom-to-mj").addEventListener("click", () => {
    resetMj();
    setTab("mj");
    startMjIfValid();
    renderMj();
  });

  $("#btn-export").addEventListener("click", () => exportComposition());

  $("#file-import").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importComposition(file);
    e.target.value = "";
  });

  $("#btn-add").addEventListener("click", () => {
    const name = $("#role-search").value.trim();
    if (!name) return;
    addRoleByName(name);
    $("#role-search").value = "";
  });

  $("#role-search").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      $("#btn-add").click();
    }
  });

  // MJ
  $("#btn-mj-reset").addEventListener("click", () => {
    resetMj();
    // Retour aux compositions: toujours Suggestions.
    setTab("suggest");
  });
  $("#btn-mj-next").addEventListener("click", () => mjNext());

  // ready
  setTab("suggest");
}

main().catch((err) => {
  console.error(err);
  alert(
    "Erreur au chargement. Ouvre la console pour détails.\n" +
      (err?.message || String(err))
  );
});
