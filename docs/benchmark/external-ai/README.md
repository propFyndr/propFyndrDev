# What other assistants say, collected weekly (free)

Decided 4 Nov 2026: no paid API calls, no new table. Answers are pasted by a person from the consumer apps (closer to what buyers see than API answers) and kept as files here.

**Internal only.** Nothing here is shown to a buyer, cited as a source, or written to a project row. A claim enters our data only as a UP-RERA record that a person read and approved (`scripts/data-integrity/28-*`, `29-*`, `30-*`).

## Weekly, about 30 minutes

1. Make a folder named for the day: `docs/benchmark/external-ai/YYYY-MM-DD/`.
2. Ask ChatGPT and Perplexity (Gemini and Google AI Overview if time allows) the 40 questions in `backend/scripts/corpus/safety40.json` (10 projects × 4 phrasings). Use a fresh chat for each question.
3. Save one file per assistant, `chatgpt.json`, `perplexity.json` and so on:
   ```json
   [{ "q": "Is Mahagun Mezzaria safe to buy?", "answer": "<pasted answer>", "links": ["<each cited link>"] }]
   ```
4. Score it and build the check list:
   ```
   cd backend
   npx tsx scripts/corpus/safety40.ts external ../docs/benchmark/external-ai/YYYY-MM-DD
   ```
   Scores go to `docs/benchmark/safety40/`. `claims-to-check.json` lands in the same folder: every sentence with a figure about complaints, orders, court cases, registration, OC, possession or abeyance.
5. The approver (Furqan) checks each claim on UP-RERA. If the register confirms it, the record is staged and approved through the data-integrity scripts. The assistant's text is never copied in.

## Scoring

`backend/scripts/corpus/safetyScore.ts`: the same four sentence counts for every answer, ours and theirs. These are counts, not a grade.

- **sourced:** a sentence with a figure or date that names the record it came from.
- **unsourced:** a figure or date with no record named. These are the candidates for wrong facts; whether one is actually wrong needs the register.
- **reassurance:** a verdict no record supports ("safe", "clean", "no litigation", "delivered", "trusted builder").
- **notOnRecord:** an honest statement that a fact is not held.

`2026-10-31/` holds the hard-43 safety answers converted from `docs/benchmark/hard43/` (ChatGPT 7, Perplexity 2), so the flow has run once.
