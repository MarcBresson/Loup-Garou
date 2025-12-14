import { loadRolesFromReadme } from "./rolesData.js";
import { DEFAULT_PRINT_COUNTS, MULTI_PACKS, DUPLICABLES } from "./rolesData.js";

const $ = (sel) => document.querySelector(sel);

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clampNumber(v, { min = -Infinity, max = Infinity, fallback = 0 } = {}) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function mmToPx(mm) {
  // CSS px from mm: 96px per inch, 25.4mm per inch.
  return (mm * 96) / 25.4;
}

/**
 * Construire la liste de cartes à imprimer sous forme d'URLs.
 * @param {Array<{name:string, camp:string}>} roles
 * @param {Record<string, number>} counts
 */
function buildCardList(roles, counts) {
  /** @type {Array<{name:string, url:string}>} */
  const out = [];
  for (const r of roles) {
    const c = counts[r.name] ?? 0;
    if (!c) continue;
    // Les fichiers SVG dans /roles/ sont en minuscules avec espaces.
    const file = nameToSvgFile(r.name);
    const url = `../cartes/roles/${encodeURIComponent(file)}`;
    for (let i = 0; i < c; i++) out.push({ name: r.name, url });
  }
  return out;
}

/**
 * Cartes "compositions" (recommandations par nombre de joueurs).
 * Format proche des rôles pour réutiliser le tableau d'impression.
 */
const COMPOSITION_CARDS = [
  { name: "Compo — 7 joueurs (2 propositions)", camp: "Compo", url: "../cartes/compositions/compo 07 joueurs.svg" },
  { name: "Compo — 6 joueurs (2 propositions)", camp: "Compo", url: "../cartes/compositions/compo 06 joueurs.svg" },
  { name: "Compo — 8 joueurs (2 propositions)", camp: "Compo", url: "../cartes/compositions/compo 08 joueurs.svg" },
  { name: "Compo — 9 joueurs (2 propositions)", camp: "Compo", url: "../cartes/compositions/compo 09 joueurs.svg" },
  { name: "Compo — 10 joueurs (2 propositions)", camp: "Compo", url: "../cartes/compositions/compo 10 joueurs.svg" },
  { name: "Compo — 11 joueurs (2 propositions)", camp: "Compo", url: "../cartes/compositions/compo 11 joueurs.svg" },
  { name: "Compo — 12 joueurs (2 propositions)", camp: "Compo", url: "../cartes/compositions/compo 12 joueurs.svg" },
  { name: "Compo — 13 joueurs (2 propositions)", camp: "Compo", url: "../cartes/compositions/compo 13 joueurs.svg" },
  { name: "Compo — 14 joueurs (2 propositions)", camp: "Compo", url: "../cartes/compositions/compo 14 joueurs.svg" },
  { name: "Compo — 15 joueurs (2 propositions)", camp: "Compo", url: "../cartes/compositions/compo 15 joueurs.svg" },
  { name: "Compo — 16 joueurs (2 propositions)", camp: "Compo", url: "../cartes/compositions/compo 16 joueurs.svg" },
  { name: "Compo — 17 joueurs (2 propositions)", camp: "Compo", url: "../cartes/compositions/compo 17 joueurs.svg" },
  { name: "Compo — 18 joueurs (2 propositions)", camp: "Compo", url: "../cartes/compositions/compo 18 joueurs.svg" },
];

/**
 * Cartes "ressources" (cartes utilitaires).
 * Elles peuvent être imprimées en même temps que les rôles.
 */
const RESOURCE_CARDS = [
  { name: "Spiritisme (gitane)", camp: "Ressource", url: "../cartes/ressources/spiritisme (gitane).svg" },
];

function buildResourceCardList(counts) {
  /** @type {Array<{name:string, url:string}>} */
  const out = [];
  for (const r of RESOURCE_CARDS) {
    const n = counts[r.name] ?? 0;
    if (!n) continue;
    for (let i = 0; i < n; i++) out.push({ name: r.name, url: r.url });
  }
  return out;
}

function buildCompositionCardList(counts) {
  /** @type {Array<{name:string, url:string}>} */
  const out = [];
  for (const c of COMPOSITION_CARDS) {
    const n = counts[c.name] ?? 0;
    if (!n) continue;
    for (let i = 0; i < n; i++) out.push({ name: c.name, url: c.url });
  }
  return out;
}

