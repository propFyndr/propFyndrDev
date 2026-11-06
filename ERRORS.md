
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

## 2026-10-02 — Blog generation was slow for reasons none of the first fixes touched
**What didn't work:** tuning around the symptom. `reasoning_effort: 'low'` made drafts thinner. An expand pass made drafts longer but added 13s. Rewrite triggers added calls that Groq then throttled.
**What worked:** measuring with Groq's own `usage` fields (prompt/completion tokens, completion_time) and `x-ratelimit-*` headers. The strict JSON schema added ~5k prompt tokens and its null-padded output hit the completion cap, truncating the article. That truncation was the "short drafts" problem all along. The key's 8k tokens/min explained the 25-48s outliers.
**Note for next time:** before optimising an LLM call, log usage (prompt/completion tokens and time) and read the rate-limit headers. Structured-output schemas have a real token cost; Markdown plus a parser is often both faster and longer.

## 2026-10-02 — gpt-oss cites in whatever format the prompt implies, not the one it is told
**What didn't work:** asking for `[phrase](URL)` links while listing sources as `[1] title`. The model wrote `[1]` footnotes. With sources unnumbered it switched to `phrase【URL】`. It also wrote a Markdown table despite "no tables". Each left artefacts on the page and "0 cited" in the notes.
**What worked:** an unnumbered SOURCES block, plus a parser fallback (`linkFootnotes`) that turns `[n]`, `【n】` and `【URL】` into real links on the preceding clause (unknown refs dropped, URLs only if they are ours), and a table-to-list conversion. Gotcha found live: a decimal point ("29.7 km") looked like a sentence end and split the clause; protect `\d.\d` before splitting.
**Note for next time:** treat any instruction to an LLM about output format as a preference, and parse defensively for the formats it falls back to. Test with real replies, not just the format you asked for.

## 2026-10-05 — Regex edits through Python/sed heredocs corrupted `\b`
**What didn't work:** editing TypeScript regexes with `python - <<'EOF'` string replaces and `sed -i`. `\b` became a literal backspace (0x08) in one pass and a bare `b` in the repair; `\n` inside template literals became real line breaks. Typecheck stayed green, because a regex with a stray `b` is still valid.
**What worked:** the Edit tool for any line holding a regex or an escape; then `grep -P "\x08"` and a diff read to catch what slipped.
**Note for next time:** never route regex or `\n` text through a shell-quoted script. Typecheck does not catch it, so read the diff.

## 2026-10-09 — `npm ci` run against a live workspace
**What didn't work:** concluding "dependencies not installed" from a garbled `ls node_modules/.bin | grep -c` (the rtk hook rewrites output) and running `npm ci` at the repo root. `npm ci` deletes `node_modules` first; it then failed with EPERM on `@next/swc` held open by the running `next dev`, leaving a half-deleted tree under four live dev servers. The backend dev server died.
**What worked:** `npm install` (adds what is missing, deletes nothing), then `git checkout -- package-lock.json` because install rewrote it, then `prisma generate` (engine DLL still locked while `next dev` runs).
**Note for next time:** check for running node processes (`Get-CimInstance Win32_Process -Filter "Name='node.exe'"`) and test for a specific package path (`test -e node_modules/typescript`) before any install. Never `npm ci` in a workspace someone is running.

## 2026-10-13 — Running a live, chat-driven test suite outside the test runner
**What didn't work:** (1) dynamic `import()` in a node:test file — it bypasses the `tsx/cjs` hook (ERR_MODULE_NOT_FOUND); (2) `NODE_ENV=development` — logger wants `pino-pretty`, which is not a dependency; (3) `NODE_ENV=staging` — env schema only allows development/production/test; (4) `NODE_ENV=test` — chat-router marks every session `is_bot`, so the referral tree drops every chatting device. Also: the live Supabase pooler (`connection_limit=3`) dropped mid-run twice, failing every later test and skipping cleanup.
**What worked:** `require()` inside `before()`, `NODE_ENV=production FRONTEND_URL=https://realtyask.in`, `node --env-file=<main checkout>/backend/.env`, a `SELECT 1` wait in `beforeEach`/`before`/`after`, and a unique run prefix on every row so leftovers can be deleted by prefix.
**Note for next time:** live suites need a DB-wait before each step and a prefix-scoped cleanup you can run by hand. Print the prefix first thing.

## 2026-10-13 — `npm ci` in `frontend/` pruned the backend's hoisted deps
**What didn't work:** `npm ci` inside `frontend/` of a workspace checkout reinstalled the shared root `node_modules` for the frontend only: `express` vanished (backend typecheck/tests failed with TS2307) and the generated Prisma client was replaced.
**What worked:** `npm install` in `backend/` (adds, deletes nothing), `npx prisma generate` in `backend/`, then `git checkout -- package-lock.json` because install rewrote it.
**Note for next time:** after installing either app in a workspace checkout, re-check the other (`test -e node_modules/express`) and regenerate the backend Prisma client.

