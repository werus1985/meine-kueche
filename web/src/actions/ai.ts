"use server";

import { revalidatePath } from "next/cache";

import { getActiveHousehold } from "@/lib/data";
import { AI_KEY_MISSING_MESSAGE, resolveGeminiKey } from "@/lib/ai-key";
import {
  callGemini,
  normalizeListItems,
  parseJsonObject,
  toStringArray,
  type NormalizedListItem,
} from "@/lib/gemini";
import { createClient } from "@/lib/supabase/server";

export type AiRecipe = {
  name: string;
  description?: string;
  ingredients: string[];
  missing: string[];
  steps: string[];
  time_minutes?: number;
  servings?: number;
};

export type AiListItem = NormalizedListItem;

export type AiResponseType =
  | "text"
  | "recipes"
  | "shopping_list"
  | "product_list"
  | "stock_list"
  | "general_list";

export type AiResult = {
  ok: boolean;
  message: string;
  answer?: string;
  responseType?: AiResponseType;
  recipes?: AiRecipe[];
  items?: AiListItem[];
  title?: string;
};

export type AiHistoryEntry = {
  role: "user" | "assistant";
  content: string;
};

export type AddToShoppingResult = {
  ok: boolean;
  message: string;
  added: number;
};

type Relation = { name: string } | { name: string }[] | null;

type StockRow = {
  name: string;
  qty: number | null;
  expiry: string | null;
  purchased_at: string | null;
  kitchen_categories: Relation;
  kitchen_locations: Relation;
  kitchen_units: Relation;
};

type ShoppingRow = {
  name: string;
  qty: number | null;
  kitchen_units: Relation;
};

function relationName(value: Relation) {
  if (!value) return "";
  return Array.isArray(value) ? value[0]?.name ?? "" : value.name;
}

function cleanAnswer(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "• ")
    .trim();
}

function normalizeRecipes(value: unknown, limit = 3): AiRecipe[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === "object",
    )
    .slice(0, limit)
    .map((entry, index) => {
      const time = Number(entry.time_minutes);
      const servings = Number(entry.servings);
      return {
        name: String(entry.name ?? `Rezept ${index + 1}`).slice(0, 120),
        description:
          typeof entry.description === "string"
            ? entry.description.slice(0, 600)
            : undefined,
        ingredients: toStringArray(entry.ingredients),
        missing: toStringArray(entry.missing),
        steps: toStringArray(entry.steps),
        time_minutes: Number.isFinite(time) ? time : undefined,
        servings:
          Number.isFinite(servings) && servings >= 1 && servings <= 100
            ? Math.round(servings)
            : undefined,
      };
    });
}

async function loadKitchen(householdId: string) {
  const supabase = await createClient();

  const [stockResult, shoppingResult] = await Promise.all([
    supabase
      .from("kitchen_items")
      .select(
        "name, qty, expiry, purchased_at, kitchen_categories(name), kitchen_locations(name), kitchen_units(name)",
      )
      .eq("household_id", householdId)
      .eq("kind", "stock")
      .is("deleted_at", null)
      .order("expiry", { ascending: true, nullsFirst: false })
      .limit(400),
    supabase
      .from("kitchen_items")
      .select("name, qty, kitchen_units(name)")
      .eq("household_id", householdId)
      .eq("kind", "shop")
      .eq("checked", false)
      .is("deleted_at", null)
      .limit(100),
  ]);

  const stock = ((stockResult.data ?? []) as unknown as StockRow[]).map(
    (row) => ({
      name: row.name,
      menge: row.qty ?? "unbekannt",
      einheit: relationName(row.kitchen_units),
      mhd: row.expiry ?? "nicht angegeben",
      kategorie: relationName(row.kitchen_categories) || "Allgemein",
      lagerort: relationName(row.kitchen_locations) || "nicht angegeben",
      kaufdatum: row.purchased_at ?? "nicht angegeben",
    }),
  );

  const shopping = ((shoppingResult.data ?? []) as unknown as ShoppingRow[]).map(
    (row) => ({
      name: row.name,
      menge: row.qty ?? "1",
      einheit: relationName(row.kitchen_units) || "Stück",
    }),
  );

  return { stock, shopping };
}