/**
 * Imprime les compositions en paires recto/verso.
 * - recto: compo[i]
 * - verso: compo[i+1] (si absent => vide)
 *
 * @param {HTMLElement} preview
 * @param {Array<{name:string,url:string}>} compCards
 * @param {number} perPage
 * @param {any} cfg
 */
function renderCompositionPairs(preview, compCards, perPage, cfg) {
  // On imprime les compositions comme des paires: (0,1), (2,3), ...
  // Ainsi: une carte imprimée au verso n'est pas ré-imprimée au recto.
  /** @type {Array<{name:string,url:string}>} */
  const fronts = [];
  /** @type {Array<{name:string,url:string}>} */
  const backs = [];
  for (let i = 0; i < compCards.length; i += 2) {
    fronts.push(compCards[i]);
    backs.push(compCards[i + 1] ? compCards[i + 1] : { name: "", url: "" });
  }

  const frontPages = chunkIntoPages(fronts, perPage);
  const backPages = chunkIntoPages(backs, perPage);

  if (!cfg.printBacks) {
    frontPages.forEach((cards, i) => {
      renderSheet(preview, {
        title: `Compositions — page ${i + 1}/${frontPages.length}`,
        cards,
        config: cfg,
      });
    });
    return;
  }

  if (cfg.backMode === "alternate") {
    frontPages.forEach((cards, i) => {
      renderSheet(preview, {
        title: `Compositions (recto) — page ${i + 1}/${frontPages.length}`,
        cards,
        config: cfg,
      });
      renderSheet(preview, {
        title: `Compositions (verso) — page ${i + 1}/${frontPages.length}`,
        cards: backPages[i] ?? [],
        config: cfg,
        isBack: true,
      });
    });
    return;
  }

  // batch
  frontPages.forEach((cards, i) => {
    renderSheet(preview, {
      title: `Compositions (recto) — page ${i + 1}/${frontPages.length}`,
      cards,
      config: cfg,
    });
  });
  backPages.forEach((cards, i) => {
    renderSheet(preview, {
      title: `Compositions (verso) — page ${i + 1}/${frontPages.length}`,
      cards,
      config: cfg,
      isBack: true,
    });
  });
}

function normalizeRoleNameForFile(name) {
  // Dans ce repo, les noms de fichiers sont en minuscules, avec espaces.
  // La majorité des fichiers n'ont pas d'accents (ex: "comédien" -> "comedien.svg").
  // On normalise donc en supprimant accents/ligatures, en harmonisant les apostrophes,
  // et en compactant les espaces.
  return String(name)
    .trim()
    .toLowerCase()
    .replaceAll("’", "'")
    .replaceAll("œ", "oe")
    .replaceAll("æ", "ae")
    .replaceAll("é", "e")
    .replaceAll("è", "e")
    .replaceAll("ê", "e")
    .replaceAll("ë", "e")
    .replaceAll("à", "a")
    .replaceAll("â", "a")
    .replaceAll("ä", "a")
    .replaceAll("î", "i")
    .replaceAll("ï", "i")
    .replaceAll("ô", "o")
    .replaceAll("ö", "o")
    .replaceAll("ù", "u")
    .replaceAll("û", "u")
    .replaceAll("ü", "u")
    .replaceAll("ç", "c")
    .replaceAll(/\s+/g, " ");
}

function nameToSvgFile(roleName) {
  // Heuristique: dans ce dépôt, le nom de fichier correspond au nom en lower, avec accents,
  // espaces (pas de tirets) sauf exceptions, et sans apostrophe.
  // Ex:
  //  - "Deux Sœurs" -> "deux soeurs.svg"
  //  - "L'Ange" -> "ange.svg"
  //  - "Chien-Loup" -> "chien loup.svg"
  const n0 = normalizeRoleNameForFile(roleName);

  /** @type {Record<string,string>} */
  const KNOWN = {
    "l'ange": "ange.svg",
    "chien-loup": "chien loup.svg",
    "grand-méchant-loup": "grand mechant loup.svg",
    "grand mechant loup": "grand mechant loup.svg",
    "grand-mechant-loup": "grand mechant loup.svg",
    "montreur d'ours": "montreur d ours.svg",
    "villageois-villageois": "villageois villageois.svg",
    "voyante d'aura": "voyante d aura.svg",
    "loup-garou voyant": "loup garou voyant.svg",
    "simple loup-garou": "loup garou.svg",
    "chevalier a l'epee rouillee": "chevalier a l epee rouillee.svg",
    // Seule carte avec tiret dans le nom de fichier.
    "loup-garou blanc": "loup-garou blanc.svg",
  };
  if (KNOWN[n0]) return KNOWN[n0];

  // Par défaut: on enlève juste les apostrophes.
  const n = n0.replaceAll("'", "");
  return `${n}.svg`;
}

