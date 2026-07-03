"use client";

import type { RetrievedSource } from "@/lib/types";

type SourcesPanelProps = {
  sources: RetrievedSource[];
  highlightedIndex: number | null;
  onHighlight: (index: number | null) => void;
};

export function SourcesPanel({
  sources,
  highlightedIndex,
  onHighlight,
}: SourcesPanelProps) {
  if (sources.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Sources
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          Retrieved chunks will appear here after you ask a question.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Retrieved sources
      </h2>
      <ul className="mt-3 space-y-3">
        {sources.map((source, index) => {
          const citation = index + 1;
          const isHighlighted = highlightedIndex === citation;

          return (
            <li
              key={source.id}
              id={`source-${citation}`}
              className={`rounded-lg border p-3 text-sm transition ${
                isHighlighted
                  ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40"
                  : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
              }`}
              onMouseEnter={() => onHighlight(citation)}
              onMouseLeave={() => onHighlight(null)}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="font-medium text-blue-700 hover:underline dark:text-blue-300"
                  onClick={() => onHighlight(citation)}
                >
                  [{citation}] Page {source.page}
                </button>
                <span className="text-xs text-zinc-500">
                  score {source.score.toFixed(3)}
                </span>
              </div>
              <p className="line-clamp-6 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                {source.text}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
