"use client";

import { useCallback, useState } from "react";

type DocumentUploadProps = {
  onUploaded: (payload: {
    documentId: string;
    chunkCount: number;
    filename: string;
  }) => void;
  disabled?: boolean;
};

export function DocumentUpload({ onUploaded, disabled }: DocumentUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null);
      setIsUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/ingest", {
          method: "POST",
          body: formData,
        });

        const data = (await response.json()) as {
          documentId?: string;
          chunkCount?: number;
          filename?: string;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Upload failed");
        }

        if (!data.documentId || !data.chunkCount || !data.filename) {
          throw new Error("Invalid ingest response");
        }

        const payload = {
          documentId: data.documentId,
          chunkCount: data.chunkCount,
          filename: data.filename,
        };

        setLastResult(
          `Indexed ${payload.filename} (${payload.chunkCount} chunks)`,
        );
        onUploaded(payload);
      } catch (uploadError) {
        setError(
          uploadError instanceof Error ? uploadError.message : "Upload failed",
        );
      } finally {
        setIsUploading(false);
      }
    },
    [onUploaded],
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      if (disabled || isUploading) return;

      const file = event.dataTransfer.files[0];
      if (file) void uploadFile(file);
    },
    [disabled, isUploading, uploadFile],
  );

  return (
    <div className="space-y-3">
      <label
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        className={`flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 text-center transition hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 ${
          disabled || isUploading ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          disabled={disabled || isUploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadFile(file);
          }}
        />
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {isUploading ? "Indexing PDF..." : "Drop a PDF here or click to upload"}
        </p>
        <p className="mt-1 text-xs text-zinc-500">PDF only, max 10 MB</p>
      </label>

      {lastResult ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">{lastResult}</p>
      ) : null}
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
