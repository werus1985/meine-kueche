/**
 * Datumseingabe für das MHD (Mindesthaltbarkeitsdatum).
 *
 * Bewusst ohne Trennzeichen-Zwang: `1510`, `151026` und `15102026` werden
 * genauso erkannt wie `15.10.2026`, `15/10/26`, ein eingefügtes ISO-Datum
 * oder eine diktierte Wortform („fünfzehnter zehnter zweitausendsechs“).
 */

const months: Record<string, number> = {
  januar: 1,
  februar: 2,
  marz: 3,
  maerz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
};

const ordinals: Record<string, number> = {
  erste: 1,
  erster: 1,
  ersten: 1,
  erstem: 1,
  erstes: 1,
  zweite: 2,
  zweiter: 2,
  zweiten: 2,
  zweites: 2,
  dritte: 3,
  dritter: 3,
  dritten: 3,
  drittes: 3,
  vierte: 4,
  vierter: 4,
  vierten: 4,
  funfte: 5,
  funfter: 5,
  funften: 5,
  sechste: 6,
  sechster: 6,
  sechsten: 6,
  siebte: 7,
  siebter: 7,
  siebten: 7,
  achte: 8,
  achter: 8,
  achten: 8,
  neunte: 9,
  neunter: 9,
  neunten: 9,
  zehnte: 10,
  zehnter: 10,
  zehnten: 10,
  elfte: 11,
  elfter: 11,
  elften: 11,
  zwolfte: 12,
  zwolfter: 12,
  zwolften: 12,
};

const smallNumbers: Record<string, number> = {
  null: 0,
  ein: 1,
  eins: 1,
  eine: 1,
  einen: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  funf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  zwolf: 12,
  dreizehn: 13,
  vierzehn: 14,
  funfzehn: 15,
  sechzehn: 16,
  siebzehn: 17,
  achtzehn: 18,
  neunzehn: 19,
};

const tens: Record<string, number> = {
  zwanzig: 20,
  dreißig: 30,
  vierzig: 40,
  funfzig: 50,
  sechzig: 60,
  siebzig: 70,
  achtzig: 80,
  neunzig: 90,
};

export type ParsedExpiry = {
  /** Für Datenbank und Formular: `YYYY-MM-DD`. */
  iso: string;
  /** Kanonische Anzeige: `TT.MM.JJJJ`. */
  display: string;
  /** true, wenn die Eingabe die Jahreszahl enthielt (nicht ergänzt wurde). */
  hasYear: boolean;
};

function normalizeWord(value: string) {
  return value
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Zahlwort einer diktierten Datumsangabe in eine Zahl übersetzen. */
function numberWord(value: string): number | null {
  const token = normalizeWord(value).replace(/[.,]/g, "");
  if (/^\d{1,4}$/.test(token)) return Number(token);
  if (ordinals[token] !== undefined) return ordinals[token];
  if (smallNumbers[token] !== undefined) return smallNumbers[token];
  if (tens[token] !== undefined) return tens[token];

  const yearParts = token.match(/^(.+?)tausend(.*)$/);
  if (yearParts) {
    const thousand = smallNumbers[yearParts[1]];
    const rest = yearParts[2] ? numberWord(yearParts[2]) : 0;
    if (thousand !== undefined && rest !== null) return thousand * 1000 + rest;
  }

  const ordinalSuffix = token.replace(/(?:sten|ster|stes|ste|ten|ter|tes|tem)$/, "");
  if (ordinalSuffix !== token) {
    const parsed = numberWord(ordinalSuffix);
    if (parsed !== null) return parsed;
  }

  const compound = token.match(/^(.+?)und(.+)$/);
  if (compound) {
    const one = smallNumbers[compound[1]];
    const ten = tens[compound[2]];
    if (one !== undefined && ten !== undefined) return ten + one;
  }
  return null;
}

type DateParts = Omit<ParsedExpiry, "hasYear">;

function buildDate(year: number, month: number, day: number): DateParts | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (year >= 0 && year < 100) year += 2000;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return {
    iso,
    display: `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`,
  };
}

/**
 * Fehlt die Jahreszahl, wird das aktuelle Jahr genommen – liegt das Datum
 * dadurch in der Vergangenheit, das Folgejahr (ein MHD ist nie „gestern“).
 */
function completedYear(day: number, month: number, today: Date) {
  const currentYear = today.getFullYear();
  const candidate = Date.UTC(currentYear, month - 1, day);
  const todayStart = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  return candidate < todayStart ? currentYear + 1 : currentYear;
}