## 2026-10-14 — `git stash apply $(lookup)` with an empty lookup applied someone else's stash
**What didn't work:** `git stash push -- <file>` on a file with no changes saves nothing, so the follow-up `git stash apply $(git stash list | grep <tag> …)` ran with an empty argument and applied the newest stash on the shared stack — another session's WIP. It conflicted on `.tokensave/tokensave.db`, which stopped the `&&` chain before the `drop` (which would also have dropped their stash).
**What worked:** checking `git stash list` (their entry intact), confirming by mtime that the conflicted file was written by the apply, then `git rm --cached` + removing only that file.
**Note for next time:** never pass a computed stash ref without checking it is non-empty (`[ -n "$S" ] || exit 1`). To compare old vs new code, copy the file aside instead of stashing.

## 2026-10-14 — Background compaction OOM'd the 512 MB Render instance (dev crash-looped)
**What didn't work:** the first `compactStoredArtifacts` selected 300 rows' `artifacts` JSON in one query. Rows reach ~256 KB of JSON (p99 122 KB stored), several times that once parsed, so the job ran the dev instance out of memory ~60 s after every boot; dev restarted in a loop and a chat request got a 502. Live was untouched (not deployed there).
**What worked:** query ids only, then read/compact/write one row at a time, batch 50, first run 5 min after boot. Measured locally: peak RSS +29 MB over baseline.
**Note for next time:** before any background job that reads JSON columns, measure `max(length(col::text))` and multiply by the batch size — and run one batch locally with an RSS probe before deploying.

## 2026-10-15 — Four false test failures from `--env-file=.env` on the full runner
**What didn't work:** running `node --env-file=.env --require tsx/cjs src/test-runner.ts`. The flag put `PORT=3001` and other `.env` values into the environment, so `env.test.ts` (PORT default 3000) and three `guestRateLimiter` tests failed, none related to the change under test.
**What worked:** running those two files alone without `--env-file` — 26/26 pass. A single DB-backed file (e.g. the route replay) needed `--env-file` to reach the dev database. The full runner itself needs no flag: run as `node --require tsx/cjs src/test-runner.ts` (4,345 tests) it reached the dev database on its own.
**Note for next time:** use `--env-file` only for one DB-backed file at a time, and blank the provider keys yourself when you do (`test-runner.ts` does it for you; a direct `node --test` does not). If a full run shows failures in unrelated config tests, re-run those files without the flag before suspecting the change.

## 2026-10-26 — `next dev` for a phone test died three times: the host was out of commit memory
**What didn't work:** starting `frontend` `next dev -p 3010` (own `NEXT_DIST_DIR`) next to the running backend, a corpus run and other projects' dev servers. Free virtual memory was 1.3 GB of 48.8 GB, with 1.1 GB physical free. Default heap: "semi space commit failed" on the first compile of `/`. `--max-old-space-size=4096` didn't help, because it was the OS refusing, not V8: a 107 KB native allocation failed. A third run died with "Zone Allocation failed" at a 450 MB heap. Jest workers and an esbuild spawn failed the same way.
**What worked:** nothing for the UI. The buyer flow was driven against the backend API with the same headers and bodies as the components send, and `jest -i` (in-band) ran.
**Note for next time:** check `FreeVirtualMemory` from `Get-CimInstance Win32_OperatingSystem` before starting `next dev`. Below about 4 GB free, close other dev servers first rather than tuning heap flags. Next also adds the new dist dir to `frontend/tsconfig.json`, so revert that file afterwards.

## 2026-10-26 — Four corpus runs to get one honest Day 7 scorecard
**What didn't work:**
- Stopping a backgrounded `npx tsx src/index.ts` with TaskStop. It killed the npx wrapper; the node child kept listening, and the next "restart" tested old code.
- `run-corpus.ts` concatenated every token event and ignored `replace: true`. A turn the app shows as clean read as "outage notice + answer".
- A third server, a corpus run and an agent's `next dev` together ran the host out of memory, and the memory guard killed the last run.
**What worked:** kill by the `"pid"` in the server's JSON log (`Stop-Process -Id <pid>`), then confirm the port with curl. The corpus client now renders `replace` as `streamReducer.ts` does.
**Note for next time:** check free memory first. Run one server at a time. Grade what the buyer sees, not the raw stream.

