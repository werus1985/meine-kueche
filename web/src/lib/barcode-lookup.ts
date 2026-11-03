import "server-only";

/**
 * Barcode-Lookup bei Open Food Facts – nur als Einstiegshilfe gedacht.
 * Sobald ein Barcode im Haushalt bekannt ist, wird nie wieder extern
 * nachgeschlagen (die lokale Produktgruppe gewinnt immer).
 *
 * Die Datei enthält außerdem die Heuristiken, um Kategorie und Einheit aus
 * den externen Angaben auf die Haushalts-Stammdaten abzubilden.
 */

const USER_AGENT = "MeineKueche/0.1 (private Haushalts-App)";
const LOOKUP_TIMEOUT_MS = 4500;

export type ExternalProduct = {
  name: string | null;
  tags: string[];
  quantity: string | null;
  imageUrl: string | null;
};

const PLACEHOLDER_NAMES = new Set([
  "unknown",
  "unbekannt",
  "inconnu",
  "produit",
  "product",
  "no name",
  "sans nom",
  "keine angabe",
  "n/a",
  "na",
  "-",
  "...",
]);

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 200) return null;
  if (/^\d+$/.test(name)) return null;
  if (PLACEHOLDER_NAMES.has(name.toLocaleLowerCase("de-DE"))) return null;
  return name;
}

function cleanTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const tags = value
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) =>
      tag
        .trim()
        .toLocaleLowerCase("de-DE")
        .replace(/^[a-z]{2}:/, "")
        .replace(/\s+/g, "-"),
    )
    .filter((tag) => tag.length >= 2 && tag.length <= 80);
  return [...new Set(tags)].slice(0, 20);
}

type OffProduct = {
  product_name?: unknown;
  product_name_de?: unknown;
  generic_name?: unknown;
  abbreviations?: unknown;
  categories_tags?: unknown;
  quantity?: unknown;
  image_front_url?: unknown;
  image_url?: unknown;
};

