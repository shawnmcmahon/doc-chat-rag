# Known Bugs

All items below were addressed in the Jul 2026 bug-fix pass.

## High

1. ~~**Chat history persists across document uploads**~~ — Fixed with `useChat({ id: documentId })` and `key={documentId}` on `ChatPanel`.
2. ~~**Search immediately after upsert can miss records**~~ — Fixed with `waitForNamespaceRecords()` polling after upsert.
3. ~~**Refusal threshold effectively dead**~~ — Calibrated `MIN_RELEVANCE_SCORE` to `0.05` using eval retrieval scores.

## Medium

4. ~~**Eval retrieval check too lenient**~~ — `checkRetrieval` now uses `.every()`.
5. ~~**Eval leaks namespaces**~~ — `deleteDocumentNamespace()` called in `finally`.
6. ~~**Sources panel desyncs from older messages**~~ — Sources stored per assistant message; panel updates on hover.
7. ~~**API error bodies render as raw JSON**~~ — API returns plain-text errors; `ChatPanel` parses JSON fallback.

## Low

8. ~~**Dead overlap logic in chunker**~~ — Long-paragraph split seeds carry-over overlap.
9. ~~**Refusal response still streams sources**~~ — `streamRefusal()` no longer emits sources.
10. ~~**`ensurePineconeIndex()` runs on every ingest**~~ — Cached per process; duplicate-create treated as success.
11. ~~**`getLatestUserQuestion` throws → 500**~~ — Returns 400 when no user text found.
12. ~~**`modelMessages.slice(0, -1)` fragile**~~ — Drops trailing user messages explicitly.
13. ~~**Token usage totals misleading**~~ — Renamed `sessionTotals` → `instanceTotals`.
14. ~~**No auth/rate limiting**~~ — IP-based rate limits on `/api/ingest` and `/api/chat`.
15. ~~**Zod v4 deprecation**~~ — `z.string().uuid()` → `z.uuid()`.
