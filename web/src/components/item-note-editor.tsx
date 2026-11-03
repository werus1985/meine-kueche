"use client";

import { Check, Loader2, X } from "lucide-react";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";

import { setItemNotesAction } from "@/actions/items";
import { textareaClass } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Inline-Notiz: Der Schalter wird per Render-Prop in die Aktionsleiste der
 * Karte gelegt; das Textfeld klappt darunter auf und speichert beim
 * Verlassen/Speichern.
 */
export function ItemNoteEditor({
  itemId,
  notes,
  canWrite,
  children,
}: {
  itemId: string;
  notes: string;
  canWrite: boolean;
  children: (toggle: ReactNode) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [savedNotes, setSavedNotes] = useState(notes);
  const [draft, setDraft] = useState(notes);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(value = draft) {
    if (!canWrite || pending) return;
    const normalized = value.trim();
    if (normalized === savedNotes) {
      setOpen(false);
      return;
    }

    const formData = new FormData();
    formData.set("id", itemId);
    formData.set("notes", normalized);
    setError(null);
    startTransition(async () => {
      const result = await setItemNotesAction(formData);
      if (!result?.ok) {
        setError(result?.message ?? "Notiz konnte nicht gespeichert werden.");
        return;
      }
      setSavedNotes(normalized);
      setDraft(normalized);
      setOpen(false);
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save();
  }

  const toggle = (
    <button
      type="button"
      onClick={() => {
        setDraft(savedNotes);
        setOpen((value) => !value);
        setError(null);
      }}
      aria-expanded={open}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-1.5 py-2.5 text-xs font-medium transition",
        open
          ? "text-[var(--accent-900)]"
          : "text-[var(--accent-800)] hover:bg-[var(--accent-50)]",
      )}
    >
      Notiz {open ? "−" : "+"}
      {savedNotes ? (
        <span
          aria-label="Notiz vorhanden"
          className="size-1.5 rounded-full bg-[var(--accent-600)]"
        />
      ) : null}
    </button>
  );

  return (
    <div className="min-w-0">
      {children(toggle)}

      {open ? (
        <form onSubmit={onSubmit} className="mt-1.5 space-y-1.5">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={(event) => {
              const nextTarget = event.relatedTarget;
              if (nextTarget && event.currentTarget.form?.contains(nextTarget as Node)) return;
              if (draft.trim() !== savedNotes) save(draft);
            }}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                save();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setDraft(savedNotes);
                setOpen(false);
                setError(null);
              }
            }}
            rows={2}
            maxLength={2000}
            readOnly={!canWrite}
            aria-label="Notiz zum Artikel"
            placeholder={canWrite ? "Notiz direkt hier eingeben …" : "Keine Notiz vorhanden."}
            className={cn(textareaClass, "min-h-16 resize-y rounded-lg px-2.5 py-2 text-xs shadow-none")}
          />
          {error ? <p className="text-[11px] text-red-700">{error}</p> : null}
          {canWrite ? (
            <div className="flex items-center justify-end gap-1">
              {savedNotes ? (
                <button
                  type="button"
                  onClick={() => save("")}
                  disabled={pending}
                  className="mr-auto inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  <X className="size-3" /> Entfernen
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setDraft(savedNotes);
                  setOpen(false);
                  setError(null);
                }}
                disabled={pending}
                className="rounded-md px-2 py-1.5 text-[11px] text-stone-500 hover:bg-stone-100"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={pending || draft.trim() === savedNotes}
                className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-700)] px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-[var(--accent-800)] disabled:opacity-50"
              >
                {pending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                Speichern
              </button>
            </div>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