## 2026-10-31 — A sector-run regex that could never match, and two replays that deleted each other's sessions
**What didn't work:**
- Patching `sectorMentions.ts` from a Python heredoc: a double backslash before `b` reached Python as a single `\b` (a backspace character, 0x08), so the new regex needed a backspace in the message and never matched. The function printed no debug output and every test failed with no error, which cost about ten steps.
- Running three `route-replay.ts` processes at once next to the full replay: each deletes its guest sessions on exit, so the full run lost multi-turn state (a resale follow-up and a roadmap `next` failed, and passed alone).
**What worked:** `python3 -c "print(open(f,newline='').read().count(chr(8)))"` found the stray byte; patches that need a backslash now use `chr(92)`, or the Edit tool. One replay at a time.
**Note for next time:** after any scripted edit that contains a regex, grep the file for `chr(8)` and run the unit test first. Never start a second replay while one is running. The roadmap `next` cases in `live-2026-10-17-ed1ac3ff-transcript` also flip between runs on their own (a different turn fails each time, then 18/18 on the third run), so a single failure there is a race in step persistence, not a regression.

## 2026-11-03 — Follow-up replay cases flipped between runs: the first fix covered one of two persist paths
**What didn't work:** treating it as "replays delete each other's sessions". The cleanup deletes by each run's own random guest tokens, so that was never the cause. A first fix made the next turn wait for the previous turn's rows, but only on the main path (`persistPromises`); three of five follow-up cases still failed in a rerun.
**What worked:** handler-lane turns persist through `persistEarlyTurn`, a separate fire-and-forget `void (async () => …)()`. The reply is sent first, so a quick "next step?" or "yes" read a history without the last turn. Both paths now register their write with `trackPersist`, and the next turn of that session calls `waitForPersist` (max 4 s) before reading the session. Before: three full replays gave 225/225, 223/225 and 221/225, every miss a follow-up turn. After: the five follow-up cases ran four times, 23/23 each.
**Note for next time:** when a flaky test is always a *second* turn, look for a write that happens after `res.end()`. Grep every `chatMessage.create`/`createMany` and check who awaits it. A full replay needs about 2.5 GB free: check memory first (the host reaped one run).

## 2026-11-03 — A source and date in a buyer answer were deleted twice by the output sanitizer
**What didn't work:** "(read 27 Oct 2026 from up-rera.in)". `sanitizeOutput` collapses any citation-shaped parenthetical to "(market data)". Moving it into the sentence with the portal's address was worse: `OFFPLATFORM_REFERRAL` deletes a whole sentence that names `up-rera.in`, figures included, and swaps in a generic referral line.
**What worked:** "We read UP-RERA's registry page for this project on 27 Oct 2026: it lists 53 complaints…", no parenthesis and no address. A test fails if the address returns.
**Note for next time:** after adding any code-built buyer sentence that carries a source, run it through the real route (route replay with `--answers`), not just the unit test. The sanitizer sits between a handler and the buyer.

## 2026-11-06 — Local load test froze the server: it was my harness, not the app
**What didn't work:** four local A/B runs (pool 3 vs 15) showed a server that stopped answering even `/healthz` after ~100 s, with 55-75 of ~100 turns timing out. I read it as an app bug (event-loop block, then pool size). A single turn blocks the loop for at most 66 ms, a 25-parallel burst finished in 5 s, and 71 questions asked one by one never froze it.
**What worked:** `ab-pool.cjs` ran the load with `execSync` (blocks the parent) while the server's stdout was a pipe the parent no longer read. Once the pipe buffer filled, the server blocked inside `console.log` and everything stalled. With `stdio: 'ignore'` the same 25 buyers ran 642 turns, 0 errors, 1.1 s first word.
**Note for next time:** never `execSync` while a child's stdout/stderr is piped to you. Use `stdio: 'ignore'` or a file, or keep the parent async. If a local server "freezes" under a harness, rule the harness out first (does `/healthz` answer when you drive it from a different process?).

## 2026-11-06 — Failure drills passed because a zombie server answered
**What didn't work:** all five drill scenarios returned healthy answers (a model answer with every AI key "blank", real payment plans with a dead database).
**What worked:** `child.kill()` on a `shell: true` child only kills the shell, so the baseline server stayed on port 3055 and every later scenario spoke to it. Fix: `taskkill /T /F /PID`, and refuse to start a scenario if the port already answers. Also: the app refuses to boot with NO AI key, so "providers off" must mean keys the providers reject.
**Note for next time:** a chaos test must prove the broken thing is the thing answering (port free before start, scenario-specific symptom after).

## 2026-11-06 — Python heredoc edit broke a `\n\n` again (repeat of 2026-09-26)
**What didn't work:** moving the SSE judge into `judge.ts` with a `python - <<'EOF'` script turned `split('\n\n')` into a literal line break; esbuild said "Unterminated string literal".
**What worked:** one Edit-tool fix. Same lesson as the 2026-09-26 entry: no backslash-bearing code through a Python string.
**Note for next time:** for a code move, use the Write tool for the whole file, not a scripted slice.
