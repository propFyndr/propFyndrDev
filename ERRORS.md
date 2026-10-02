
## 2026-09-26 — Outage notice reworded, detectors not updated
**What didn't work:** `OUTAGE_NOTICE` was reworded to "…briefly unavailable…" but `isServiceFailureReply` (answer-cache guard) and the corpus grader's `PROVIDER_EXHAUSTED` still matched the old phrases. Outage turns were cacheable and graded `pass` — the corpus said 90% while 59% of turns were outage notices.
**What worked:** both now call `isOutageNotice()` from `lib/ai/outageNotice.ts` (one fingerprint, one module).
**Note for next time:** any user-visible fixed string that another module must recognise gets ONE exported predicate beside it. Never re-type the phrase in a regex elsewhere.

## 2026-09-26 — Python-in-bash-heredoc edits corrupted escape sequences
**What didn't work:** editing TS files with `python - <<'EOF'` scripts. Inside the Python string, `\n` / `\s` became a real newline / `\s`, so regex literals and test strings were broken across lines (3 attempts); one script also died on bash quote parsing before running.
**What worked:** the Edit tool for any replacement containing backslashes, and a Python script written to the scratchpad with the Write tool (raw `'''` strings) for bulk copy edits.
**Note for next time:** never pass backslash-bearing code through a heredoc'd Python string. Write the script to a file, or use Edit.

## 2026-10-02 — Python edit scripts: non-raw strings turn `\b` into a backspace
**What didn't work:** a scratchpad Python script (written with the Write tool, as the entry above advises) used ordinary `"""..."""` strings for TS regex replacements. Python read `\b` as the backspace byte 0x08, so `/\b(?:process…)\b/` landed in `jev/execute.ts` with three invisible control characters; tsc still passed. Separately, a bash heredoc carrying a Python script with nested quotes died on bash parsing (twice).
**What worked:** `r'''...'''` raw strings for every replacement containing a backslash; a byte-level `b.replace(b'\x08', b'\b')` to repair; `grep -c "[[:cntrl:]]"` on edited files to check.
**Note for next time:** every Python string that carries TS source is raw. After a scripted edit, grep the file for control characters — the compiler will not notice a regex that silently stopped matching.

## 2026-10-02 — Groq `json_object` mode returns malformed JSON on long outputs
**What didn't work:** the blog generator used `response_format: { type: 'json_object' }` with `gpt-oss-120b`. A 900-word target produced `json_validate_failed` (stray `"` between array items). Groq's docs say JSON object mode guarantees valid syntax but not the schema, and in practice it failed outright.
**What worked:** `response_format: { type: 'json_schema', json_schema: { strict: true, schema } }`, which is constrained decoding. Strict mode needs every property in `required` (optional ones become `anyOf [..., null]`) and `additionalProperties: false`. `dropNulls()` then turns the nulls back into absent fields for Zod. One retry covers transient errors.
**Note for next time:** for any Groq call that must return structure, start with strict `json_schema`, not `json_object`. groq-sdk 0.7's types predate it, so cast the `response_format`.

## 2026-10-02 — Scripted edits again: sed dropped a closing backtick, Python wrote real newlines
**What didn't work:** (1) a `sed` replace whose match ended at the closing backtick of a template literal dropped the backtick, and tsx failed with "Expected ';'". (2) A Python edit carrying `\n` inside a non-raw `"""` string, run through a bash heredoc, wrote literal newlines into a TS template string. The same class of bug as the entry above.
**What worked:** the Edit tool for any change touching quotes, backticks or escapes; sed/Python only for plain-text substitutions.
**Note for next time:** if the replacement contains a backtick, a quote or a backslash, use Edit. After any scripted edit, run tsc before running the code.

## 2026-10-02 — Scoop's Tesseract ships with no language data
**What didn't work:** `scoop install tesseract`, then `tesseract --list-langs` showed 0 languages, so OCRmyPDF could not OCR anything.
**What worked:** downloading `eng.traineddata` and `hin.traineddata` from `tesseract-ocr/tessdata_best`, and `osd.traineddata` from `tesseract-ocr/tessdata`, into `~/scoop/apps/tesseract/current/tessdata/`. Skipped `tesseract-languages` (every language).
**Note for next time:** OCR English documents with `-l eng` only. `eng+hin` on English artwork makes the Hindi model invent Devanagari text.
