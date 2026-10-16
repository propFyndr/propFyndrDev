"""Design B: one tool per action (Needle's own tool-design guide)."""
import json, os, time
from pathlib import Path
os.environ["NEEDLE_TELEMETRY"] = "0"; os.environ["DO_NOT_TRACK"] = "1"
import needle
DIR = Path(__file__).parent
S = lambda d: {"type": "string", "description": d}
N = lambda d: {"type": "number", "description": d}
UNIT = {"type": "string", "enum": ["crore", "lakh"]}
def tool(name, desc, props, req=()):
    return {"name": name, "description": desc, "parameters": {"type": "object", "properties": props, "required": list(req)}}
TOOLS = [
    tool("search_homes", "Find flats or apartments to buy: by BHK, budget, location, possession, metro or office commute",
         {"bhk": {"type": "integer", "minimum": 1, "maximum": 6}, "budget_max": N("budget ceiling as written"), "budget_unit": UNIT,
          "location": S("city or sector to live in"), "possession": {"type": "string", "enum": ["immediate", "1year", "2year", "3year+"], "description": "immediate = ready to move"},
          "near_metro": {"type": "boolean"}, "workplace": S("where the buyer works")}),
    tool("ask_about_project", "Answer a question about one named housing project: possession, RERA, price, amenities", {"project_name": S("project name")}, ["project_name"]),
    tool("check_builder", "Say whether a builder or developer can be trusted: delays, track record", {"builder_name": S("builder name")}, ["builder_name"]),
    tool("compare_projects", "Compare two or more named projects or builders", {"names": {"type": "array", "items": {"type": "string"}}}, ["names"]),
    tool("total_cost", "Total cost of a flat with stamp duty, registration and GST", {"price": N("flat price as written"), "unit": UNIT}, ["price"]),
    tool("loan_emi", "Home loan EMI and cash needed up front", {"price": N("flat price as written"), "unit": UNIT, "loan_percent": N("loan share in percent")}, ["price"]),
]
qs = json.loads((DIR / "questions.json").read_text(encoding="utf-8"))
agent = needle.Needle(tools=TOOLS, system="locale: en-IN", auto_date=False)
out = []
for q in qs:
    agent.reset()
    prompt = " ".join(q["turns"])
    s = time.perf_counter(); r = agent.complete(prompt); ms = (time.perf_counter() - s) * 1000
    calls = r.get("function_calls") or []
    held = r.get("suppressed_calls") or []
    out.append({"id": q["id"], "ms": round(ms, 1), "confidence": r.get("confidence"), "calls": calls, "suppressed": held})
    shown = calls or held
    print(q["id"], round(ms), r.get("confidence"), "HELD" if not calls and held else "", json.dumps([(c["name"], c["arguments"]) for c in shown], ensure_ascii=False), flush=True)
(DIR / "needle2.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
