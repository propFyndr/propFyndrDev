import json
from pathlib import Path
D = Path(__file__).parent
qs = {q["id"]: q for q in json.loads((D/"questions.json").read_text(encoding="utf-8"))}
ours = {r["id"]: r for r in json.loads((D/"ours.json").read_text(encoding="utf-8"))}
nb = {r["id"]: r for r in json.loads((D/"needle2.json").read_text(encoding="utf-8"))}
FIELDS = ["bhk", "budgetMax", "possession", "location", "metro", "workplace"]
TASK = {"search_homes": "search", "ask_about_project": "project_question", "check_builder": "builder_trust",
        "compare_projects": "compare", "total_cost": "total_cost", "loan_emi": "emi"}
def cr(v, u): return None if v is None else (v / 100 if u == "lakh" else v)
def ours_fields(i):
    return {"bhk": (i.get("bhk") or [None])[0], "budgetMax": i.get("budgetMax"), "possession": i.get("possession"),
            "location": i.get("sector") or i.get("city"), "metro": True if any("metro" in str(k).lower() for k in (i.get("lifestyleKeywords") or [])) else None,
            "workplace": i.get("workplace")}
def needle_fields(r):
    calls = r["calls"] or r["suppressed"]
    s = next((c["arguments"] for c in calls if c["name"] == "search_homes"), {})
    return {"bhk": s.get("bhk"), "budgetMax": cr(s.get("budget_max"), s.get("budget_unit")), "possession": s.get("possession"),
            "location": s.get("location"), "metro": s.get("near_metro") or None, "workplace": s.get("workplace")}, (TASK.get(calls[0]["name"]) if calls else None)
def eq(f, a, b):
    if a is None or b is None: return a is None and b is None
    if f == "budgetMax": return abs(float(a) - float(b)) < 1e-6
    if isinstance(a, str): return a.lower() in str(b).lower()
    return a == b
tot = {"ours": [0, 0, 0], "needle": [0, 0, 0]}
task_ok = 0; rows = []
for qid, q in qs.items():
    lab = q["label"]; o = ours_fields(ours[qid]["intent"]); n, task = needle_fields(nb[qid])
    line = [qid]
    for name, got in (("ours", o), ("needle", n)):
        ok = sum(eq(f, lab[f], got[f]) for f in FIELDS if f in lab)
        want = sum(f in lab for f in FIELDS)
        wrong_extra = [f for f in FIELDS if f not in lab and got[f] not in (None, False)]
        tot[name][0] += ok; tot[name][1] += want; tot[name][2] += len(wrong_extra)
        line.append(f"{name} {ok}/{want}" + (f" +extra:{','.join(wrong_extra)}" if wrong_extra else ""))
    task_ok += task == lab["task"]
    line.append(f"needle task {task} {'OK' if task == lab['task'] else 'WRONG'} conf={nb[qid]['confidence']} {'held' if not nb[qid]['calls'] else 'acted'}")
    rows.append(line); print(" | ".join(line))
calls_ms = [r["ms"] for r in nb.values()]
ours_model = sum(t["wouldCallModel"] for r in ours.values() for t in r["turns"]); ours_turns = sum(len(r["turns"]) for r in ours.values())
summary = {"fields_ours": tot["ours"], "fields_needle": tot["needle"], "needle_task_correct": task_ok, "n": len(qs),
           "needle_ms_median": sorted(calls_ms)[len(calls_ms)//2], "needle_ms_max": max(calls_ms),
           "needle_acted": sum(bool(r["calls"]) for r in nb.values()),
           "ours_turns_needing_model": [ours_model, ours_turns]}
print(json.dumps(summary)); (D/"score.json").write_text(json.dumps({"rows": rows, "summary": summary}, indent=1))
