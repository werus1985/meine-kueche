"use client";

import { Mic, MicOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { inputClass, Label } from "@/components/ui";
import { cn } from "@/lib/utils";

type SpeechAlternative = { transcript: string };
type SpeechResult = ArrayLike<SpeechAlternative>;
type SpeechEvent = { results: ArrayLike<SpeechResult> };
type SpeechErrorEvent = { error?: string };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const SPEECH_ERROR_MESSAGES: Record<string, string> = {
  "service-not-allowed":
    "Safari auf dem iPhone unterstützt die Spracheingabe nicht. Nutze das Feld „Datum diktieren“ mit dem Mikrofon deiner Tastatur.",
  "not-allowed":
    "Mikrofonzugriff wurde nicht erlaubt. Prüfe Einstellungen → Safari → Mikrofon („Fragen“) und erlaube den Zugriff beim nächsten Versuch.",
  "audio-capture": "Kein Mikrofon verfügbar.",
  "no-speech": "Kein Datum gehört – bitte erneut sprechen (z. B. „15.10.2026“).",
  aborted: "Spracheingabe wurde abgebrochen.",
  network:
    "Netzwerkfehler bei der Spracheingabe – Verbindung prüfen und erneut versuchen.",
};

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
  fünfte: 5,
  fünfter: 5,
  fünften: 5,
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
  zwölfte: 12,
  zwölfter: 12,
  zwölften: 12,
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
  fünf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  zwölf: 12,
  dreizehn: 13,
  vierzehn: 14,
  fünfzehn: 15,
  sechzehn: 16,
  siebzehn: 17,
  achtzehn: 18,
  neunzehn: 19,
};

const tens: Record<string, number> = {
  zwanzig: 20,
  dreißig: 30,
  vierzig: 40,
  fünfzig: 50,
  sechzig: 60,
  siebzig: 70,
  achtzig: 80,
  neunzig: 90,
};

