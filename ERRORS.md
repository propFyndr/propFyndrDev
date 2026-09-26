
## 2026-09-26 — Outage notice reworded, detectors not updated
**What didn't work:** `OUTAGE_NOTICE` was reworded to "…briefly unavailable…" but `isServiceFailureReply` (answer-cache guard) and the corpus grader's `PROVIDER_EXHAUSTED` still matched the old phrases. Outage turns were cacheable and graded `pass` — the corpus said 90% while 59% of turns were outage notices.
**What worked:** both now call `isOutageNotice()` from `lib/ai/outageNotice.ts` (one fingerprint, one module).
**Note for next time:** any user-visible fixed string that another module must recognise gets ONE exported predicate beside it. Never re-type the phrase in a regex elsewhere.

## 2026-09-26 — Python-in-bash-heredoc edits corrupted escape sequences
**What didn't work:** editing TS files with `python - <<'EOF'` scripts. Inside the Python string, `\n` / `\s` became a real newline / `\s`, so regex literals and test strings were broken across lines (3 attempts); one script also died on bash quote parsing before running.
**What worked:** the Edit tool for any replacement containing backslashes, and a Python script written to the scratchpad with the Write tool (raw `'''` strings) for bulk copy edits.
**Note for next time:** never pass backslash-bearing code through a heredoc'd Python string. Write the script to a file, or use Edit.
