"use client";



import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { LearningModule } from "@/data/mockData";



const DEFAULT_HIGHLIGHT_COLOR = "#fff9b1";



type Highlight = {

  id: string;

  sectionId: string;

  start: number;

  end: number;

  color: string;

};



type NoteEntry = {
  id: string;
  sectionId: string;
  start: number;
  end: number;
  text: string;
  createdAt: string;
  excerpt: string;
};



type NoteDraft = {

  sectionId: string;

  start: number;

  end: number;

  selectionText: string;

  text: string;

  position: { x: number; y: number };

};



type ToolbarState = {

  sectionId: string;

  start: number;

  end: number;

  text: string;

  origin: "selection" | "highlight";

  highlightId?: string;

  position: { x: number; y: number };

};



type AiPopover =

  | null

  | {

      position: { x: number; y: number };

      status: "loading" | "error";

      message: string;

    }

  | {

      position: { x: number; y: number };

      status: "success";

      summary: string;

      suggestions: string[];

    };



export function LearningWorkspace({ modules }: { modules: LearningModule[] }) {

  const [selectedModuleId, setSelectedModuleId] = useState(

    modules[0]?.id ?? ""

  );

  const selectedModule = useMemo(

    () => modules.find((module) => module.id === selectedModuleId) ?? null,

    [modules, selectedModuleId]

  );



  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(

    selectedModule?.sections[0]?.id ?? null

  );



  useEffect(() => {

    if (!selectedModule) {

      setSelectedSectionId(null);

      return;

    }

    if (

      !selectedModule.sections.find(

        (section) => section.id === selectedSectionId

      )

    ) {

      setSelectedSectionId(selectedModule.sections[0]?.id ?? null);

    }

  }, [selectedModule, selectedSectionId]);



  const [highlights, setHighlights] = useState<Record<string, Highlight[]>>({});

  const [notes, setNotes] = useState<NoteEntry[]>([]);

  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);

  const [noteDraft, setNoteDraft] = useState<NoteDraft | null>(null);

  const [aiPopover, setAiPopover] = useState<AiPopover>(null);



  const readerRef = useRef<HTMLDivElement | null>(null);



  useEffect(() => {

    function handleSelection() {

      const selection = window.getSelection();

      if (!selection || selection.isCollapsed) {

        setToolbar(null);

        setAiPopover(null);

        return;

      }



      const range = selection.getRangeAt(0);

      const reader = readerRef.current;

      if (!reader) return;

      if (

        !reader.contains(range.startContainer) ||

        !reader.contains(range.endContainer)

      ) {

        setToolbar(null);

        setAiPopover(null);

        return;

      }



      const startNode =

        range.startContainer instanceof Element

          ? range.startContainer

          : range.startContainer.parentElement;

      const sectionElement = startNode?.closest(

        "[data-section-id]"

      ) as HTMLElement | null;

      if (!sectionElement) {

        setToolbar(null);

        setAiPopover(null);

        return;

      }



      const endNode =

        range.endContainer instanceof Element

          ? range.endContainer

          : range.endContainer.parentElement;

      const endSectionElement = endNode?.closest(

        "[data-section-id]"

      ) as HTMLElement | null;

      if (!endSectionElement || endSectionElement !== sectionElement) {

        setToolbar(null);

        setAiPopover(null);

        return;

      }



      const sectionId = sectionElement.dataset.sectionId;

      if (!sectionId) {

        setToolbar(null);

        setAiPopover(null);

        return;

      }



      const text = selection.toString();

      if (!text.trim()) {

        setToolbar(null);

        setAiPopover(null);

        return;

      }



      const offsets = getOffsetsWithin(range, sectionElement);

      if (!offsets || offsets.start === offsets.end) {

        setToolbar(null);

        setAiPopover(null);

        return;

      }



      const rect = range.getBoundingClientRect();

      const containerRect = sectionElement.getBoundingClientRect();



      const toolbarHeight = 40; // approx
      let positionY = Math.max(
        12,
        rect.top - containerRect.top - toolbarHeight - 8
      );
      if (positionY + toolbarHeight > rect.top - containerRect.top) {
        positionY = Math.max(12, rect.top - containerRect.top - toolbarHeight - 8);
      }

      setToolbar({
        sectionId,
        start: offsets.start,
        end: offsets.end,
        text,
        origin: "selection",
        highlightId: undefined,
        position: {
          x: rect.left - containerRect.left + rect.width / 2,
          y: positionY,
        },
      });
      setAiPopover(null);

    }



    function handleKey(event: KeyboardEvent) {

      if (event.key === "Escape") {

        setToolbar(null);

        setNoteDraft(null);

        setAiPopover(null);

        window.getSelection()?.removeAllRanges();

      }

    }



    document.addEventListener("mouseup", handleSelection);

    document.addEventListener("keyup", handleKey);

    return () => {

      document.removeEventListener("mouseup", handleSelection);

      document.removeEventListener("keyup", handleKey);

    };

  }, []);



  const sectionNotes = useMemo(

    () =>

      notes

        .filter((note) => note.sectionId === selectedSectionId)

        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),

    [notes, selectedSectionId]

  );



  function applyHighlight(color: string, state: ToolbarState) {

    const newId = state.highlightId ?? generateId("hl");



    setHighlights((prev) => {

      const existing = prev[state.sectionId] ?? [];

      const next: Highlight[] = [];



      for (const item of existing) {

        if (item.id === state.highlightId) {

          continue;

        }



        if (item.end <= state.start || item.start >= state.end) {

          next.push(item);

          continue;

        }



        if (item.start < state.start) {

          next.push({ ...item, id: generateId("hl"), end: state.start });

        }



        if (item.end > state.end) {

          next.push({ ...item, id: generateId("hl"), start: state.end });

        }

      }



      next.push({

        id: newId,

        sectionId: state.sectionId,

        start: state.start,

        end: state.end,

        color,

      });



      next.sort((a, b) => a.start - b.start);



      return {

        ...prev,

        [state.sectionId]: next,

      };

    });



    setToolbar((prev) =>

      prev ? { ...prev, highlightId: newId, origin: "highlight" } : prev

    );

  }



  function removeHighlight(sectionId: string, highlightId: string) {

    setHighlights((prev) => {

      const existing = prev[sectionId] ?? [];

      return {

        ...prev,

        [sectionId]: existing.filter((item) => item.id !== highlightId),

      };

    });

    setToolbar(null);

    setAiPopover(null);

    window.getSelection()?.removeAllRanges();

  }



  function openToolbarForHighlight(

    sectionId: string,

    highlight: Highlight,

    text: string,

    event: MouseEvent<HTMLSpanElement>

  ) {

    const rect = event.currentTarget.getBoundingClientRect();

    const containerRect =

      readerRef.current?.closest("section")?.getBoundingClientRect();

    if (!containerRect) return;



    const toolbarHeight = 40;
    const positionY = Math.max(
      12,
      rect.top - containerRect.top - toolbarHeight - 8
    );

    setToolbar({
      sectionId,
      start: highlight.start,
      end: highlight.end,
      text,
      origin: "highlight",
      highlightId: highlight.id,
      position: {
        x: rect.left - containerRect.left + rect.width / 2,
        y: positionY,
      },
    });
    setAiPopover(null);

  }