function computeDefaultCounts(roleNames) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const name of roleNames) {
    if (DEFAULT_PRINT_COUNTS[name] != null) {
      counts[name] = DEFAULT_PRINT_COUNTS[name];
      continue;
    }
    if (MULTI_PACKS[name]) {
      counts[name] = MULTI_PACKS[name];
      continue;
    }
    if (DUPLICABLES.has(name)) {
      // duplicables non listés explicitement: 1 par défaut
      counts[name] = 1;
      continue;
    }
    counts[name] = 1;
  }
  return counts;
}

function validateLayoutSettings({ gapMm, cutLines, cutLineMm }) {
  return null;
}

function readMarginMm({ inputEl, enabled, fallbackMm }) {
  if (!enabled) return null;
  const raw = String(inputEl?.value ?? "").trim();
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n)) return fallbackMm;
  return Math.max(0, n);
}

function updateMarginInputsDisabled() {
  const alignX = $("#align-x")?.value || "center";
  const alignY = $("#align-y")?.value || "center";

  const mx = $("#margin-x");
  const my = $("#margin-y");
  const mxField = $("#margin-x-field");
  const myField = $("#margin-y-field");

  if (mxField) mxField.hidden = alignX === "center";
  if (myField) myField.hidden = alignY === "center";
  if (mx) mx.disabled = alignX === "center";
  if (my) my.disabled = alignY === "center";
}

/**
 * Fabrique une feuille A4 avec une grille auto-fill en mm
 * @param {HTMLElement} parent
 * @param {{title:string, cards:Array<{name:string,url:string}>, config:any}} opts
 */
function renderSheet(parent, opts) {
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.style.position = "relative";

  const title = document.createElement("div");
  title.className = "sheet-title";
  title.textContent = opts.title;
  sheet.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "cards-grid";

  // Paramètres CSS en mm
  const {
    cardWmm,
    cardHmm,
    gapMm,
    cutLines,
    cutLinesSide,
    cutLineMm,
    alignX,
    alignY,
    marginXmm,
    marginYmm,
    backOffsetXmm,
    backOffsetYmm,
  } = opts.config;

  // Traits de coupe: possibilité de n’afficher que sur recto/dos.
  // Valeurs: 'front' | 'back' | 'both'
  const side = cutLinesSide || "both";
  const isBack = Boolean(opts?.isBack);
  const shouldShowCutLines =
    Boolean(cutLines) && (side === "both" || (side === "front" && !isBack) || (side === "back" && isBack));

  // Offset optionnel (utilisé pour le dos)
  if (opts?.isBack && (backOffsetXmm || backOffsetYmm)) {
    const dx = Number(backOffsetXmm) || 0;
    const dy = Number(backOffsetYmm) || 0;
    grid.style.transform = `translate(${dx}mm, ${dy}mm)`;
  }

  // Gestion marges optionnelles : on pilote via variables CSS pour que ça s'applique
  // aussi en @media print (même comportement qu'en aperçu).
  const padXmm = marginXmm != null ? marginXmm : 8;
  const padYmm = marginYmm != null ? marginYmm : 8;
  sheet.style.setProperty("--sheet-pad-x", `${padXmm}mm`);
  sheet.style.setProperty("--sheet-pad-y", `${padYmm}mm`);

  grid.style.gridAutoRows = `${cardHmm}mm`;
  grid.style.gridAutoColumns = `${cardWmm}mm`;
  grid.style.gridAutoFlow = "row";
  // Utilise auto-fit en colonnes fixes via repeat().
  grid.style.gridTemplateColumns = `repeat(auto-fill, ${cardWmm}mm)`;
  // Quand les traits de coupe sont activés: gap = largeur de trait.
  // L'idée: l'espace entre cartes est "réservé" au trait.
  const baseGapMm = Number(gapMm) || 0;
  const lineMm = Math.max(0, Number(cutLineMm) || 0);
  // Important pour le recto/verso: même si les traits ne sont affichés que sur
  // un seul côté, on conserve le même gap *sur les deux* afin de garder
  // l'alignement des cartes entre recto et verso.
  const effectiveGapMm = cutLines ? lineMm : baseGapMm;
  grid.style.gap = `${effectiveGapMm}mm`;

  // Alignement de la "grille" dans la feuille (espace restant)
  const justifyContentByAlignX = { left: "start", center: "center", right: "end" };
  const alignContentByAlignY = { top: "start", center: "center", bottom: "end" };
  grid.style.justifyContent = justifyContentByAlignX[alignX] ?? "center";
  grid.style.alignContent = alignContentByAlignY[alignY] ?? "center";

  // Traits de coupe: convertit mm -> px pour un rendu stable
  const cutLinePx = Math.max(0, mmToPx(cutLineMm));
  grid.style.setProperty("--cutLinePx", `${cutLinePx}px`);

  const total = opts.cards.length;

  for (let idx = 0; idx < total; idx++) {
    const c = opts.cards[idx];
    const cell = document.createElement("div");
    cell.className = "card-cell" + (shouldShowCutLines ? " cut-lines" : "");
    cell.style.width = `${cardWmm}mm`;
    cell.style.height = `${cardHmm}mm`;

    if (c.url) {
      const img = document.createElement("img");
      img.src = c.url;
      img.alt = c.name;
      cell.appendChild(img);
    }
    grid.appendChild(cell);
  }

  sheet.appendChild(grid);
  parent.appendChild(sheet);
}