function numberWord(value: string): number | null {
  const token = value.toLocaleLowerCase("de-DE").replace(/[.,]/g, "");
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

function toIsoDate(year: number, month: number, day: number) {
  if (year >= 0 && year < 100) year += 2000;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseGermanSpokenDate(
  transcript: string,
  options: { strictYear?: boolean } = {},
) {
  const normalized = transcript
    .toLocaleLowerCase("de-DE")
    .trim();
  // Beim Live-Diktat nur vierstellige Jahre akzeptieren, damit beim Tippen
  // keine halben Jahre („15.10.2“) als Datum gelten.
  const numeric = normalized.match(
    options.strictYear
      ? /\b(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{4})\b/
      : /\b(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{2,4})\b/,
  );
  if (numeric) return toIsoDate(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));

  const words = normalized.match(/[\p{L}\d]+/gu) ?? [];
  const monthName = words.find((word) => {
    const key = word.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return months[key] !== undefined || months[key.replace(/s$/, "")] !== undefined;
  });
  if (monthName) {
    const plainMonth = monthName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const month = months[plainMonth] ?? months[plainMonth.replace(/s$/, "")];
    const index = words.findIndex((word) => word === monthName);
    const day = index > 0 ? numberWord(words[index - 1]) : null;
    let year = index >= 0 && index + 1 < words.length ? numberWord(words[index + 1]) : null;
    if (year === 2000 && index + 2 < words.length) {
      const remainder = numberWord(words[index + 2]);
      if (remainder !== null && remainder < 1000) year += remainder;
    }
    if (day !== null && year !== null) {
      if (
        options.strictYear &&
        /^\d+$/.test(words[index + 1] ?? "") &&
        (words[index + 1] ?? "").length !== 4
      ) {
        return null;
      }
      return toIsoDate(year, month, day);
    }
  }

  if (words.length === 3) {
    const day = numberWord(words[0]);
    const month = numberWord(words[1]);
    const year = numberWord(words[2]);
    if (day !== null && month !== null && year !== null) {
      if (
        options.strictYear &&
        /^\d+$/.test(words[2]) &&
        words[2].length !== 4
      ) {
        return null;
      }
      return toIsoDate(year, month, day);
    }
  }
  return null;
}

export function ExpiryDateField({
  defaultValue,
}: {
  defaultValue: string;
}) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const dictationTimer = useRef<number | null>(null);
  const [value, setValue] = useState(defaultValue);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [dictationOpen, setDictationOpen] = useState(false);
  const [dictationText, setDictationText] = useState("");
  const [listening, setListening] = useState(false);
  const [speechMessage, setSpeechMessage] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const speechWindow = window as SpeechWindow;
      const available =
        window.isSecureContext &&
        Boolean(speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition);
      setSpeechAvailable(available);
      // Auf Geräten ohne Web-Speech (v. a. iOS Safari) direkt das
      // Tastatur-Diktat anbieten.
      let remembered = false;
      try {
        remembered = window.localStorage.getItem("mk:mhd-dictation") === "1";
      } catch {
        remembered = false;
      }
      setDictationOpen(!available || remembered);
    }, 0);
    return () => {
      window.clearTimeout(timeout);
      if (dictationTimer.current) window.clearTimeout(dictationTimer.current);
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  function applyDictation() {
    if (dictationTimer.current) {
      window.clearTimeout(dictationTimer.current);
      dictationTimer.current = null;
    }
    const text = dictationText.trim();
    if (!text) return;
    const date = parseGermanSpokenDate(text);
    if (!date) {
      setSpeechMessage(`Kein vollständiges Datum erkannt („${text}“).`);
      return;
    }
    setValue(date);
    setDictationText("");
    setSpeechMessage("Datum übernommen.");
  }

  function handleDictationChange(next: string) {
    setDictationText(next);
    if (next.trim()) setSpeechMessage(null);
    if (dictationTimer.current) window.clearTimeout(dictationTimer.current);
    // Diktat kommt streaming herein – kurz warten, bis der Satz vollständig
    // ist, dann automatisch übernehmen.
    dictationTimer.current = window.setTimeout(() => {
      const date = parseGermanSpokenDate(next, { strictYear: true });
      if (!date) return;
      setValue(date);
      setDictationText("");
      setSpeechMessage("Datum übernommen.");
    }, 900);
  }

  function startSpeechRecognition() {
    const speechWindow = window as SpeechWindow;
    const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Constructor || !window.isSecureContext) return;

    const recognition = new Constructor();
    recognitionRef.current = recognition;
    recognition.lang = "de-DE";
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
      const date = parseGermanSpokenDate(transcript);
      if (!date) {
        setSpeechMessage(`Kein vollständiges Datum erkannt${transcript ? ` („${transcript}“)` : ""}.`);
        return;
      }
      setValue(date);
      setSpeechMessage("Datum übernommen.");
    };
    recognition.onerror = (event) => {
      const code = event.error ?? "unbekannt";
      if (code === "service-not-allowed") {
        // iOS Safari unterstützt die Web-Speech-API nicht – dauerhaft auf
        // das Tastatur-Diktat umschalten.
        setDictationOpen(true);
        try {
          window.localStorage.setItem("mk:mhd-dictation", "1");
        } catch {
          // ignorieren
        }
      }
      setSpeechMessage(
        SPEECH_ERROR_MESSAGES[code] ??
          `Spracheingabe fehlgeschlagen (Code: ${code}) – bitte Datum manuell eingeben.`,
      );
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    setSpeechMessage("Bitte ein vollständiges Datum sagen, zum Beispiel „15.10.2026“.");
    setListening(true);
    try {
      recognition.start();
    } catch (cause) {
      setListening(false);
      setSpeechMessage(
        cause instanceof Error
          ? `Spracheingabe konnte nicht gestartet werden (${cause.name}: ${cause.message}) – bitte Datum manuell eingeben.`
          : "Spracheingabe konnte nicht gestartet werden – bitte Datum manuell eingeben.",
      );
    }
  }

  return (
    <div className="min-w-0">
      <Label htmlFor="expiry">Mindesthaltbarkeit</Label>
      <div className="flex min-w-0 items-center gap-2">
        <input
          id="expiry"
          name="expiry"
          type="date"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setSpeechMessage(null);
          }}
          className={cn(inputClass, "min-w-0 max-w-full")}
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              setValue("");
              setSpeechMessage(null);
            }}
            aria-label="MHD entfernen"
            title="MHD entfernen"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-stone-300 bg-white text-stone-500 transition hover:bg-red-50 hover:text-red-700"
          >
            <X className="size-4" />
          </button>
        ) : null}
        {/* Mikrofon immer zeigen – bei fehlendem HTTPS erklärt der Klick,
            warum Spracheingabe dort nicht verfügbar ist. */}
        <button
          type="button"
          onClick={() => {
            if (!speechAvailable) {
              setSpeechMessage(
                "Spracheingabe benötigt HTTPS (oder localhost). Nutze alternativ das Feld „Datum diktieren“ mit dem Mikrofon deiner Tastatur.",
              );
              setDictationOpen(true);
              return;
            }
            if (listening) {
              recognitionRef.current?.stop();
              setListening(false);
            } else {
              startSpeechRecognition();
            }
          }}
          aria-label={
            !speechAvailable
              ? "Spracheingabe (HTTPS erforderlich)"
              : listening
                ? "Spracheingabe stoppen"
                : "MHD sprechen"
          }
          title={
            !speechAvailable
              ? "Spracheingabe benötigt HTTPS (oder localhost)"
              : listening
                ? "Spracheingabe stoppen"
                : "MHD sprechen"
          }
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-xl border transition",
            listening
              ? "border-red-200 bg-red-50 text-red-700"
              : speechAvailable
                ? "border-stone-300 bg-white text-stone-600 hover:bg-emerald-50 hover:text-emerald-800"
                : "border-stone-200 bg-stone-50 text-stone-300",
          )}
        >
          {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
        </button>
      </div>

      {dictationOpen ? (
        <div className="mt-1.5">
          <Label htmlFor="expiry-dictation">Datum diktieren</Label>
          <input
            id="expiry-dictation"
            type="text"
            value={dictationText}
            onChange={(event) => handleDictationChange(event.target.value)}
            onBlur={applyDictation}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyDictation();
              }
            }}
            placeholder="z. B. 15.10.2026 oder „fünfzehnter zehnter …“"
            autoComplete="off"
            className={inputClass}
          />
          <p className="mt-1 text-[11px] text-stone-500">
            Tippe ins Feld und nutze das Mikrofon deiner Tastatur – das Datum
            wird automatisch übernommen.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setDictationOpen(true)}
          className="mt-1 text-[11px] font-medium text-emerald-800 hover:underline"
        >
          Datum per Tastatur diktieren
        </button>
      )}

      {speechMessage ? (
        <p aria-live="polite" className="mt-1 text-xs text-stone-500">
          {speechMessage}
        </p>
      ) : null}
    </div>
  );
}