export async function chatAction(
  message: string,
  history: AiHistoryEntry[],
): Promise<AiResult> {
  const context = await getActiveHousehold();
  if (!context) return { ok: false, message: "Kein Haushalt ausgewählt." };

  const text = String(message ?? "").trim().slice(0, 1500);
  if (!text) return { ok: false, message: "Bitte gib eine Nachricht ein." };

  const { stock, shopping } = await loadKitchen(context.active.id);

  const safeHistory = (Array.isArray(history) ? history : [])
    .slice(-12)
    .map((entry) => ({
      role: entry?.role === "assistant" ? "assistant" : "user",
      content: String(entry?.content ?? "").slice(0, 1200),
    }));

  const historyText = safeHistory
    .map(
      (entry) =>
        `${entry.role === "assistant" ? "Küchenassistent" : "Nutzer"}: ${entry.content}`,
    )
    .join("\n");

  const prompt = `Du bist der freundliche KI-Küchenhelfer der App „Meine Küche“. Antworte auf Deutsch.
Vorratsregeln:
- Nur Einträge aus dem Vorrat sind bereits vorhanden; die offene Einkaufsliste ist nicht der Vorrat.
- Erfinde keine Vorratsmengen.
- Bei Haltbarkeit vorsichtig sein; bei Unsicherheit nicht zum Verzehr raten. Bevorzuge Zutaten, die bald ablaufen.
- Bei normalen Wissensfragen antworte als klarer, normaler Text.
- Wenn Nutzer Rezepte, Einkaufslisten, Produktlisten, Bestandslisten oder andere konkrete Listen anfordert, gib strukturierte Daten zurück, nicht Markdown.
- Wähle type passend: "recipes", "shopping_list", "product_list", "stock_list" oder "general_list".
- Rezeptformat: {"type":"recipes","message":"Einleitung","recipes":[{"name":"Name","description":"Beschreibung","servings":4,"ingredients":["Menge Zutat"],"missing":["fehlende Zutat"],"steps":["Schritt"],"time_minutes":20}]}
- Gib servings als typische Portionenzahl des Gerichts an (bei Kuchen/Gebäck die Stückzahl).
- Listenformat: {"type":"shopping_list","title":"Einkaufsliste","message":"Kurze Einleitung","items":[{"name":"Artikel","qty":"Menge","unit":"Einheit","category":"Kategorie","notes":"Hinweis"}]}
- Bei einer Einkaufsliste nenne nur empfohlene, noch zu kaufende Artikel; unterscheide sie vom bereits vorhandenen Vorrat. Wenn passend, priorisiere Grundnahrungsmittel. Erfinde nicht, dass Artikel bereits vorhanden sind, wenn sie nur empfohlen werden.
- Bei Produkt-/Vorratslisten nutze dieselbe items-Struktur. Wenn die Nutzerfrage keine konkrete Liste verlangt, gib normalen Text zurück.
- Gib bei strukturierten Antworten ausschließlich gültiges JSON zurück, ohne Markdown-Codeblock oder zusätzlichen Text.
- Antworte nicht mit JSON, wenn es eine normale Frage ist.

Vorrat: ${JSON.stringify(stock)}
Offene Einkaufsliste: ${JSON.stringify(shopping)}
Gesprächsverlauf:
${historyText || "(Beginn)"}
Aktuelle Nachricht: ${text}`;

  const keyInfo = await resolveGeminiKey();
  if (!keyInfo) return { ok: false, message: AI_KEY_MISSING_MESSAGE };

  const gemini = await callGemini(
    prompt,
    {
      temperature: 0.4,
      maxOutputTokens: 4096,
      // Internes „Nachdenken“ kostet unnötig Tokens und Zeit.
      thinkingConfig: { thinkingBudget: 0 },
    },
    keyInfo.key,
  );
  if (!gemini.ok) return { ok: false, message: gemini.message };

  const parsed = parseJsonObject(gemini.text);
  if (parsed && parsed.type === "recipes" && Array.isArray(parsed.recipes)) {
    const recipes = normalizeRecipes(parsed.recipes, 3);
    if (recipes.length > 0) {
      return {
        ok: true,
        message: "",
        answer: String(
          parsed.message ?? "Hier sind passende Rezeptideen:",
        ),
        responseType: "recipes",
        recipes,
      };
    }
  }

  const listTypes: AiResponseType[] = [
    "shopping_list",
    "product_list",
    "stock_list",
    "general_list",
  ];
  if (
    parsed &&
    typeof parsed.type === "string" &&
    listTypes.includes(parsed.type as AiResponseType) &&
    Array.isArray(parsed.items)
  ) {
    return {
      ok: true,
      message: "",
      answer: String(
        parsed.message ?? parsed.title ?? "Hier ist die gewünschte Liste:",
      ),
      responseType: parsed.type as AiResponseType,
      title: String(parsed.title ?? "Liste"),
      items: normalizeListItems(parsed.items),
    };
  }

  return {
    ok: true,
    message: "",
    answer: cleanAnswer(gemini.text),
    responseType: "text",
  };
}