function chunkIntoPages(cards, perPage) {
  const pages = [];
  for (let i = 0; i < cards.length; i += perPage) {
    pages.push(cards.slice(i, i + perPage));
  }
  return pages;
}

function estimatePerPage({ cardWmm, cardHmm, gapMm, pageWmm = 210, pageHmm = 297, marginMm = 8 }) {
  // A4: 210x297. La feuille CSS a padding 8mm (dans print.css). On déduit 2*margin.
  const usableW = pageWmm - 2 * marginMm;
  const usableH = pageHmm - 2 * marginMm - 6; // -6mm approx pour le titre en preview (masqué en print)

  const cols = Math.max(1, Math.floor((usableW + gapMm) / (cardWmm + gapMm)));
  const rows = Math.max(1, Math.floor((usableH + gapMm) / (cardHmm + gapMm)));
  return { cols, rows, perPage: cols * rows };
}

function readMmInputValue(el, { fallback } = {}) {
  if (!el) return fallback;
  const raw = String(el.value ?? "").trim();
  if (!raw) return fallback;
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function formatMm(n) {
  // On garde 1 décimale max
  const v = Math.round(n * 10) / 10;
  // tronc le .0 inutile
  return String(v % 1 === 0 ? Math.trunc(v) : v);
}

function syncSizeConstraintUI() {
  const sizeModeEl = $("#size-mode");
  const wEl = $("#card-width");
  const hEl = $("#card-height");
  if (!sizeModeEl || !wEl || !hEl) return;

  const sizeMode = sizeModeEl.value;

  // Ratio par défaut: cartes 63.5x88 mm.
  const ratio = 88 / 63.5;

  // Valeurs courantes (même si l'input est vide).
  const w = clampNumber(readMmInputValue(wEl, { fallback: 63.5 }), { min: 10, max: 200, fallback: 63.5 });
  const h = clampNumber(readMmInputValue(hEl, { fallback: 88 }), { min: 10, max: 300, fallback: 88 });

  if (sizeMode === "width") {
    // Largeur imposée => hauteur dérivée.
    wEl.disabled = false;
    hEl.disabled = true;
    const derivedH = w * ratio;
    hEl.value = formatMm(derivedH);
  } else {
    // Hauteur imposée => largeur dérivée.
    hEl.disabled = false;
    wEl.disabled = true;
    const derivedW = h / ratio;
    wEl.value = formatMm(derivedW);
  }
}

function getConfigFromUI() {
  const sizeMode = $("#size-mode").value;
  const cardWidthMm = clampNumber($("#card-width").value, { min: 10, max: 200, fallback: 63.5 });
  const cardHeightMm = clampNumber($("#card-height").value, { min: 10, max: 300, fallback: 88 });

  // Contrainte: si on impose largeur, on garde ratio 63.5x88 par défaut.
  const ratio = 88 / 63.5;
  let cardWmm = cardWidthMm;
  let cardHmm = cardHeightMm;
  if (sizeMode === "width") {
    cardWmm = cardWidthMm;
    cardHmm = cardHeightMm ? cardHeightMm : cardWidthMm * ratio;
  } else {
    cardHmm = cardHeightMm;
    cardWmm = cardWidthMm ? cardWidthMm : cardHeightMm / ratio;
  }

  const gapMm = clampNumber($("#gap-mm").value, { min: 0, max: 50, fallback: 2 });
  const cutLines = $("#cut-lines").checked;
  const cutLinesSide = $("#cut-lines-side")?.value || "both";
  const cutLineMm = clampNumber($("#cut-line-mm").value, { min: 0, max: 5, fallback: 0.3 });

  const alignX = $("#align-x")?.value || "center";
  const alignY = $("#align-y")?.value || "center";

  // Marges: uniquement pertinentes si l'alignement n'est pas centré.
  const marginXmm = readMarginMm({ inputEl: $("#margin-x"), enabled: alignX !== "center", fallbackMm: 8 });
  const marginYmm = readMarginMm({ inputEl: $("#margin-y"), enabled: alignY !== "center", fallbackMm: 8 });

  const printBacks = $("#print-backs").checked;
  const backMode = $("#back-mode").value;

  const backOffsetXmm = clampNumber($("#back-offset-x")?.value, { min: -50, max: 50, fallback: 0 });
  const backOffsetYmm = clampNumber($("#back-offset-y")?.value, { min: -50, max: 50, fallback: 0 });

  return {
    sizeMode,
    cardWmm,
    cardHmm,
    gapMm,
    cutLines,
    cutLinesSide,
    cutLineMm,
    alignX,
    alignY,
    marginXmm,
    marginYmm,
    printBacks,
    backMode,
    backOffsetXmm,
    backOffsetYmm,
  };
}

function updatePrintAnchoringClass() {
  const alignX = $("#align-x")?.value || "center";
  const mx = $("#margin-x");
  const marginXmm = readMarginMm({ inputEl: mx, enabled: alignX !== "center", fallbackMm: 8 });

  // Si l'utilisateur choisit explicitement "gauche" et met marge X 0 0,
  // on ne doit pas re-centrer la feuille (sinon 0 l'impression 7a restera d9cal9).
  const anchorLeft = alignX === "left" && marginXmm === 0;
  document.body.classList.toggle("print-anchor-left", anchorLeft);
}

function updateBackModeDisabled() {
  const enabled = $("#print-backs").checked;
  $("#back-mode").disabled = !enabled;

  const off = $("#back-offsets");
  if (off) off.hidden = !enabled;
}

function updateLayoutControlsDisabled() {
  updateMarginInputsDisabled();
  updatePrintAnchoringClass();
}

function renderRolesTable(roles, counts) {
  const tbody = $("#roles-tbody");
  tbody.innerHTML = "";

  for (const r of roles) {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.innerHTML = `<strong>${escapeHtml(r.name)}</strong>`;

    const tdCamp = document.createElement("td");
    tdCamp.textContent = r.camp;

    const tdQty = document.createElement("td");
    if (r.camp === "Compo" || r.camp === "Ressource") {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = (counts[r.name] ?? 0) > 0;
      input.addEventListener("change", () => {
        counts[r.name] = input.checked ? 1 : 0;
        scheduleRenderPreview();
      });
      tdQty.appendChild(input);
    } else {
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "1";
      input.value = String(counts[r.name] ?? 0);
      input.style.width = "90px";
      input.addEventListener("input", () => {
        counts[r.name] = clampNumber(input.value, { min: 0, max: 999, fallback: 0 });
        scheduleRenderPreview();
      });
      tdQty.appendChild(input);
    }

    const tdPreview = document.createElement("td");
    const thumb = document.createElement("div");
    thumb.className = "preview-thumb";
    const img = document.createElement("img");
    img.alt = r.name;
    img.loading = "lazy";
  // Pour les rôles classiques: convertit nom -> fichier SVG.
  // Pour les cartes de composition: on a déjà une URL.
  img.src = r.url ? r.url : `../cartes/roles/${encodeURIComponent(nameToSvgFile(r.name))}`;
    thumb.appendChild(img);
    tdPreview.appendChild(thumb);

    tr.appendChild(tdName);
    tr.appendChild(tdCamp);
    tr.appendChild(tdQty);
    tr.appendChild(tdPreview);

    tbody.appendChild(tr);
  }
}

let renderTimer = null;
function scheduleRenderPreview() {
  if (renderTimer) window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(() => {
    renderTimer = null;
    renderPreview();
  }, 60);
}

let ROLES = [];
let COUNTS = {};

function renderPreview() {
  const cfg = getConfigFromUI();
  const err = validateLayoutSettings(cfg);
  const errBox = $("#print-errors");
  if (err) {
    errBox.hidden = false;
    errBox.textContent = err;
    return;
  }
  errBox.hidden = true;
  errBox.textContent = "";

  // Cartes rôles (quantités)
  const selected = buildCardList(ROLES, COUNTS);

  // Cartes ressources (0/1) - mélangées aux rôles pour économiser du papier.
  const includeResources = $("#include-resources")?.checked;
  const selectedResources = includeResources ? buildResourceCardList(COUNTS) : [];
  if (selectedResources.length) selected.push(...selectedResources);

  const includeCompositions = $("#include-compositions")?.checked;
  const selectedCompositions = includeCompositions ? buildCompositionCardList(COUNTS) : [];

  // Important: on trie les compositions par numéro (06..18) pour que les paires
  // soient stables: 6 recto/7 verso, 8 recto/9 verso, etc.
  const compNum = (name) => {
    const m = /\b(\d{1,2})\b/.exec(String(name));
    return m ? Number.parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
  };
  selectedCompositions.sort((a, b) => compNum(a.name) - compNum(b.name));
  const preview = $("#print-preview");
  preview.innerHTML = "";

  if (selected.length === 0 && selectedCompositions.length === 0) {
    preview.innerHTML = `<div class="hint">Aucune carte sélectionnée (quantités = 0).</div>`;
    return;
  }

  const marginMm = cfg.marginXmm == null && cfg.marginYmm == null ? 8 : Math.max(0, cfg.marginXmm ?? 8, cfg.marginYmm ?? 8);
  const { perPage } = estimatePerPage({ ...cfg, marginMm });

  // 1) Cartes normales (rôles + ressources)
  if (selected.length) {
    const pages = chunkIntoPages(selected, perPage);
    const backUrl = "../cartes/dos.svg";

  // Si une page contient au moins une ressource, on laisse le verso blanc.
  const pageNeedsBlankBack = (cards) => cards.some((c) => (c?.camp || "") === "Ressource");

    const renderFrontPages = () => {
      pages.forEach((cards, i) => {
        renderSheet(preview, {
          title: `Recto — page ${i + 1}/${pages.length}`,
          cards,
          config: cfg,
        });
      });
    };

    const renderBackPagesFor = () => {
      pages.forEach((cards, i) => {
        // Même nombre de cellules.
        // - Si ressource => dos blanc (cellule vide)
        // - Sinon => dos commun
        const backs = pageNeedsBlankBack(cards)
          ? cards.map(() => ({ name: "", url: "" }))
          : cards.map(() => ({ name: "Dos", url: backUrl }));
        renderSheet(preview, {
          title: `Dos — page ${i + 1}/${pages.length}`,
          cards: backs,
          config: cfg,
          isBack: true,
        });
      });
    };

    if (!cfg.printBacks) {
      renderFrontPages();
    } else if (cfg.backMode === "alternate") {
      pages.forEach((cards, i) => {
        renderSheet(preview, {
          title: `Recto — page ${i + 1}/${pages.length}`,
          cards,
          config: cfg,
        });
        const backs = pageNeedsBlankBack(cards)
          ? cards.map(() => ({ name: "", url: "" }))
          : cards.map(() => ({ name: "Dos", url: backUrl }));
        renderSheet(preview, {
          title: `Dos — page ${i + 1}/${pages.length}`,
          cards: backs,
          config: cfg,
          isBack: true,
        });
      });
    } else {
      // batch
      renderFrontPages();
      renderBackPagesFor();
    }
  }

  // 2) Compositions: imprimées séparément en 0/1, et en paires recto/verso
  if (selectedCompositions.length) {
    renderCompositionPairs(preview, selectedCompositions, perPage, cfg);
  }
}

function applyDefaults() {
  const roleNames = ROLES.map((r) => r.name);
  COUNTS = computeDefaultCounts(roleNames);
  // Par défaut, on coche aussi toutes les compositions.
  for (const c of COMPOSITION_CARDS) {
    COUNTS[c.name] = 1;
  }
  // Par défaut, on coche Spiritisme (utile) et laisse le reste optionnel.
  for (const r of RESOURCE_CARDS) {
    COUNTS[r.name] = r.name === "Spiritisme (gitane)" ? 1 : 0;
  }
  renderRolesTable(filteredRoles(), COUNTS);
  scheduleRenderPreview();
}

function clearCounts() {
  for (const r of ROLES) COUNTS[r.name] = 0;
  renderRolesTable(filteredRoles(), COUNTS);
  scheduleRenderPreview();
}

function filteredRoles() {
  const q = $("#role-filter").value.trim().toLowerCase();
  const includeCompositions = $("#include-compositions")?.checked;
  const includeResources = $("#include-resources")?.checked;
  const base = [
    ...ROLES,
    ...(includeCompositions ? COMPOSITION_CARDS : []),
    ...(includeResources ? RESOURCE_CARDS : []),
  ];
  if (!q) return base;
  return base.filter((r) => r.name.toLowerCase().includes(q));
}

async function main() {
  updateBackModeDisabled();
  updateLayoutControlsDisabled();

  ROLES = await loadRolesFromReadme();
  ROLES.sort((a, b) => a.name.localeCompare(b.name, "fr"));

  // Optionnel: injecter les cartes "compositions" dans la table, pour pouvoir régler leur quantité.
  const includeCompositionsEl = $("#include-compositions");
  if (includeCompositionsEl) {
    // Inclus par défaut
    includeCompositionsEl.checked = true;
    includeCompositionsEl.addEventListener("change", () => {
      renderRolesTable(filteredRoles(), COUNTS);
      scheduleRenderPreview();
    });
  }

  // Optionnel: inclure les cartes "ressources".
  const includeResourcesEl = $("#include-resources");
  if (includeResourcesEl) {
    includeResourcesEl.checked = true;
    includeResourcesEl.addEventListener("change", () => {
      renderRolesTable(filteredRoles(), COUNTS);
      scheduleRenderPreview();
    });
  }

  COUNTS = computeDefaultCounts(ROLES.map((r) => r.name));

  // Ajoute les clés de compte pour les cartes compositions (1 par défaut)
  for (const c of COMPOSITION_CARDS) {
    COUNTS[c.name] = 1;
  }

  // Ajoute les clés de compte pour les cartes ressources (0 par défaut)
  for (const r of RESOURCE_CARDS) {
    // Spiritisme cochée par défaut.
    COUNTS[r.name] = r.name === "Spiritisme (gitane)" ? 1 : (COUNTS[r.name] ?? 0);
  }

  renderRolesTable(ROLES, COUNTS);
  renderPreview();

  // Applique la contrainte dès l'initialisation (grise l'input concerné et synchronise la valeur dérivée).
  syncSizeConstraintUI();

  $("#role-filter").addEventListener("input", () => {
    renderRolesTable(filteredRoles(), COUNTS);
  });

  $("#btn-defaults").addEventListener("click", () => applyDefaults());
  $("#btn-clear-counts").addEventListener("click", () => clearCounts());

  const rerenderInputs = [
    "#size-mode",
    "#card-width",
    "#card-height",
    "#gap-mm",
    "#cut-lines",
    "#cut-lines-side",
    "#cut-line-mm",
    "#align-x",
    "#margin-x",
    "#align-y",
    "#margin-y",
    "#print-backs",
    "#back-mode",
  ];
  for (const sel of rerenderInputs) {
    $(sel).addEventListener("input", () => {
      syncSizeConstraintUI();
      updateBackModeDisabled();
      updateLayoutControlsDisabled();
      scheduleRenderPreview();
    });
    $(sel).addEventListener("change", () => {
      syncSizeConstraintUI();
      updateBackModeDisabled();
      updateLayoutControlsDisabled();
      scheduleRenderPreview();
    });
  }

  $("#btn-print").addEventListener("click", () => window.print());
}

main().catch((err) => {
  console.error(err);
  const box = $("#print-errors");
  if (box) {
    box.hidden = false;
    box.textContent = err?.message || String(err);
  } else {
    alert(err?.message || String(err));
  }
});
