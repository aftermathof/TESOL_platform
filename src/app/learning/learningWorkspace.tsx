"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useAuth } from "@/components/AuthProvider";
import type { LearningModuleRecord } from "@/lib/learningModules";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowserClient";



const DEFAULT_HIGHLIGHT_COLOR = "#fff9b1";

const highlightIcon: ReactNode = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
  >
    <path d="M3 21h6l12-12a3 3 0 0 0-6-6L3 15v6z" />
    <path d="M14.5 5.5l4 4" />
  </svg>
);

const noteIcon: ReactNode = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
  >
    <path d="M7 3h10a2 2 0 0 1 2 2v12l-4-4H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M7 3v6h6" />
  </svg>
);

const aiIcon: ReactNode = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
  >
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 3v2.5" />
    <path d="M12 18.5V21" />
    <path d="M3 12h2.5" />
    <path d="M18.5 12H21" />
    <path d="M5.2 5.2l1.8 1.8" />
    <path d="M17 17l1.8 1.8" />
    <path d="M5.2 18.8l1.8-1.8" />
    <path d="M17 7l1.8-1.8" />
  </svg>
);

const closeIcon: ReactNode = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
  >
    <path d="M6 6l12 12" />
    <path d="M18 6l-12 12" />
  </svg>
);

const completionFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatCompletionDate(value?: string | null) {
  if (!value) return null;
  try {
    return completionFormatter.format(new Date(value));
  } catch {
    return value;
  }
}



type Highlight = {

  id: string;

  sectionId: string;

  start: number;

  end: number;

  color: string;

  excerpt?: string;

  createdAt?: string;

  pending?: boolean;

};



