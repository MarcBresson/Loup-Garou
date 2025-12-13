// Données extraites du tableau du README au runtime.
// On évite de dupliquer manuellement les valeurs : le parseur lit `../README.md` via fetch.
// Sur GitHub Pages, le README est accessible en relatif.

export async function loadRolesFromReadme() {
  const res = await fetch("../README.md", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Impossible de charger README.md (" + res.status + ")");
  }
  const text = await res.text();

  // On récupère les lignes du tableau markdown: | Role | Provenance | Camp typique | ... | Balance |
  // Balance est un entier signé.
  const rowRe = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([+-]?\d+)\s*\|\s*$/gm;

  /** @type {Array<{name:string, origin:string, camp:string, balance:number}>} */
  const roles = [];

  let m;
  while ((m = rowRe.exec(text)) !== null) {
    const name = m[1].trim();
    const origin = m[2].trim();
    const camp = m[3].trim();
    const bal = Number.parseInt(m[5], 10);
    if (!Number.isFinite(bal)) continue;
    if (name.toLowerCase() === "rôle") continue;
    roles.push({ name, origin, camp, balance: bal });
  }

  if (roles.length < 10) {
    throw new Error(
      "Parse README échoué: seulement " + roles.length + " rôles trouvés."
    );
  }

  // Normalisation camps (pour stats)
  for (const r of roles) {
    r.camp = normalizeCamp(r.camp);
  }

  return roles;
}

export function normalizeCamp(camp) {
  const c = String(camp).toLowerCase();
  if (c.includes("loup")) return "loup";
  if (c.includes("neutre")) return "neutre";
  if (c.includes("variable")) return "variable";
  return "village";
}

export const MULTI_PACKS = {
  "Deux Sœurs": 2,
  "Trois Frères": 3,
};

export const DUPLICABLES = new Set([
  "Simple Villageois",
  "Villageois-Villageois",
  "Simple Loup-Garou",
]);

// Quantités par défaut pour imprimer un paquet “standard”.
// - rôles uniques: 1
// - packs: taille du pack
// - duplicables: valeurs par défaut demandées
export const DEFAULT_PRINT_COUNTS = {
  "Deux Sœurs": 2,
  "Trois Frères": 3,
  "Simple Loup-Garou": 5,
  "Simple Villageois": 6,
  "Villageois-Villageois": 6,
};
