"""Base Needle 3 (no fine-tuning) reading the 20 Day-2 questions into our intent fields."""
import json, os, sys, time
from pathlib import Path

os.environ["NEEDLE_TELEMETRY"] = "0"
os.environ["DO_NOT_TRACK"] = "1"
import needle

DIR = Path(__file__).parent
TOOL = {
    "name": "read_buyer_request",
    "description": "Record what an Indian home buyer asked for, in English, Hindi or Hinglish. Fill only what the buyer said.",
    "parameters": {
        "type": "object",
        "properties": {
            "task": {"type": "string", "enum": ["search", "project_question", "builder_trust", "compare", "total_cost", "emi", "other"],
                     "description": "search = find homes; project_question = about one named project; builder_trust = can I trust a builder; compare = two or more named projects or builders; total_cost = stamp duty, registration, GST, total price; emi = loan or EMI"},
            "bhk": {"type": "integer", "minimum": 1, "maximum": 6, "description": "bedrooms, from '3BHK' or '3 BHK'"},
            "budget_max": {"type": "number", "description": "the buyer's budget ceiling as written"},
            "budget_unit": {"type": "string", "enum": ["crore", "lakh"]},
            "possession": {"type": "string", "enum": ["immediate", "1year", "2year", "3year+"],
                           "description": "immediate = ready to move or within 6 months; 1year = within a year (ek saal)"},
            "location": {"type": "string", "description": "where the buyer wants the home: a city such as Noida or Greater Noida West, or a sector"},
            "near_metro": {"type": "boolean", "description": "true when the buyer wants to be near a metro station"},
            "workplace": {"type": "string", "description": "where the buyer works (office), not where they want to live"},
            "project_names": {"type": "array", "items": {"type": "string"}, "description": "named housing projects"},
            "builder_name": {"type": "string", "description": "a named builder or developer"},
            "property_price": {"type": "number", "description": "price of a specific flat for a cost or EMI calculation"},
            "price_unit": {"type": "string", "enum": ["crore", "lakh"]},
            "loan_percent": {"type": "number", "description": "share of the price taken as a loan, in percent"},
        },
        "required": ["task"],
    },
}


def main():
    qs = json.loads((DIR / "questions.json").read_text(encoding="utf-8"))
    t0 = time.perf_counter()
    agent = needle.Needle(tools=[TOOL], system="locale: en-IN", auto_date=False)
    load_s = time.perf_counter() - t0
    out = []
    for q in qs:
        args, turns = {}, []
        for text in q["turns"]:
            agent.reset()
            # A follow-up carries the earlier turn, the way our router carries previous intent.
            prompt = text if not turns else " ".join(t["text"] for t in turns) + " " + text
            s = time.perf_counter()
            r = agent.complete(prompt)
            ms = (time.perf_counter() - s) * 1000
            calls = r.get("function_calls") or r.get("suppressed_calls") or []
            got = calls[0]["arguments"] if calls else {}
            args.update(got)
            turns.append({"text": text, "ms": round(ms, 1), "confidence": r.get("confidence"),
                          "suppressed": not r.get("function_calls") and bool(r.get("suppressed_calls")),
                          "args": got, "reasoning": r.get("reasoning")})
        out.append({"id": q["id"], "turns": turns, "args": args})
        print(q["id"], round(turns[-1]["ms"]), turns[-1]["confidence"], json.dumps(args, ensure_ascii=False), flush=True)
    (DIR / "needle.json").write_text(json.dumps({"load_s": load_s, "rows": out}, indent=1, ensure_ascii=False), encoding="utf-8")
    print("load_s", round(load_s, 2))


if __name__ == "__main__":
    main()