/** Fragt Open Food Facts ab. Fehler/Timeouts ergeben `null` (stiller Fallback). */
export async function lookupExternalProduct(
  barcode: string,
): Promise<ExternalProduct | null> {
  const fields = [
    "product_name",
    "product_name_de",
    "generic_name",
    "abbreviations",
    "categories_tags",
    "quantity",
    "image_front_url",
    "image_url",
  ].join(",");
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
    barcode,
  )}.json?fields=${fields}`;

  let product: OffProduct | null = null;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const json = (await response.json()) as {
      status?: number;
      product?: OffProduct;
    };
    if (json.status !== 1 || !json.product) return null;
    product = json.product;
  } catch {
    return null;
  }

  const name =
    cleanName(product.product_name_de) ??
    cleanName(product.product_name) ??
    cleanName(product.generic_name) ??
    cleanName(product.abbreviations);

  const tags = cleanTags(product.categories_tags);
  const quantity =
    typeof product.quantity === "string" && product.quantity.trim()
      ? product.quantity.trim().slice(0, 60)
      : null;
  const imageUrl = [product.image_front_url, product.image_url].find(
    (value): value is string =>
      typeof value === "string" &&
      isAllowedExternalPhotoUrl(value),
  ) ?? null;

  // Ohne Namen und ohne Kategorien ist der Eintrag nutzlos.
  if (!name && tags.length === 0) return null;

  return { name, tags, quantity, imageUrl };
}

/** Nur offizielle Open-Food-Facts-Bild-Hosts zulassen (kein SSRF). */
export function isAllowedExternalPhotoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return (
      url.hostname === "openfoodfacts.org" ||
      url.hostname.endsWith(".openfoodfacts.org") ||
      url.hostname === "openfoodfacts.net" ||
      url.hostname.endsWith(".openfoodfacts.net")
    );
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------------------
// Kategorie-Heuristik
// ----------------------------------------------------------------------------

type KeywordGroup = {
  /** Begriffe, die im Kategorienamen des Haushalts vorkommen dürfen. */
  names: string[];
  /** Begriffe, die in den externen Tags vorkommen dürfen. */
  tags: string[];
};

const CATEGORY_KEYWORDS: KeywordGroup[] = [
  {
    names: ["milch", "dairy", "molkerei", "käse", "kaese", "joghurt", "quark", "sahne", "butter"],
    tags: ["milk", "dair", "yogurt", "joghurt", "cheese", "quark", "butter", "cream", "sahne", "fromage"],
  },
  {
    names: ["getränk", "getraenk", "drink", "saft", "wasser", "bier", "wein"],
    tags: ["beverage", "drink", "juice", "water", "soda", "beer", "wine", "coffee", "tea", "energy-drink", "plant-based-beverage"],
  },
  {
    names: ["obst", "gemüse", "gemuese", "frucht"],
    tags: ["fruit", "vegetable", "salad", "apple", "banana", "berry", "tomato", "potato", "onion", "legume"],
  },
  {
    names: ["fleisch", "wurst", "geflügel", "gefluegel", "fisch"],
    tags: ["meat", "sausage", "poultry", "chicken", "beef", "pork", "fish", "seafood"],
  },
  {
    names: ["back", "brot"],
    tags: ["bread", "bakery", "cake", "pastry", "baked", "viennoiserie"],
  },
  {
    names: ["vorrat", "trocken", "konserve", "nudel", "reis", "mehl", "haltbar"],
    tags: ["pasta", "rice", "flour", "cereal", "canned", "sauce", "oil", "vinegar", "sugar", "grain", "preserved", "condiment"],
  },
  {
    names: ["gewürz", "gewuerz"],
    tags: ["spice", "herb", "salt", "pepper", "seasoning", "condiment"],
  },
  {
    names: ["süß", "suess", "snack", "schokolade", "keks"],
    tags: ["snack", "sweet", "chocolate", "candy", "biscuit", "cookie", "dessert", "confectionery"],
  },
  {
    names: ["tiefkühl", "tiefkuehl", "tk"],
    tags: ["frozen", "ice-cream"],
  },
  {
    names: ["haushalt", "reinigung"],
    tags: ["cleaning", "detergent", "household", "paper", "laundry", "dishwash"],
  },
  {
    names: ["drogerie", "kosmetik", "hygiene", "pflege"],
    tags: ["cosmetic", "hygiene", "care", "shampoo", "soap", "beauty"],
  },
];

function normalize(value: string) {
  return value
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Ordnet externe Kategorie-Tags einer Haushaltskategorie zu.
 * Reihenfolge: Keyword-Gruppen (Mehrfachtreffer zählen) → direkte
 * Namensüberschneidung → „Allgemein“.
 */
export function guessCategoryId(
  tags: string[],
  categories: { id: string; name: string }[],
): string | null {
  if (categories.length === 0) return null;
  const normalizedTags = tags.map(normalize).filter(Boolean);

  let best: { id: string; score: number } | null = null;
  for (const category of categories) {
    const categoryName = normalize(category.name);
    let score = 0;

    for (const group of CATEGORY_KEYWORDS) {
      const categoryMatches = group.names.some((keyword) =>
        categoryName.includes(normalize(keyword)),
      );
      if (!categoryMatches) continue;
      for (const tag of normalizedTags) {
        if (group.tags.some((keyword) => tag.includes(normalize(keyword)))) {
          score += 1;
        }
      }
    }

    // Direkte Überschneidung (z. B. Kategorie „Getränke“ in einem Tag).
    for (const tag of normalizedTags) {
      for (const word of categoryName.split(" ")) {
        if (word.length >= 4 && tag.includes(word)) score += 1;
      }
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { id: category.id, score };
    }
  }

  if (best) return best.id;
  const fallback = categories.find(
    (category) => normalize(category.name) === "allgemein",
  );
  return fallback?.id ?? null;
}

// ----------------------------------------------------------------------------
// Einheiten-Heuristik
// ----------------------------------------------------------------------------

type UnitOption = { id: string; name: string };

const UNIT_ALIASES: Record<string, string[]> = {
  ml: ["milliliter", "ml"],
  l: ["liter", "l", "litre"],
  cl: ["zentiliter", "cl"],
  dl: ["deziliter", "dl"],
  g: ["gramm", "g", "gr"],
  kg: ["kilogramm", "kg", "kilo"],
  mg: ["milligramm", "mg"],
  stueck: ["stuck", "stueck", "stk", "st", "stuck", "piece", "pieces", "pcs", "x", "pack", "packung", "packungen", "bund"],
};

/**
 * Leitet aus der Packungsgröße („750 ml“, „6 × 100 g“) eine passende
 * Haushaltseinheit ab. `null`, wenn nichts Eindeutiges gefunden wird.
 */
export function guessUnitId(
  quantity: string | null,
  units: UnitOption[],
): string | null {
  if (!quantity) return null;
  const text = quantity
    .toLocaleLowerCase("de-DE")
    .replace(/,/g, ".")
    .trim();
  const match = text.match(
    /(\d+(?:\.\d+)?)\s*(kg|kilogramm|kilo|g|gramm|mg|milligramm|l|liter|litre|ml|milliliter|cl|dl|stk\.?|stück|stueck|pack(?:ung|ungen)?|pcs|st)\b/,
  );
  if (!match) return null;

  const raw = match[2];
  let key: keyof typeof UNIT_ALIASES;
  if (raw.startsWith("kg") || raw.startsWith("kilo")) key = "kg";
  else if (raw.startsWith("mg")) key = "mg";
  else if (raw.startsWith("ml")) key = "ml";
  else if (raw.startsWith("cl")) key = "cl";
  else if (raw.startsWith("dl")) key = "dl";
  else if (raw === "l" || raw.startsWith("liter") || raw.startsWith("litre")) key = "l";
  else if (raw === "g" || raw.startsWith("gramm")) key = "g";
  else key = "stueck";

  const aliases = UNIT_ALIASES[key].map(normalize);
  const found = units.find((unit) => {
    const name = normalize(unit.name);
    const tokens = name.split(" ").filter(Boolean);
    return aliases.some(
      (alias) => name === alias || tokens.includes(alias),
    );
  });
  return found?.id ?? null;
}
