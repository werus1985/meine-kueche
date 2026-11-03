"use client";

import { X } from "lucide-react";
import {
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";

import { inputClass, Label } from "@/components/ui";
import { normalizeExpiryInput } from "@/lib/date-input";
import { cn } from "@/lib/utils";

const INVALID_HINT = "Kein gültiges Datum – z. B. 15.10.2026 oder 15102026.";

function formatDigits(digits: string) {
  const value = digits.slice(0, 8);
  if (value.length <= 2) return value;
  if (value.length <= 4) return `${value.slice(0, 2)}.${value.slice(2)}`;
  return `${value.slice(0, 2)}.${value.slice(2, 4)}.${value.slice(4)}`;
}

function countDigits(value: string) {
  return value.replace(/\D/g, "").length;
}

/**
 * Ist der Feldinhalt exakt das, was die Ziffern-Maske erzeugen würde? Nur dann
 * darf sie weiterformatieren – strukturierte Eingaben (Diktat, getippte
 * Punkte) bleiben unangetastet.
 */
function isMaskShaped(value: string) {
  return value === formatDigits(value.replace(/\D/g, ""));
}

/** Jahr noch nicht fertig getippt („15.10.2“, „15.10.202“)? */
function isPartialYear(value: string) {
  const match = value.trim().match(/^\d{1,2}[./-]\d{1,2}[./-](\d+)$/);
  return Boolean(match && match[1].length !== 2 && match[1].length !== 4);
}

/** Cursorposition hinter der n-ten Ziffer (Punkte zählen nicht mit). */
function caretAfterDigits(value: string, digits: number) {
  if (digits <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (/\d/.test(value[index])) {
      seen += 1;
      if (seen === digits) return index + 1;
    }
  }
  return value.length;
}

export function ExpiryDateField({
  defaultValue,
}: {
  defaultValue: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const [state, setState] = useState(() => ({
    text: normalizeExpiryInput(defaultValue)?.display ?? defaultValue,
    // Zählt Änderungen, damit jede Eingabe einen Re-Render auslöst – auch
    // wenn der Text unverändert bleibt (z. B. im strukturierten Modus).
    seq: 0,
  }));
  const [error, setError] = useState<string | null>(null);

  const parsed = normalizeExpiryInput(state.text);
  // Bestätigung erst, wenn die Eingabe ein vollständiges Jahr enthält – sonst
  // würden beim Tippen Zwischenstände wie „15.10.2002“ aufblitzen.
  const confirmed =
    parsed?.hasYear && !isPartialYear(state.text) ? parsed : null;

  useLayoutEffect(() => {
    const position = pendingCaret.current;
    if (position === null) return;
    pendingCaret.current = null;
    inputRef.current?.setSelectionRange(position, position);
  }, [state]);

  function update(text: string, caret: number | null) {
    pendingCaret.current = caret;
    setState((current) => ({ text, seq: current.seq + 1 }));
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const raw = input.value;
    const caret = input.selectionStart ?? raw.length;
    const inputEvent = event.nativeEvent as InputEvent;
    const inputType = inputEvent.inputType;
    const data = inputEvent.data ?? "";
    const hasSelection = (input.selectionEnd ?? caret) !== caret;
    setError(null);

    // Eingefügtes ISO-Datum (z. B. aus der Datenbank) direkt übernehmen.
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(raw.trim())) {
      const iso = normalizeExpiryInput(raw);
      if (iso) {
        update(iso.display, iso.display.length);
        return;
      }
    }

    // Diktierte Wortformen („fünfzehnter Oktober“) bleiben unverändert.
    if (/\p{L}/u.test(raw)) {
      update(raw, null);
      return;
    }

    const previous = state.text;

    if (inputType === "deleteContentBackward") {
      // In strukturiertem Text (vom Diktat oder selbst getippte Punkte)
      // löscht der Browser ganz normal.
      if (!isMaskShaped(previous)) {
        update(raw, null);
        return;
      }
      let digits = raw.replace(/\D/g, "");
      let digitsBeforeCaret = countDigits(raw.slice(0, caret));
      // Rücktaste auf einem automatisch gesetzten Punkt: zusätzlich die Ziffer
      // davor entfernen, sonst wäre die Taste wirkungslos.
      if (raw.length < previous.length && previous[caret] === ".") {
        const removedDigit = countDigits(previous.slice(0, caret)) - 1;
        if (removedDigit >= 0) {
          digits =
            digits.slice(0, removedDigit) + digits.slice(removedDigit + 1);
          digitsBeforeCaret = Math.max(0, digitsBeforeCaret - 1);
        }
      }
      const formatted = formatDigits(digits);
      update(formatted, caretAfterDigits(formatted, digitsBeforeCaret));
      return;
    }

    // Die Maske greift nur beim Tippen einzelner Ziffern in ein reines
    // Ziffernfeld. Diktat-Blöcke, eingefügte Punkte oder Ersetzungen durch
    // die Tastatur bleiben unangetastet – sonst würden Daten wie „10.4.2020“
    // zu „10.42.020“ umgruppiert.
    const isSingleDigit = !hasSelection && data.length === 1 && /^\d$/.test(data);
    if (isSingleDigit && isMaskShaped(previous)) {
      const digits = raw.replace(/\D/g, "");
      if (digits.length <= 8) {
        const formatted = formatDigits(digits);
        update(formatted, caretAfterDigits(formatted, countDigits(raw.slice(0, caret))));
        return;
      }
    }

    update(raw, null);
  }

  function commit() {
    const text = state.text.trim();
    if (!text) {
      setError(null);
      return;
    }
    const result = normalizeExpiryInput(text);
    if (!result) {
      setError(INVALID_HINT);
      return;
    }
    setError(null);
    if (result.display !== state.text) update(result.display, null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    const text = state.text.trim();
    if (text && !normalizeExpiryInput(text)) {
      event.preventDefault();
      setError(INVALID_HINT);
      return;
    }
    commit();
  }

  return (
    <div className="min-w-0">
      <Label htmlFor="expiry">Mindesthaltbarkeit</Label>
      <div className="flex min-w-0 items-center gap-2">
        <input
          ref={inputRef}
          id="expiry"
          name="expiry"
          type="text"
          value={state.text}
          onChange={handleChange}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="TT.MM.JJJJ"
          aria-describedby="expiry-hint"
          aria-invalid={error ? true : undefined}
          className={cn(inputClass, "min-w-0 max-w-full tabular-nums")}
        />
        {state.text ? (
          <button
            type="button"
            onClick={() => {
              update("", null);
              setError(null);
              inputRef.current?.focus();
            }}
            aria-label="MHD entfernen"
            title="MHD entfernen"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-stone-300 bg-white text-stone-500 transition hover:bg-red-50 hover:text-red-700"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      <p
        id="expiry-hint"
        aria-live="polite"
        className={cn(
          "mt-1 text-[11px]",
          error
            ? "text-red-700"
            : confirmed
              ? "text-emerald-700"
              : "text-stone-500",
        )}
      >
        {error ??
          (confirmed
            ? `✓ ${confirmed.display}`
            : "Ziffern ohne Punkte reichen, z. B. 15102026 – Diktat über die Mikrofon-Taste der Tastatur.")}
      </p>
    </div>
  );
}