function parseSpokenDate(input: string, today: Date): ParsedExpiry | null {
  const words = normalizeWord(input).match(/[\p{L}\d]+/gu) ?? [];
  if (words.length === 0) return null;

  const monthIndex = words.findIndex((word) => {
    const key = word.replace(/s$/, "");
    return months[word] !== undefined || months[key] !== undefined;
  });

  if (monthIndex >= 0) {
    const key = words[monthIndex];
    const month = months[key] ?? months[key.replace(/s$/, "")];
    if (month === undefined) return null;

    const day = monthIndex > 0 ? numberWord(words[monthIndex - 1]) : null;
    if (day === null) return null;

    let year =
      monthIndex + 1 < words.length ? numberWord(words[monthIndex + 1]) : null;
    // „zweitausendsechs“ kommt als „zwei tausend sechs“ an.
    if (year === 2000 && monthIndex + 2 < words.length) {
      const rest = numberWord(words[monthIndex + 2]);
      if (rest !== null && rest < 1000) year += rest;
    }

    const hasYear = year !== null;
    const parsed = buildDate(
      year ?? completedYear(day, month, today),
      month,
      day,
    );
    return parsed ? { ...parsed, hasYear } : null;
  }

  if (words.length === 3) {
    const day = numberWord(words[0]);
    const month = numberWord(words[1]);
    const year = numberWord(words[2]);
    if (day !== null && month !== null && year !== null) {
      const parsed = buildDate(year, month, day);
      if (parsed) return { ...parsed, hasYear: true };
    }
  }

  return null;
}

/**
 * Eingabe in ein Datum übersetzen. `null`, wenn kein gültiges Datum enthalten
 * ist (mehrdeutige Ziffernfolgen wie `112` werden bewusst abgelehnt).
 */
export function normalizeExpiryInput(
  input: string,
  today: Date = new Date(),
): ParsedExpiry | null {
  const text = String(input ?? "").trim();
  if (!text) return null;

  // Aus der Datenbank oder Zwischenablage eingefügtes ISO-Datum.
  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const parsed = buildDate(
      Number(isoMatch[1]),
      Number(isoMatch[2]),
      Number(isoMatch[3]),
    );
    return parsed ? { ...parsed, hasYear: true } : null;
  }

  const compact = text.replace(/\s+/g, "");

  // Mit Trennzeichen: 15.10.2026, 15/10/26, 15-10, 15.10.
  const separated = compact.match(
    /^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\.?$/,
  );
  if (separated) {
    const day = Number(separated[1]);
    const month = Number(separated[2]);
    const year = separated[3]
      ? Number(separated[3])
      : completedYear(day, month, today);
    const parsed = buildDate(year, month, day);
    return parsed ? { ...parsed, hasYear: Boolean(separated[3]) } : null;
  }

  // Diktat hängt das Jahr ohne zweiten Punkt an: 10.42020, 15.1026.
  const glued = compact.match(/^(\d{1,2})[./-](\d+)$/);
  if (glued) {
    const day = Number(glued[1]);
    const rest = glued[2];
    // Monat kann ein- oder zweistellig sein, Jahr zwei- oder vierstellig.
    for (const monthLength of [2, 1]) {
      for (const yearLength of [4, 2]) {
        if (rest.length !== monthLength + yearLength) continue;
        const parsed = buildDate(
          Number(rest.slice(monthLength)),
          Number(rest.slice(0, monthLength)),
          day,
        );
        if (parsed) return { ...parsed, hasYear: true };
      }
    }
  }

  // Reine Ziffern: 1510 (Tag/Monat), 151026, 15102026.
  if (/^\d+$/.test(compact)) {
    if (compact.length === 4) {
      const day = Number(compact.slice(0, 2));
      const month = Number(compact.slice(2, 4));
      const parsed = buildDate(
        completedYear(day, month, today),
        month,
        day,
      );
      return parsed ? { ...parsed, hasYear: false } : null;
    }
    if (compact.length === 6 || compact.length === 8) {
      const day = Number(compact.slice(0, 2));
      const month = Number(compact.slice(2, 4));
      const parsed = buildDate(Number(compact.slice(4)), month, day);
      return parsed ? { ...parsed, hasYear: true } : null;
    }
    return null;
  }

  // Diktierte Wortformen: „fünfzehnter Oktober 2026“.
  return parseSpokenDate(text, today);
}
