# Restore test: copy live, restore elsewhere, compare every table

Proven 2026-11-06 (cycle 3, day 2). Live is only read. Nothing here touches the live branch's data.

## What this proves, and what it does not
- Proves: a Neon branch of live comes up with the same data, in the time recorded below.
- Does **not** prove: a `pg_dump` file restores. Step 6 is the dump route and has **not been run**; do it before calling backups tested.
- A branch is copy-on-write inside the same Neon project, so it is not protection against deleting the project.

## Steps (Neon MCP, or the Neon console)
1. Project `RealtyAsk-Live`, id `dawn-credit-38642951`; branch `production` is `br-quiet-hat-ao8bib8n`.
2. Create branch `restore-test-<date>` with parent `production`. Note the start time.
3. Run on **production**, then on the **new branch** (same statement):
   ```sql
   select count(*) tables, sum(n) total_rows,
          md5(string_agg(table_name||':'||n, ',' order by table_name)) digest
   from (select table_name,
                (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text::bigint n
         from information_schema.tables where table_schema='public' and table_type='BASE TABLE') t
   ```
4. Digests must be equal. If not, list per-table counts on both (drop the `md5` part) and compare; busy tables (`chat_messages`, `ai_usage_events`, `turn_traces`) can differ by a few rows if a buyer was active between the two queries, so re-run both within seconds.
5. Delete the branch when done (ask the owner first; it holds a full copy of buyer data).
6. Dump route (not yet run): `pg_dump --format=custom "$NEON_DB" > live.dump`, `createdb` a scratch database on the dev Neon project, `pg_restore`, repeat step 3 against it, then delete the scratch database and the dump file. The dump holds buyer data: keep it local, never commit it.

## Result, 2026-11-06
| Item | Value |
|---|---|
| Branch created | 12:14:10Z (`br-old-math-aos34dyn`, 233 MB logical) |
| Branch answering queries | by 12:14:23Z, so under 13 s |
| Tables compared | 79 |
| Total rows | 317,898 on both |
| Digest | `ca1cc157763ddca77cf63f00dbc9f1cb` on both |
| Differences | none |