function parseQuantity(value: string | undefined) {
  const match = String(value ?? "").match(/\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const number = Number(match[0].replace(",", "."));
  return Number.isFinite(number) && number > 0 ? number : null;
}

export async function addItemsToShoppingAction(
  items: AiListItem[],
  note = "Aus dem KI-Chat",
): Promise<AddToShoppingResult> {
  const context = await getActiveHousehold();
  if (!context) {
    return { ok: false, message: "Kein Haushalt ausgewählt.", added: 0 };
  }
  if (!context.active.canWrite) {
    return {
      ok: false,
      message: "Du hast in diesem Haushalt nur Leserechte.",
      added: 0,
    };
  }

  const clean = (Array.isArray(items) ? items : [])
    .slice(0, 100)
    .map((item) => ({
      name: String(item?.name ?? "").trim().slice(0, 120),
      qty: parseQuantity(item?.qty),
      unit: String(item?.unit ?? "").trim().slice(0, 30),
      category: String(item?.category ?? "").trim().slice(0, 60),
      notes: String(item?.notes ?? "").trim().slice(0, 200),
    }))
    .filter((item) => item.name.length > 0);

  if (clean.length === 0) {
    return {
      ok: false,
      message: "Es wurden keine Artikel zum Übernehmen gefunden.",
      added: 0,
    };
  }

  const supabase = await createClient();
  const [categoriesResult, unitsResult, existingResult] = await Promise.all([
    supabase
      .from("kitchen_categories")
      .select("id, name")
      .eq("household_id", context.active.id),
    supabase
      .from("kitchen_units")
      .select("id, name")
      .eq("household_id", context.active.id),
    supabase
      .from("kitchen_items")
      .select("name")
      .eq("household_id", context.active.id)
      .eq("kind", "shop")
      .eq("checked", false)
      .is("deleted_at", null),
  ]);

  const categoryByName = new Map(
    (categoriesResult.data ?? []).map((category) => [
      category.name.trim().toLowerCase(),
      category.id,
    ]),
  );
  const unitByName = new Map(
    (unitsResult.data ?? []).map((unit) => [
      unit.name.trim().toLowerCase(),
      unit.id,
    ]),
  );
  const existingNames = new Set(
    (existingResult.data ?? []).map((item) =>
      item.name.trim().toLowerCase(),
    ),
  );

  const rows: {
    household_id: string;
    kind: "shop";
    name: string;
    qty: number | null;
    category_id: string | null;
    unit_id: string | null;
    notes: string;
    checked: boolean;
  }[] = [];
  for (const item of clean) {
    const key = item.name.toLowerCase();
    if (existingNames.has(key)) continue;
    existingNames.add(key);
    rows.push({
      household_id: context.active.id,
      kind: "shop" as const,
      name: item.name,
      qty: item.qty,
      category_id: categoryByName.get(item.category.toLowerCase()) ?? null,
      unit_id: unitByName.get(item.unit.toLowerCase()) ?? null,
      notes: [item.notes, note].filter(Boolean).join(" · ").slice(0, 2000),
      checked: false,
    });
  }

  if (rows.length === 0) {
    return {
      ok: true,
      message: "Diese Artikel stehen bereits auf der Einkaufsliste.",
      added: 0,
    };
  }

  const { error } = await supabase.from("kitchen_items").insert(rows);
  if (error) {
    return { ok: false, message: error.message, added: 0 };
  }

  revalidatePath("/items");
  revalidatePath("/");
  revalidatePath("/ai");

  return {
    ok: true,
    message: `${rows.length} ${
      rows.length === 1 ? "Artikel wurde" : "Artikel wurden"
    } zur Einkaufsliste hinzugefügt.`,
    added: rows.length,
  };
}