function addNote(entry: NoteEntry) {
  setNotes((prev) => [...prev, entry]);
}


  async function requestAiAssistant(state: ToolbarState) {

    setAiPopover({

      position: { x: state.position.x, y: state.position.y + 40 },

      status: "loading",

      message: "Generating AI summary...",

    });

    try {

      const response = await fetch("/api/learning/assistant", {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({

          moduleId: selectedModuleId,

          sectionId: state.sectionId,

          text: state.text,

        }),

      });

      if (!response.ok) {

        const data = await response.json().catch(() => ({}));

        throw new Error(data.error ?? "AI assistant failed");

      }

      const data = await response.json();

      setAiPopover({

        position: { x: state.position.x, y: state.position.y + 40 },

        status: "success",

        summary: data.summary,

        suggestions: data.suggestions,

      });

    } catch (error) {

      setAiPopover({

        position: { x: state.position.x, y: state.position.y + 40 },

        status: "error",

        message:

          error instanceof Error ? error.message : "AI assistant error",

      });

    }

  }



  return (

    <div className="grid gap-6 md:grid-cols-[280px_1fr_320px]">

      <aside className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">

        <div>

          <p className="text-xs font-semibold uppercase tracking-widest text-sky-500">

            Modules

          </p>

          <h3 className="mt-2 text-lg font-semibold text-zinc-900">

            Content Outline

          </h3>

        </div>

        <nav className="flex flex-col gap-3 text-sm">

          {modules.map((module) => (

            <div key={module.id}>

              <button

                type="button"

                onClick={() => {

                  setSelectedModuleId(module.id);

                  setSelectedSectionId(module.sections[0]?.id ?? null);

                  setToolbar(null);

                  setNoteDraft(null);

                  setAiPopover(null);

                }}

                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left font-medium transition ${

                  module.id === selectedModuleId

                    ? "bg-sky-100 text-sky-700"

                    : "text-zinc-600 hover:bg-zinc-100"

                }`}

              >

                <span>{module.title}</span>

                <span className="text-xs font-semibold text-zinc-500">

                  {Math.round(module.progress * 100)}%

                </span>

              </button>

              {module.id === selectedModuleId && (

                <ul className="mt-2 space-y-2 border-l-2 border-sky-200 pl-4 text-xs text-zinc-500">

                  {module.sections.map((section) => (

                    <li key={section.id}>

                      <button

                        type="button"

                        onClick={() => {

                          setSelectedSectionId(section.id);

                          setToolbar(null);

                          setNoteDraft(null);

                          setAiPopover(null);

                        }}

                        className={`w-full rounded-lg px-2 py-1 text-left transition ${

                          section.id === selectedSectionId

                            ? "bg-sky-50 text-sky-700"

                            : "hover:bg-zinc-100"

                        }`}

                      >

                        {section.title}

                      </button>

                    </li>

                  ))}

                </ul>

              )}

            </div>

          ))}

        </nav>

      </aside>



      <section className="relative rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">

        {selectedModule && selectedSectionId ? (

          selectedModule.sections

            .filter((section) => section.id === selectedSectionId)

            .map((section) => (

              <article key={section.id} className="prose prose-zinc max-w-none text-zinc-700">

                <header className="mb-6">

                  <p className="text-xs font-semibold uppercase tracking-widest text-sky-500">

                    {selectedModule.title}

                  </p>

                  <h2 className="mt-2 text-2xl font-semibold text-zinc-900">

                    {section.title}

                  </h2>

                  <p className="text-sm text-zinc-500">

                    Suggested duration ~ {section.duration}

                  </p>

                </header>

                <div

                  ref={readerRef}

                  data-section-id={section.id}

                  className="reading-content whitespace-pre-wrap leading-7"

                >

                  {renderHighlightedContent(

                    section.content,

                    highlights[section.id] ?? [],

                    (highlight, text, event) =>

                      openToolbarForHighlight(section.id, highlight, text, event),

                    (highlight) => removeHighlight(section.id, highlight.id)

                  )}

                </div>

              </article>

            ))

        ) : (

          <p className="text-sm text-zinc-500">Select a module to start reading.</p>

        )}



        {toolbar && (
          <Toolbar
            state={toolbar}
            onClose={() => {
              setToolbar(null);
              setAiPopover(null);
              window.getSelection()?.removeAllRanges();
            }}
            onApplyHighlight={(color) => applyHighlight(color, toolbar)}
            onNote={() => {
              setNoteDraft({
                sectionId: toolbar.sectionId,
                start: toolbar.start,
                end: toolbar.end,
                selectionText: toolbar.text,
                text: "",
                position: {
                  x: toolbar.position.x,
                  y: toolbar.position.y + 48,
                },
              });
            }}
            onAiAssist={() => requestAiAssistant(toolbar)}
          />
        )}



        {aiPopover && (

          <AiPopoverView

            popover={aiPopover}

            onClose={() => setAiPopover(null)}

          />

        )}



        {noteDraft && (

          <NoteComposer

            draft={noteDraft}

            onChangeText={(text) =>

              setNoteDraft((prev) => (prev ? { ...prev, text } : prev))

            }

            onCancel={() => {

              setNoteDraft(null);

              window.getSelection()?.removeAllRanges();

            }}

            onSave={() => {

              if (!noteDraft.text.trim()) return;

              const note: NoteEntry = {
                id: generateId("note"),
                sectionId: noteDraft.sectionId,
                start: noteDraft.start,
                end: noteDraft.end,
                text: noteDraft.text.trim(),
                createdAt: new Date().toISOString(),
                excerpt: noteDraft.selectionText.trim(),
              };
              addNote(note);
              setNoteDraft(null);

              window.getSelection()?.removeAllRanges();

            }}

          />

        )}

      </section>



      <aside className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">

        <div>

          <p className="text-xs font-semibold uppercase tracking-widest text-sky-500">

            Personal Notes

          </p>

          <h3 className="mt-2 text-lg font-semibold text-zinc-900">

           Highlights & Insights
          </h3>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto pr-1 text-sm">
          {sectionNotes.length === 0 ? (
            <p className="rounded-xl bg-zinc-100/60 p-3 text-xs text-zinc-500">

              Select text and use the note icon to capture your ideas.

            </p>

          ) : (

            sectionNotes.map((note) => (
              <div
                key={note.id}
                className="rounded-xl border border-zinc-100 bg-white p-3 shadow-sm"
              >
                <p className="text-xs font-medium text-zinc-500">

                  {new Date(note.createdAt).toLocaleString()}

                </p>

                <p className="mt-2 text-zinc-700 leading-6">{note.text}</p>
                <p className="mt-2 text-xs italic text-zinc-500">
                  原文：{note.excerpt || "（空）"}
                </p>
              </div>
            ))
          )}
        </div>
      </aside>

    </div>

  );

}



function Toolbar({

  state,

  onClose,

  onApplyHighlight,

  onNote,

  onAiAssist,

}: {

  state: ToolbarState;

  onClose: () => void;

  onApplyHighlight: (color: string) => void;

  onNote: () => void;

  onAiAssist: () => void;

}) {

  return (

    <div

      className="pointer-events-auto absolute z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-zinc-200 bg-white/95 px-2 py-1 shadow-xl"

      style={{ left: state.position.x, top: state.position.y }}

    >

      <IconButton

        label="Highlight"

        icon="🖍"

        onClick={() => onApplyHighlight(DEFAULT_HIGHLIGHT_COLOR)}

      />

      <IconButton label="Note" icon="📄" onClick={onNote} />

      <IconButton label="AI" icon="🤖" onClick={onAiAssist} />

      <span className="h-4 w-px bg-zinc-200" />

      <IconButton label="Close" icon="✕" onClick={onClose} />

    </div>

  );

}



function IconButton({

  label,

  icon,

  onClick,

}: {

  label: string;

  icon: string;

  onClick: () => void;

}) {

  return (

    <button

      type="button"

      onClick={onClick}

      title={label}

      className="flex h-8 w-8 items-center justify-center rounded-full text-base text-zinc-600 transition hover:bg-zinc-100"

    >

      <span aria-hidden>{icon}</span>

    </button>

  );

}



function NoteComposer({
  draft,
  onChangeText,
  onSave,
  onCancel,
}: {
  draft: NoteDraft;
  onChangeText: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div
      className="pointer-events-auto absolute z-40 w-[420px] rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl"
      style={{ left: draft.position.x, top: draft.position.y }}
    >
      <div className="flex items-center justify-between">

        <h4 className="text-sm font-semibold text-zinc-800">Add note</h4>

        <button

          type="button"

          onClick={onCancel}

          className="rounded-full px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-100"

        >

          Cancel

        </button>

      </div>

      <p className="mt-2 text-xs text-zinc-500">
        Selection:
        {draft.selectionText.length > 120
          ? ` ${draft.selectionText.slice(0, 116)}...`
          : ` ${draft.selectionText}`}
      </p>
      <textarea
        ref={textareaRef}
        className="mt-3 h-32 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
        placeholder="Capture your thoughts..."
        value={draft.text}
        onChange={(event) => onChangeText(event.target.value)}
      />

      <div className="mt-3 flex justify-end gap-2">

        <button

          type="button"

          onClick={onCancel}

          className="rounded-full px-4 py-2 text-xs font-semibold text-zinc-500 hover:bg-zinc-100"

        >

          Cancel

        </button>

        <button

          type="button"

          onClick={onSave}

          disabled={!draft.text.trim()}

          className="rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-300"

        >

          Save note

        </button>

      </div>

    </div>

  );

}



function AiPopoverView({

  popover,

  onClose,

}: {

  popover: Exclude<AiPopover, null>;

  onClose: () => void;

}) {

  return (

    <div

      className="pointer-events-auto absolute z-40 w-72 rounded-2xl border border-sky-200 bg-white p-4 shadow-xl"

      style={{ left: popover.position.x, top: popover.position.y }}

    >

      <div className="flex items-center justify-between">

        <p className="text-xs font-semibold uppercase tracking-widest text-sky-500">

          AI Assistant

        </p>

        <button

          type="button"

          onClick={onClose}

          className="rounded-full px-2 text-xs text-zinc-400 hover:bg-zinc-100"

        >

          ✕

        </button>

      </div>

      {popover.status === "loading" && (

        <p className="mt-2 text-xs text-sky-700">{popover.message}</p>

      )}

      {popover.status === "error" && (

        <p className="mt-2 text-xs text-red-600">{popover.message}</p>

      )}

      {popover.status === "success" && (

        <div className="mt-2 space-y-3 text-xs text-sky-700">

          <div>

            <p className="text-sm font-semibold text-sky-800">Summary</p>

            <p className="mt-1 leading-5">{popover.summary}</p>

          </div>

          <div>

            <p className="text-sm font-semibold text-sky-800">Suggestions</p>

            <ul className="mt-1 list-disc pl-5 leading-5">

              {popover.suggestions.map((item) => (

                <li key={item}>{item}</li>

              ))}

            </ul>

          </div>

        </div>

      )}

    </div>

  );

}



function renderHighlightedContent(
  content: string,
  highlights: Highlight[],
  onHighlightClick: (
    highlight: Highlight,
    text: string,
    event: MouseEvent<HTMLSpanElement>
  ) => void,
  onRemoveHighlight: (highlight: Highlight) => void
): JSX.Element[] {
  if (highlights.length === 0) {

    return [<span key="plain">{content}</span>];

  }



  const ordered = [...highlights].sort((a, b) => a.start - b.start);

  const nodes: JSX.Element[] = [];

  let cursor = 0;



  ordered.forEach((highlight, index) => {

    const start = Math.max(0, Math.min(content.length, highlight.start));

    const end = Math.max(0, Math.min(content.length, highlight.end));



    if (start > cursor) {

      nodes.push(

        <span key={`plain-${index}-${cursor}`}>

          {content.slice(cursor, start)}

        </span>

      );

    }



    const slice = content.slice(start, end);

    nodes.push(

      <span

        key={highlight.id}

        className="highlighted-text cursor-pointer"
        style={{ backgroundColor: highlight.color }}
        onClick={(event) => onHighlightClick(highlight, slice, event)}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onRemoveHighlight(highlight);
        }}
      >

        {slice}

      </span>

    );



    cursor = end;

  });



  if (cursor < content.length) {

    nodes.push(<span key={`tail-${cursor}`}>{content.slice(cursor)}</span>);

  }



  return nodes;

}



function getOffsetsWithin(range: Range, container: HTMLElement) {

  try {

    const startRange = range.cloneRange();

    startRange.selectNodeContents(container);

    startRange.setEnd(range.startContainer, range.startOffset);

    const start = startRange.toString().length;



    const endRange = range.cloneRange();

    endRange.selectNodeContents(container);

    endRange.setEnd(range.endContainer, range.endOffset);

    const end = endRange.toString().length;



    return { start, end };

  } catch {

    return null;

  }

}



function generateId(prefix: string) {

  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {

    return crypto.randomUUID();

  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

}

