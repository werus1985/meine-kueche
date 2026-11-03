import "server-only";

const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

// Bei nicht verfügbaren oder überlasteten Modellen wird automatisch das
// nächste versucht. Veraltete Modelle (z. B. 2.5) werden von Google für neue
// API-Keys nicht mehr bereitgestellt.
// Zuverlässige Modelle zuerst; die Flaggschiff-Modelle sind derzeit oft
// ausgelastet. Das zuletzt erfolgreiche Modell wird zusätzlich bevorzugt.
const GEMINI_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.1-flash-lite",
];

// Gemini antwortet unter Last teils erst nach 20–35 Sekunden.
const GEMINI_TIMEOUT_MS = 45_000;

// Zuletzt erfolgreiches Modell bevorzugen, damit nicht bei jeder Anfrage
// erneut überlastete Modelle probiert werden.
let preferredModel: string | null = null;

function orderedModels() {
  if (!preferredModel || !GEMINI_MODELS.includes(preferredModel)) {
    return GEMINI_MODELS;
  }
  return [
    preferredModel,
    ...GEMINI_MODELS.filter((model) => model !== preferredModel),
  ];
}

const TEMPORARY_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

type GeminiApiResponse = {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
};

export type GeminiCallResult =
  | { ok: true; text: string; model: string }
  | { ok: false; status: number; message: string };

export async function callGemini(
  prompt: string,
  generationConfig: Record<string, unknown> = {},
): Promise<GeminiCallResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      message:
        "Die KI ist noch nicht eingerichtet. Trage GEMINI_API_KEY in web/.env.local ein und starte den Server neu.",
    };
  }

  let lastStatus = 503;
  let lastMessage =
    "Alle verfügbaren Gemini-Modelle sind momentan nicht erreichbar.";

  for (let attempt = 0; attempt < 2; attempt++) {
    for (const model of orderedModels()) {
    let response: Response;
    try {
      response = await fetch(`${GEMINI_BASE_URL}/${model}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig,
        }),
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      });
    } catch (cause) {
      console.error(`Gemini-Netzwerkfehler bei ${model}:`, String(cause));
      lastStatus = 503;
      lastMessage = "Verbindungsfehler beim Zugriff auf Gemini.";
      continue;
    }

    const raw = await response.text();
    let result: GeminiApiResponse = {};
    try {
      result = raw ? (JSON.parse(raw) as GeminiApiResponse) : {};
    } catch {
      result = {};
    }

    if (response.ok) {
      const text = result.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim();
      if (text) {
        // Bei JSON-Anfragen nur verwertbare Antworten akzeptieren – sonst
        // das nächste Modell versuchen (verhindert „keine gültigen Rezepte“
        // durch ein Modell, das das Format ignoriert).
        if (generationConfig.responseMimeType === "application/json") {
          try {
            JSON.parse(text);
          } catch {
            console.error(`Gemini ${model} lieferte ungültiges JSON.`);
            lastStatus = 502;
            lastMessage = "Gemini hat ungültige Daten geliefert.";
            continue;
          }
        }
        preferredModel = model;
        return { ok: true, text, model };
      }
      lastStatus = 502;
      lastMessage = "Gemini hat keine verwertbare Textantwort geliefert.";
      continue;
    }

    lastStatus = response.status;
    console.error(
      `Gemini ${model} fehlgeschlagen: HTTP ${response.status}`,
      raw.slice(0, 1000),
    );

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        status: 502,
        message:
          "Gemini hat den Zugriff verweigert. Bitte prüfe den API-Schlüssel und die API-Berechtigungen.",
      };
    }
    if (response.status === 404) {
      lastMessage = `Das Modell ${model} ist für diesen API-Zugang nicht verfügbar.`;
      continue;
    }
    if (TEMPORARY_STATUSES.has(response.status)) {
      lastMessage =
        "Gemini ist momentan ausgelastet oder ein Nutzungslimit wurde erreicht.";
      continue;
    }

    return {
      ok: false,
      status: 502,
      message:
        "Gemini konnte die Anfrage nicht verarbeiten. Bitte versuche es später erneut.",
    };
  }

    if (attempt === 0) {
      // Kurz warten und die Kette einmal wiederholen – die 503er sind oft
      // nur kurze Lastspitzen.
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.error("Alle Gemini-Fallbacks fehlgeschlagen.", {
    lastStatus,
    models: GEMINI_MODELS,
  });

  return {
    ok: false,
    status: lastStatus,
    message: `${lastMessage} Bitte versuche es später erneut.`,
  };
}

export function parseJsonObject(
  text: string,
): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fallback: JSON aus einer eventuell vorhandenen Markdown-Hülle schälen.
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Ungültiges JSON.
    }
  }
  return null;
}

export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean)
    .slice(0, 30);
}

export type NormalizedListItem = {
  name: string;
  qty?: string;
  unit?: string;
  category?: string;
  notes?: string;
};

export function normalizeListItems(value: unknown): NormalizedListItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === "object",
    )
    .slice(0, 100)
    .filter((entry) => String(entry.name ?? "").trim().length > 0)
    .map((entry) => ({
      name: String(entry.name).trim().slice(0, 120),
      qty: String(entry.qty ?? entry.quantity ?? "").slice(0, 40),
      unit: String(entry.unit ?? "").slice(0, 30),
      category: String(entry.category ?? "").slice(0, 60),
      notes: String(entry.notes ?? entry.description ?? "").slice(0, 200),
    }));
}