type NoteEntry = {
  id: string;
  sectionId: string;
  start: number;
  end: number;
  text: string;
  createdAt: string;
  excerpt: string;
  pending?: boolean;
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



export function LearningWorkspace({
  modules,
  onCompleteModule,
  completingModuleId,
  initialModuleId,
}: {
  modules: LearningModuleRecord[];
  onCompleteModule?: (moduleId: string) => void;
  completingModuleId?: string | null;
  initialModuleId?: string;
}) {
  const { user } = useAuth();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(() => {
    if (initialModuleId && modules.some((module) => module.id === initialModuleId)) {
      return initialModuleId;
    }
    return modules[0]?.id ?? null;
  });

  const selectedModule = useMemo(

    () => modules.find((module) => module.id === selectedModuleId) ?? null,

    [modules, selectedModuleId]

  );



  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    selectedModule?.sections[0]?.id ?? null
  );

  const selectedSection = useMemo(
    () =>
      selectedModule?.sections.find(
        (section) => section.id === selectedSectionId
      ) ?? null,
    [selectedModule, selectedSectionId]
  );

  useEffect(() => {
    if (modules.length === 0) {
      setSelectedModuleId(null);
      setSelectedSectionId(null);
      return;
    }

    setSelectedModuleId((current) => {
      if (current) {
        const existing = modules.find((module) => module.id === current);
        if (existing) {
          return existing.id;
        }
      }

      if (initialModuleId) {
        const initialTarget = modules.find(
          (module) => module.id === initialModuleId
        );
        if (initialTarget) {
          return initialTarget.id;
        }
      }

      return modules[0]?.id ?? null;
    });
  }, [modules, initialModuleId]);

  useEffect(() => {
    if (!selectedModule) {
      setSelectedSectionId(null);
      return;
    }

    setSelectedSectionId((current) => {
      if (
        current &&
        selectedModule.sections.some((section) => section.id === current)
      ) {
        return current;
      }
      return selectedModule.sections[0]?.id ?? null;
    });
  }, [selectedModule]);

  const moduleCompleted = selectedModule?.completed ?? false;
  const moduleCompletionDate = formatCompletionDate(
    selectedModule?.completedAt ?? null
  );
  const isCompletingModule =
    completingModuleId != null && selectedModule?.id === completingModuleId;

  const [highlights, setHighlights] = useState<Record<string, Highlight[]>>({});

  const [notes, setNotes] = useState<NoteEntry[]>([]);

  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);

  const [noteDraft, setNoteDraft] = useState<NoteDraft | null>(null);

  const [aiPopover, setAiPopover] = useState<AiPopover>(null);

  const [loadingAnnotations, setLoadingAnnotations] = useState(false);



  const readerRef = useRef<HTMLDivElement | null>(null);



  useEffect(() => {
    if (!user?.id || modules.length === 0) {
      setHighlights({});
      setNotes([]);
      return;
    }

    const sectionIds = modules.flatMap((module) =>
      module.sections.map((section) => section.id)
    );

    if (sectionIds.length === 0) {
      setHighlights({});
      setNotes([]);
      return;
    }

    let cancelled = false;
    setLoadingAnnotations(true);

    async function loadAnnotations() {
      try {
        const [highlightResult, noteResult] = await Promise.all([
          supabase
            .from("module_highlights")
            .select(
              "id, section_id, start_index, end_index, color, excerpt, created_at"
            )
            .in("section_id", sectionIds)
            .order("start_index", { ascending: true }),
          supabase
            .from("module_notes")
            .select(
              "id, section_id, start_index, end_index, note_text, excerpt, created_at"
            )
            .in("section_id", sectionIds)
            .order("created_at", { ascending: true }),
        ]);

        if (cancelled) {
          return;
        }

        if (highlightResult.error) {
          console.error("Failed to load highlights", highlightResult.error);
        }
        if (noteResult.error) {
          console.error("Failed to load notes", noteResult.error);
        }

        const highlightMap: Record<string, Highlight[]> = {};

        for (const row of highlightResult.data ?? []) {
          const sectionId = row.section_id;
          if (!sectionId) {
            continue;
          }
          const highlight: Highlight = {
            id: row.id,
            sectionId,
            start: row.start_index ?? 0,
            end: row.end_index ?? 0,
            color: row.color ?? DEFAULT_HIGHLIGHT_COLOR,
            excerpt: row.excerpt ?? undefined,
            createdAt: row.created_at ?? undefined,
            pending: false,
          };
          if (!highlightMap[sectionId]) {
            highlightMap[sectionId] = [];
          }
          highlightMap[sectionId].push(highlight);
        }

        Object.keys(highlightMap).forEach((key) => {
          highlightMap[key].sort((a, b) => a.start - b.start);
        });

        setHighlights(highlightMap);

        const fetchedNotes: NoteEntry[] = (noteResult.data ?? []).map(
          (row) => ({
            id: row.id,
            sectionId: row.section_id,
            start: row.start_index ?? 0,
            end: row.end_index ?? 0,
            text: row.note_text ?? "",
            excerpt: row.excerpt ?? "",
            createdAt: row.created_at ?? new Date().toISOString(),
            pending: false,
          })
        );

        setNotes(fetchedNotes);
      } finally {
        if (!cancelled) {
          setLoadingAnnotations(false);
        }
      }
    }

    void loadAnnotations();

    return () => {
      cancelled = true;
    };
  }, [modules, supabase, user?.id]);



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
      const containerRect =
        readerRef.current?.closest("section")?.getBoundingClientRect();
      if (!containerRect) {
        setToolbar(null);
        setAiPopover(null);
        return;
      }



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



  async function applyHighlight(color: string, state: ToolbarState) {
    if (!selectedModule || !user?.id) {
      setToolbar(null);
      return;
    }

    const trimmedColor = color || DEFAULT_HIGHLIGHT_COLOR;

    if (state.highlightId) {
      setHighlights((prev) => {
        const existing = prev[state.sectionId] ?? [];
        return {
          ...prev,
          [state.sectionId]: existing.map((item) =>
            item.id === state.highlightId ? { ...item, color: trimmedColor } : item
          ),
        };
      });

      setToolbar((prev) =>
        prev ? { ...prev, highlightId: state.highlightId, origin: "highlight" } : prev
      );

      const { error } = await supabase
        .from("module_highlights")
        .update({
          color: trimmedColor,
          updated_at: new Date().toISOString(),
        })
        .eq("id", state.highlightId);

      if (error) {
        console.error("Failed to update highlight", error);
      }

      return;
    }

    const tempId = generateId("hl");
    const timestamp = new Date().toISOString();
    const overlappingIds: string[] = [];

    setHighlights((prev) => {
      const existing = prev[state.sectionId] ?? [];
      const remaining = existing.filter((item) => {
        const overlaps = !(item.end <= state.start || item.start >= state.end);
        if (overlaps) {
          overlappingIds.push(item.id);
        }
        return !overlaps;
      });

      const next: Highlight[] = [
        ...remaining,
        {
          id: tempId,
          sectionId: state.sectionId,
          start: state.start,
          end: state.end,
          color: trimmedColor,
          excerpt: state.text.trim(),
          createdAt: timestamp,
          pending: true,
        },
      ];

      next.sort((a, b) => a.start - b.start);

      return {
        ...prev,
        [state.sectionId]: next,
      };
    });

    setToolbar((prev) =>
      prev ? { ...prev, highlightId: tempId, origin: "highlight" } : prev
    );

    if (overlappingIds.length > 0) {
      const { error } = await supabase
        .from("module_highlights")
        .delete()
        .in("id", overlappingIds);
      if (error) {
        console.error("Failed to delete overlapping highlights", error);
      }
    }

    try {
      const { data, error } = await supabase
        .from("module_highlights")
        .insert({
          user_id: user.id,
          module_id: selectedModule.id,
          section_id: state.sectionId,
          start_index: state.start,
          end_index: state.end,
          color: trimmedColor,
          excerpt: state.text.trim(),
          created_at: timestamp,
          updated_at: timestamp,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      setHighlights((prev) => {
        const sectionHighlights = prev[state.sectionId] ?? [];
        return {
          ...prev,
          [state.sectionId]: sectionHighlights
            .map((item) =>
              item.id === tempId
                ? {
                    ...item,
                    id: data.id,
                    pending: false,
                    createdAt: data.created_at ?? item.createdAt,
                    start: data.start_index ?? item.start,
                    end: data.end_index ?? item.end,
                  }
                : item
            )
            .sort((a, b) => a.start - b.start),
        };
      });

      setToolbar((prev) =>
        prev ? { ...prev, highlightId: data.id, origin: "highlight" } : prev
      );
    } catch (error) {
      console.error("Failed to save highlight", error);
      setHighlights((prev) => {
        const sectionHighlights = prev[state.sectionId] ?? [];
        return {
          ...prev,
          [state.sectionId]: sectionHighlights.filter((item) => item.id !== tempId),
        };
      });
    }
  }



  async function removeHighlight(sectionId: string, highlightId: string) {
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

    if (!user?.id) {
      return;
    }

    const { error } = await supabase
      .from("module_highlights")
      .delete()
      .eq("id", highlightId);

    if (error) {
      console.error("Failed to delete highlight", error);
    }
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



  async function saveNoteFromDraft(draft: NoteDraft) {
    if (!selectedModule || !user?.id) {
      setNoteDraft(null);
      return;
    }

    const trimmedText = draft.text.trim();
    if (!trimmedText) {
      return;
    }

    const tempId = generateId("note");
    const createdAt = new Date().toISOString();
    const newNote: NoteEntry = {
      id: tempId,
      sectionId: draft.sectionId,
      start: draft.start,
      end: draft.end,
      text: trimmedText,
      createdAt,
      excerpt: draft.selectionText.trim(),
      pending: true,
    };

    setNotes((prev) => [...prev, newNote]);

    try {
      const { data, error } = await supabase
        .from("module_notes")
        .insert({
          user_id: user.id,
          module_id: selectedModule.id,
          section_id: draft.sectionId,
          start_index: draft.start,
          end_index: draft.end,
          note_text: trimmedText,
          excerpt: draft.selectionText.trim(),
          created_at: createdAt,
          updated_at: createdAt,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      setNotes((prev) =>
        prev.map((note) =>
          note.id === tempId
            ? {
                ...note,
                id: data.id,
                createdAt: data.created_at ?? note.createdAt,
                start: data.start_index ?? note.start,
                end: data.end_index ?? note.end,
                excerpt: data.excerpt ?? note.excerpt,
                pending: false,
              }
            : note
        )
      );
    } catch (error) {
      console.error("Failed to save note", error);
      setNotes((prev) => prev.filter((note) => note.id !== tempId));
    } finally {
      setNoteDraft(null);
      window.getSelection()?.removeAllRanges();
    }
  }

  async function removeNote(noteId: string) {
    setNotes((prev) => prev.filter((note) => note.id !== noteId));

    if (!user?.id) {
      return;
    }

    const { error } = await supabase
      .from("module_notes")
      .delete()
      .eq("id", noteId);
    if (error) {
      console.error("Failed to delete note", error);
    }
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

    <div className="grid h-full min-h-0 w-full gap-6 overflow-visible md:grid-cols-[260px_1fr_300px]">

      <aside className="flex min-h-0 flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">

        <div>

          <p className="text-xs font-semibold uppercase tracking-widest text-sky-500">

            Modules

          </p>

          <h3 className="mt-2 text-lg font-semibold text-zinc-900">学习模块</h3>

        </div>

        <nav className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1 text-sm">

          {modules.map((module) => (

            <button

              key={module.id}

              type="button"

              onClick={() => {

                setSelectedModuleId(module.id);

                setSelectedSectionId(module.sections[0]?.id ?? null);

                setToolbar(null);

                setNoteDraft(null);

                setAiPopover(null);

              }}

              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${

                module.id === selectedModuleId

                  ? "bg-[rgb(0,102,255)] text-white shadow-sm"

                  : "text-zinc-600 hover:bg-zinc-100"

              }`}

            >

              <span className="truncate pr-3">{module.title}</span>

              <span

                className={`whitespace-nowrap text-xs font-semibold ${

                  module.completed ? "text-white/80" : "text-zinc-400"

                }`}

              >

                {module.completed ? "已完成" : "未完成"}

              </span>

            </button>

          ))}

        </nav>

      </aside>



      <section className="relative flex min-h-0 flex-col overflow-visible rounded-2xl border border-zinc-200 bg-white shadow-sm">

        {selectedModule && selectedSection ? (

          <div className="flex min-h-0 flex-1 flex-col gap-6 p-8">

            <div className="flex items-center gap-2 overflow-x-auto">

              {selectedModule.sections.map((section) => (

                <button

                  key={section.id}

                  type="button"

                  onClick={() => {

                    setSelectedSectionId(section.id);

                    setToolbar(null);

                    setNoteDraft(null);

                    setAiPopover(null);

                  }}

                  className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs transition ${

                    section.id === selectedSectionId

                      ? "border-[rgb(0,102,255)] bg-[rgb(0,102,255)] text-white"

                      : "border-zinc-200 text-zinc-500 hover:border-[rgb(0,102,255)] hover:text-[rgb(0,102,255)]"

                  }`}

                >

                  {section.title}

                </button>

              ))}

            </div>

            <h2 className="text-xl font-semibold text-zinc-900">{selectedSection.title}</h2>

            <div className="flex-1 overflow-y-auto pr-3">

              <div

                ref={readerRef}

                data-section-id={selectedSection.id}

                className="reading-content whitespace-pre-wrap leading-7"

              >

                {renderHighlightedContent(

                  selectedSection.content,

                  highlights[selectedSection.id] ?? [],

                  (highlight, text, event) =>

                    openToolbarForHighlight(selectedSection.id, highlight, text, event),

                  (highlight) => removeHighlight(selectedSection.id, highlight.id)

                )}

              </div>

            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-sky-100 bg-sky-50/60 px-5 py-4 text-sm text-sky-700">

              <div>

                {moduleCompleted

                  ? moduleCompletionDate

                    ? `已于 ${moduleCompletionDate} 完成该模块。`

                    : "已完成该模块。"

                  : "完成全部学习内容后，点击下方按钮即可标记为完成。"}

              </div>

              {onCompleteModule && (

                <div className="flex justify-end">

                  <button

                    type="button"

                    onClick={() => onCompleteModule?.(selectedModule.id)}

                    disabled={moduleCompleted || isCompletingModule}

                    className="rounded-full bg-[rgb(0,102,255)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[rgb(0,92,230)] disabled:cursor-not-allowed disabled:bg-zinc-300"

                  >

                    {moduleCompleted

                      ? "已完成"

                      : isCompletingModule

                        ? "标记中…"

                        : "标记为完成"}

                  </button>

                </div>

              )}

            </div>

          </div>

        ) : (

          <p className="p-8 text-sm text-zinc-500">请选择一个学习模块开始学习。</p>

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

          <AiPopoverView popover={aiPopover} onClose={() => setAiPopover(null)} />

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

              void saveNoteFromDraft(noteDraft);

            }}

          />

        )}

      </section>



      <aside className="flex min-h-0 flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">

        <div>

          <p className="text-xs font-semibold uppercase tracking-widest text-sky-500">

            个人笔记

          </p>

          <h3 className="mt-2 text-lg font-semibold text-zinc-900">Insights</h3>

        </div>

        <div className="flex-1 space-y-3 overflow-y-auto pr-1 text-sm">

          {loadingAnnotations ? (

            <p className="rounded-xl bg-zinc-100/60 p-3 text-xs text-zinc-500">

              正在同步你的高亮与笔记...

            </p>

          ) : sectionNotes.length === 0 ? (

            <p className="rounded-xl bg-zinc-100/60 p-3 text-xs text-zinc-500">

              选择一段文本并添加笔记以便回顾。

            </p>

          ) : (

            sectionNotes.map((note) => (

              <div

                key={note.id}

                className="relative rounded-xl border border-zinc-100 bg-white p-3 shadow-sm"

              >

                <button

                  type="button"

                  onClick={() => {

                    void removeNote(note.id);

                  }}

                  className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-xs text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"

                  aria-label="删除笔记"

                >

                  <span aria-hidden className="flex items-center justify-center">

                    {closeIcon}

                  </span>

                </button>

                <p className="pr-6 text-xs font-medium text-zinc-500">

                  {new Date(note.createdAt).toLocaleString()}

                </p>

                <p className="mt-2 leading-6 text-zinc-700">{note.text}</p>

                <p className="mt-2 text-xs italic text-zinc-500">

                  原文：{note.excerpt || ""}

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

      className="pointer-events-auto absolute z-[1000] flex -translate-x-1/2 items-center gap-1 rounded-full border border-zinc-200 bg-white/95 px-2 py-1 shadow-xl"

      style={{ left: state.position.x, top: state.position.y }}

    >

      <IconButton

        label="Highlight"

        icon={highlightIcon}

        onClick={() => onApplyHighlight(DEFAULT_HIGHLIGHT_COLOR)}

      />

      <IconButton label="Note" icon={noteIcon} onClick={onNote} />

      <IconButton label="AI" icon={aiIcon} onClick={onAiAssist} />

      <span className="h-4 w-px bg-zinc-200" />

      <IconButton label="Close" icon={closeIcon} onClick={onClose} />

    </div>

  );

}



function IconButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-full text-base text-zinc-600 transition hover:bg-zinc-100"
    >
      <span aria-hidden className="flex items-center justify-center">{icon}</span>
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
  onSave: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div
      className="pointer-events-auto absolute z-40 w-[420px] rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl"
      style={{ left: draft.position.x, top: draft.position.y }}
    >
      <div className="flex items-center justify-between">

        <h4 className="text-sm font-semibold text-zinc-800">添加笔记</h4>

        <button

          type="button"

          onClick={onCancel}

          className="rounded-full px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-100"

        >

          取消

        </button>

      </div>

      <p className="mt-2 text-xs text-zinc-500">
        选中内容：
        {draft.selectionText.length > 120
          ? ` ${draft.selectionText.slice(0, 116)}...`
          : ` ${draft.selectionText}`}
      </p>
      <textarea
        ref={textareaRef}
        className="mt-3 h-32 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
        placeholder="写下你的想法..."
        value={draft.text}
        onChange={(event) => onChangeText(event.target.value)}
      />

      <div className="mt-3 flex justify-end gap-2">

        <button

          type="button"

          onClick={onCancel}

          className="rounded-full px-4 py-2 text-xs font-semibold text-zinc-500 hover:bg-zinc-100"

        >

          取消

        </button>

        <button

          type="button"

          onClick={() => {
            void onSave();
          }}

          disabled={!draft.text.trim()}

          className="rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-300"

        >

          保存笔记

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

          aria-label="Close" className="rounded-full px-2 text-xs text-zinc-400 hover:bg-zinc-100"

        >

          

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
): ReactNode[] {
  if (highlights.length === 0) {

    return [<span key="plain">{content}</span>];

  }


  const ordered = [...highlights].sort((a, b) => a.start - b.start);

  const nodes: ReactNode[] = [];

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






