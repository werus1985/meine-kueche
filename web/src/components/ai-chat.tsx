"use client";

import {
  ChefHat,
  Clock,
  Loader2,
  Plus,
  Send,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  addItemsToShoppingAction,
  chatAction,
  suggestRecipesAction,
  type AiHistoryEntry,
  type AiListItem,
  type AiRecipe,
  type AiResponseType,
  type AiResult,
} from "@/actions/ai";
import {
  Alert,
  Badge,
  buttonGhost,
  buttonPrimary,
  buttonSecondary,
  textareaClass,
} from "@/components/ui";
import { cn } from "@/lib/utils";

type ChatMessage =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      text: string;
      recipes?: AiRecipe[];
      list?: {
        title: string;
        type: AiResponseType;
        items: AiListItem[];
      };
    };

function newId() {
  return crypto.randomUUID();
}

function plainText(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "• ");
}

function toAssistantMessage(result: AiResult): ChatMessage {
  if (!result.ok) {
    return { id: newId(), role: "assistant", text: result.message };
  }
  if (result.responseType === "recipes" && result.recipes?.length) {
    return {
      id: newId(),
      role: "assistant",
      text: result.answer ?? "Hier sind passende Rezeptideen:",
      recipes: result.recipes,
    };
  }
  if (result.items?.length) {
    return {
      id: newId(),
      role: "assistant",
      text: result.answer ?? "Hier ist die gewünschte Liste:",
      list: {
        title: result.title ?? "Liste",
        type: result.responseType ?? "general_list",
        items: result.items,
      },
    };
  }
  return {
    id: newId(),
    role: "assistant",
    text: result.answer ?? result.message,
  };
}

function toHistory(message: ChatMessage): AiHistoryEntry {
  if (message.role === "user") {
    return { role: "user", content: message.text };
  }
  const parts = [message.text];
  if (message.recipes?.length) {
    parts.push(
      `Rezepte: ${message.recipes.map((recipe) => recipe.name).join(", ")}`,
    );
  }
  if (message.list) {
    parts.push(
      `${message.list.title}: ${message.list.items
        .map((item) => item.name)
        .join(", ")}`,
    );
  }
  return { role: "assistant", content: parts.join("\n") };
}

const exampleQuestions = [
  "Was kann ich heute aus meinem Vorrat kochen?",
  "Welche Zutaten sollte ich bald verbrauchen?",
  "Welche Grundnahrungsmittel fehlen mir?",
  "Erstelle eine Einkaufsliste für die Woche.",
];

