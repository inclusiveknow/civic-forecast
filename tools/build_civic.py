"""
Merge the researched civic data into public/data/civic.json (the one file the page loads).

    python tools/build_civic.py [path/to/same-question/data/races.json]

Inputs (written by research passes, one file per batch of states):
  data/research/voting_*.json      official voting rules per state (+ D.C.)
  data/research/calendar_ballot.json   national civic calendar + which races are on each ballot
  same-question races.json (optional) races with real debate answers, linked from the page

Validation is strict on purpose: a malformed date or a window that ends before it
starts would put a wrong deadline in front of a voter, so the build stops instead.
Warnings (things a person should eyeball) print but don't stop the build.
"""
import glob, json, os, re, sys
from datetime import date

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "public", "data", "civic.json")
ELECTION = "2026-11-03"
SQ_BASE = "https://same-question.spokenknowledge.workers.dev/race.html?r="
ALL = set("al ak az ar ca co ct de dc fl ga hi id il in ia ks ky la me md ma mi mn ms mo mt ne nv nh "
          "nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy".split())

errors, warnings = [], []


def iso(v, where, allow_null=True):
    if v is None:
        if not allow_null:
            errors.append(f"{where}: missing date")
        return None
    if not isinstance(v, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
        errors.append(f"{where}: bad date {v!r}")
        return None
    try:
        d = date.fromisoformat(v)
    except ValueError:
        errors.append(f"{where}: impossible date {v!r}")
        return None
    if not (date(2026, 1, 1) <= d <= date(2027, 3, 31)):
        warnings.append(f"{where}: date {v} is outside the expected window")
    return v


def url(v, where):
    if not isinstance(v, str) or not v.startswith("https://"):
        errors.append(f"{where}: not an https URL: {v!r}")
        return False
    host = re.sub(r"^https://([^/]+).*$", r"\1", v).lower()
    if not (host.endswith(".gov") or host.endswith(".us") or host.endswith(".org") or ".gov." in host):
        warnings.append(f"{where}: non-.gov host {host} (check it's the official office)")
    return True


def check_state(code, s):
    w = code
    for k in ("name", "pollHours", "allMail", "early", "mail", "registration", "pollingPlaceUrl", "official", "sources"):
        if k not in s:
            errors.append(f"{w}: missing {k}")
    e, m, r = s.get("early") or {}, s.get("mail") or {}, s.get("registration") or {}
    st, en = iso(e.get("start"), f"{w}.early.start"), iso(e.get("end"), f"{w}.early.end")
    if st and en and st > en:
        errors.append(f"{w}: early voting starts {st} after it ends {en}")
    if en and en > ELECTION:
        errors.append(f"{w}: early voting ends {en}, after Election Day")
    if e.get("available") and not en:
        warnings.append(f"{w}: early voting available but no statewide end date")
    if m.get("returnRule") not in ("received", "postmarked"):
        errors.append(f"{w}: mail.returnRule must be received|postmarked, got {m.get('returnRule')!r}")
    rb = iso(m.get("receivedBy"), f"{w}.mail.receivedBy", allow_null=False)
    pb = iso(m.get("postmarkBy"), f"{w}.mail.postmarkBy")
    if m.get("returnRule") == "received" and rb and rb != ELECTION:
        warnings.append(f"{w}: ballots must be received by {rb}, not Election Day (confirm)")
    if m.get("returnRule") == "postmarked" and rb and rb < ELECTION:
        errors.append(f"{w}: postmarked ballots due {rb}, before Election Day")
    if pb and pb > ELECTION:
        warnings.append(f"{w}: postmark deadline {pb} after Election Day (confirm)")
    iso(r.get("deadline"), f"{w}.registration.deadline")
    if not isinstance(r.get("sameDay"), bool):
        errors.append(f"{w}: registration.sameDay must be true/false")
    url(s.get("pollingPlaceUrl"), f"{w}.pollingPlaceUrl")
    url(s.get("official"), f"{w}.official")
    if s.get("confidence") not in ("high", "medium"):
        warnings.append(f"{w}: confidence is {s.get('confidence')!r}")
    for t in ("early", "mail", "registration"):
        txt = (s.get(t) or {}).get("text") or ""
        if "—" in txt:
            (s[t]).update(text=txt.replace(" — ", ". ").replace("—", ", "))  # house style: no em dashes


def main(sq_races):
    voting, checked = {}, []
    for f in sorted(glob.glob(os.path.join(ROOT, "data", "research", "voting_*.json"))):
        with open(f, encoding="utf-8") as fh:
            d = json.load(fh)
        checked.append(d.get("checked"))
        for code, s in d["states"].items():
            code = code.lower()
            if code in voting:
                errors.append(f"{code}: appears in more than one research file")
            check_state(code, s)
            s["checked"] = s.get("checked") or d.get("checked")
            voting[code] = s
    missing = sorted(ALL - set(voting))
    if missing:
        warnings.append(f"no voting data yet for: {', '.join(missing)}")

    cal, ballot = [], {}
    cb = os.path.join(ROOT, "data", "research", "calendar_ballot.json")
    if os.path.exists(cb):
        with open(cb, encoding="utf-8") as fh:
            d = json.load(fh)
        for i, c in enumerate(d.get("calendar", [])):
            iso(c.get("date"), f"calendar[{c.get('id', i)}].date", allow_null=False)
            iso(c.get("end"), f"calendar[{c.get('id', i)}].end")
            url(c.get("source"), f"calendar[{c.get('id', i)}].source")
            cal.append(c)
        ballot = d.get("ballot", {})
        n_sen = len(ballot.get("senate", {}).get("regular", [])) + len(ballot.get("senate", {}).get("special", []))
        n_gov = len(ballot.get("governor", {}).get("states", []))
        if n_sen != 35 or n_gov != 36:
            warnings.append(f"ballot lists: {n_sen} Senate races, {n_gov} governor races (expected 35 / 36)")
    else:
        warnings.append("no calendar/ballot research yet")

    races = []
    if sq_races and os.path.exists(sq_races):
        with open(sq_races, encoding="utf-8") as fh:
            for r in json.load(fh):
                if r.get("status") == "live":
                    races.append({"state": r["id"][:2], "office": r["office"], "candidates": r["candidates"],
                                  "note": r.get("note"), "url": SQ_BASE + r["id"]})

    for w in warnings:
        print("WARN ", w)
    for e in errors:
        print("ERROR", e)
    if errors:
        raise SystemExit(f"\n{len(errors)} error(s); civic.json NOT written.")

    out = {"election": ELECTION, "checked": max(c for c in checked if c) if checked else None,
           "voting": dict(sorted(voting.items())), "calendar": sorted(cal, key=lambda c: c["date"]),
           "ballot": ballot, "races": races}
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"\nwrote {os.path.abspath(OUT)}: {len(voting)} states, {len(cal)} calendar items, "
          f"{len(races)} Same Question races, {os.path.getsize(OUT)//1024} KB")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