export function AiChat({
  configured,
  stockCount,
  expiringCount,
  canWrite,
}: {
  configured: boolean;
  stockCount: number;
  expiringCount: number;
  canWrite: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [addPending, startAdd] = useTransition();
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = listRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, pending]);

  function send() {
    const text = input.trim();
    if (!text || pending || !configured) return;

    setInput("");
    setNotice(null);
    const history = messages.slice(-12).map(toHistory);
    setMessages((previous) => [
      ...previous,
      { id: newId(), role: "user", text },
    ]);

    startTransition(async () => {
      const result = await chatAction(text, history);
      setMessages((previous) => [...previous, toAssistantMessage(result)]);
    });
  }

  function requestRecipes() {
    if (pending || !configured || stockCount === 0) return;
    setNotice(null);
    setMessages((previous) => [
      ...previous,
      {
        id: newId(),
        role: "user",
        text: "Bitte finde Rezepte aus meinem Vorrat – gern mit Zutaten, die bald ablaufen.",
      },
    ]);

    startTransition(async () => {
      const result = await suggestRecipesAction();
      setMessages((previous) => [...previous, toAssistantMessage(result)]);
    });
  }

  function addItems(key: string, items: AiListItem[], note: string) {
    if (!canWrite || addPending) return;
    setAddingKey(key);
    setNotice(null);
    startAdd(async () => {
      try {
        const result = await addItemsToShoppingAction(items, note);
        setNotice(result.message);
      } finally {
        setAddingKey(null);
      }
    });
  }

  const disabled = !configured || pending;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900">
              <ChefHat className="size-5" /> Dein KI-Küchenhelfer
            </p>
            <p className="mt-1 text-sm text-stone-600">
              Frag nach Rezepten aus deinem Vorrat, nach Zutaten die bald
              ablaufen oder nach einer Einkaufsliste. Fehlende Zutaten kannst du
              direkt in den Einkauf übernehmen.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="green">{stockCount} Artikel im Vorrat</Badge>
              <Badge tone={expiringCount > 0 ? "amber" : "neutral"}>
                {expiringCount} bald ablaufend
              </Badge>
            </div>
          </div>
          <button
            type="button"
            onClick={requestRecipes}
            disabled={disabled || stockCount === 0}
            className={buttonPrimary}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Rezeptideen finden
          </button>
        </div>
      </div>

      {!configured ? (
        <Alert tone="warning">
          Die KI-Küche ist noch nicht verbunden. Trage{" "}
          <code className="rounded bg-white/70 px-1">GEMINI_API_KEY</code> in{" "}
          <code className="rounded bg-white/70 px-1">web/.env.local</code> ein
          und starte den Entwicklungsserver neu.
        </Alert>
      ) : null}

      {!canWrite ? (
        <Alert tone="info">
          Du hast in diesem Haushalt nur Leserechte. Du kannst die KI fragen,
          aber keine fehlenden Zutaten in die Einkaufsliste übernehmen.
        </Alert>
      ) : null}

      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <div className="rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div
          ref={listRef}
          className="max-h-[58vh] min-h-56 space-y-3 overflow-y-auto p-4"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Sparkles className="size-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-stone-900">
                Was möchtest du kochen?
              </p>
              <p className="mt-1 max-w-md text-sm text-stone-500">
                Die KI kennt deinen Vorrat inklusive Mengen und
                Mindesthaltbarkeitsdaten.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {exampleQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => setInput(question)}
                    className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-emerald-300 hover:text-emerald-800"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message) =>
            message.role === "user" ? (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-emerald-700 px-3.5 py-2.5 text-sm text-white">
                  <p className="whitespace-pre-wrap">{message.text}</p>
                </div>
              </div>
            ) : (
              <div key={message.id} className="space-y-2">
                <div className="flex gap-2">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                    <ChefHat className="size-4" />
                  </span>
                  <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-stone-100 px-3.5 py-2.5 text-sm text-stone-800">
                    <p className="whitespace-pre-wrap">
                      {plainText(message.text)}
                    </p>
                  </div>
                </div>

                {message.recipes?.length ? (
                  <div className="ml-9 grid gap-2">
                    {message.recipes.map((recipe, index) => (
                      <article
                        key={`${message.id}-${index}`}
                        className="rounded-xl border border-stone-200 bg-stone-50 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-stone-900">
                            {recipe.name}
                          </h3>
                          {recipe.time_minutes ? (
                            <span className="inline-flex items-center gap-1 text-xs text-stone-500">
                              <Clock className="size-3" />
                              {recipe.time_minutes} Min.
                            </span>
                          ) : null}
                        </div>
                        {recipe.description ? (
                          <p className="mt-1 text-sm text-stone-600">
                            {recipe.description}
                          </p>
                        ) : null}

                        {recipe.ingredients.length > 0 ? (
                          <div className="mt-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                              Zutaten
                            </p>
                            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-stone-700">
                              {recipe.ingredients.map((ingredient, itemIndex) => (
                                <li key={itemIndex}>{ingredient}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {recipe.missing.length > 0 ? (
                          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                              Fehlt noch
                            </p>
                            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-amber-900">
                              {recipe.missing.map((ingredient, itemIndex) => (
                                <li key={itemIndex}>{ingredient}</li>
                              ))}
                            </ul>
                            {canWrite ? (
                              <button
                                type="button"
                                onClick={() =>
                                  addItems(
                                    `${message.id}-recipe-${index}`,
                                    recipe.missing.map((name) => ({
                                      name,
                                      qty: "1",
                                      unit: "Stück",
                                    })),
                                    `Für Rezept: ${recipe.name}`,
                                  )
                                }
                                disabled={addPending}
                                className={cn(buttonSecondary, "mt-2 py-1.5")}
                              >
                                {addingKey === `${message.id}-recipe-${index}` ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Plus className="size-3.5" />
                                )}
                                Fehlende Zutaten in den Einkauf
                              </button>
                            ) : null}
                          </div>
                        ) : null}

                        {recipe.steps.length > 0 ? (
                          <div className="mt-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                              Zubereitung
                            </p>
                            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-stone-700">
                              {recipe.steps.map((step, itemIndex) => (
                                <li key={itemIndex}>{step}</li>
                              ))}
                            </ol>
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : null}

                {message.list ? (
                  <div className="ml-9 rounded-xl border border-stone-200 bg-stone-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-stone-900">
                        <ShoppingCart className="size-4 text-emerald-700" />
                        {message.list.title}
                      </h3>
                      {canWrite ? (
                        <button
                          type="button"
                          onClick={() =>
                            addItems(
                              `${message.id}-all`,
                              message.list?.items ?? [],
                              "Aus dem KI-Chat",
                            )
                          }
                          disabled={addPending}
                          className={cn(buttonGhost, "border border-emerald-200 bg-emerald-50 text-emerald-800")}
                        >
                          {addingKey === `${message.id}-all` ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Plus className="size-3.5" />
                          )}
                          Alle übernehmen
                        </button>
                      ) : null}
                    </div>
                    <ul className="mt-3 space-y-2">
                      {message.list.items.map((item, index) => (
                        <li
                          key={`${message.id}-item-${index}`}
                          className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-white px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-stone-900">
                              {item.name}
                            </p>
                            <p className="text-xs text-stone-500">
                              {[item.qty, item.unit]
                                .filter(Boolean)
                                .join(" ")}
                              {item.category ? ` · ${item.category}` : ""}
                            </p>
                            {item.notes ? (
                              <p className="text-xs text-stone-500">
                                {item.notes}
                              </p>
                            ) : null}
                          </div>
                          {canWrite ? (
                            <button
                              type="button"
                              onClick={() =>
                                addItems(
                                  `${message.id}-item-${index}`,
                                  [item],
                                  "Aus dem KI-Chat",
                                )
                              }
                              disabled={addPending}
                              className={buttonGhost}
                            >
                              {addingKey === `${message.id}-item-${index}` ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Plus className="size-3.5" />
                              )}
                              Zur Einkaufsliste
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ),
          )}

          {pending ? (
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <Loader2 className="size-4 animate-spin text-emerald-700" />
              Die KI denkt nach …
            </div>
          ) : null}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
          className="border-t border-stone-100 p-3"
        >
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              rows={2}
              maxLength={1500}
              placeholder="z. B. Was kann ich mit den Zutaten kochen, die bald ablaufen?"
              disabled={disabled}
              className={textareaClass}
              aria-label="Nachricht an die KI-Küche"
            />
            <button
              type="submit"
              disabled={disabled || !input.trim()}
              className={cn(buttonPrimary, "shrink-0 px-3.5 py-3")}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              <span className="hidden sm:inline">Senden</span>
            </button>
          </div>
          <p className="mt-1.5 text-xs text-stone-400">
            Enter sendet, Shift+Enter macht eine neue Zeile. Die KI kann sich
            irren – prüfe Haltbarkeit und Zutaten selbst.
          </p>
        </form>
      </div>
    </div>
  );
}
