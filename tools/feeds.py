"""
Subscribable calendar feeds: public/cal/<state>.ics and public/cal/us.ics.

Someone subscribes once (webcal://.../cal/pa.ics) and their phone's calendar
keeps pulling new civic dates for years: deadlines in this election, the next
elections, enrollment windows, tax dates, the clocks. Rebuilt with the rest
of the data, so the feeds extend themselves. UIDs are stable across rebuilds,
so updates replace events instead of duplicating them.
"""
import os, re
from datetime import date, datetime, timedelta, timezone

SITE = "https://civic-forecast.pages.dev"
LIFE = {"health", "tax", "clock", "benefits", "money"}  # holidays are already in every phone calendar


def esc(s):
    return str(s or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\r\n", "\\n").replace("\n", "\\n")


def fold(line):
    out, s = [], line
    while len(s.encode("utf-8")) > 74:
        cut = 74
        while len(s[:cut].encode("utf-8")) > 74:
            cut -= 1
        out.append(s[:cut])
        s = " " + s[cut:]
    out.append(s)
    return "\r\n".join(out)


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:48]


def vevent(uid, d, title, text, url=None, alarm=True):
    nxt = (date.fromisoformat(d) + timedelta(days=1)).isoformat().replace("-", "")
    lines = ["BEGIN:VEVENT", f"UID:{uid}@civic-forecast.pages.dev", f"DTSTAMP:{STAMP}",
             f"DTSTART;VALUE=DATE:{d.replace('-', '')}", f"DTEND;VALUE=DATE:{nxt}",
             f"SUMMARY:{esc(title)}",
             f"DESCRIPTION:{esc(chr(10).join(x for x in [text, ('More: ' + url) if url else '', 'From The Civic Forecast: ' + SITE] if x))}",
             "TRANSP:TRANSPARENT"]
    if url:
        lines.append(f"URL:{url}")
    if alarm:
        lines += ["BEGIN:VALARM", "ACTION:DISPLAY", f"DESCRIPTION:{esc(title)}", "TRIGGER:-PT15H", "END:VALARM"]
    lines.append("END:VEVENT")
    return lines


def calendar(name, desc, events):
    head = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Accelerant//The Civic Forecast//EN", "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH", f"X-WR-CALNAME:{esc(name)}", f"X-WR-CALDESC:{esc(desc)}",
            "REFRESH-INTERVAL;VALUE=DURATION:P1D", "X-PUBLISHED-TTL:P1D"]
    body = [l for e in sorted(events, key=lambda e: e[0]) for l in e[1]]
    return "\r\n".join(fold(l) for l in head + body + ["END:VCALENDAR"]) + "\r\n"


def life_events(cal, today, prefix):
    ev = []
    explicit = {(c["date"], c["category"]) for c in cal}
    for c in cal:
        if c["category"] not in LIFE:
            continue
        if c["date"] >= today:
            ev.append((c["date"], vevent(f"{prefix}-{c['id']}", c["date"], c["title"], c["text"], c.get("source"),
                                         alarm=c["category"] != "clock")))
        if c.get("end") and c["end"] >= today and (c["end"], c["category"]) not in explicit:
            ev.append((c["end"], vevent(f"{prefix}-{c['id']}-last", c["end"], f"Last day: {c['title']}", c["text"], c.get("source"))))
    return ev


def state_events(code, v, nxt, pres, today, election, name):
    ev = []
    add = lambda d, uid, title, text, url=None, alarm=True: d and d >= today and ev.append(
        (d, vevent(f"{code}-{uid}", d, title, text, url, alarm)))
    e, m, r = v.get("early") or {}, v.get("mail") or {}, v.get("registration") or {}
    add(r.get("deadline"), "2026-register", f"Last day to register to vote ({name})", r.get("text"), v.get("pollingPlaceUrl"))
    if e.get("available") and not v.get("allMail"):
        add(e.get("start"), "2026-early-open", f"Early voting opens ({name})", e.get("text"), v.get("pollingPlaceUrl"), alarm=False)
        last = "Last day to vote at the election office" if "office" in (e.get("kind") or "") else "Last day of early voting"
        add(e.get("end"), "2026-early-last", f"{last} ({name})", e.get("text"), v.get("pollingPlaceUrl"))
    if m.get("receivedBy") and m["receivedBy"] != election:
        add(m["receivedBy"], "2026-mail-due", f"Last day mailed ballots can arrive ({name})", m.get("text"), v.get("official"))
    add(election, "2026-election", f"Election Day ({name})", f"Polls are open {v.get('pollHours')}", v.get("pollingPlaceUrl"))
    for x in nxt or []:
        if not x.get("date"):
            continue
        tag = f"{x['date']}-{slug(x['title'])}"
        title = f"{x['title']} ({name})" + (" · if needed" if x.get("ifNeeded") else "")
        add(x["date"], f"next-{tag}", title, x.get("what"), x.get("source"))
        add(x.get("registrationDeadline"), f"next-{tag}-register", f"Register by today for the {x['title'].lower()} ({name})",
            x.get("what"), x.get("source"))
    if pres and pres.get("date"):
        add(pres["date"], "2028-presidential-primary", f"2028 presidential primary ({name})", pres.get("text"), pres.get("source"))
    return ev


def build(out_dir, civic, names, today=None):
    global STAMP
    STAMP = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    today = today or date.today().isoformat()
    os.makedirs(out_dir, exist_ok=True)
    cal, election = civic["calendar"], civic["election"]
    counts = {}
    for code, v in civic["voting"].items():
        name = names.get(code, code.upper())
        events = state_events(code, v, civic.get("next", {}).get(code), civic.get("presPrimary", {}).get(code), today, election, name)
        events += life_events(cal, today, code)
        with open(os.path.join(out_dir, f"{code}.ics"), "w", encoding="utf-8", newline="") as f:
            f.write(calendar(f"Civic Forecast · {name}",
                             f"Voting dates for {name}, the next elections, and the dates that touch most households. Updates on its own.",
                             events))
        counts[code] = len(events)
    us = life_events(cal, today, "us")
    if election >= today:
        us.append((election, vevent("us-2026-election", election, "Election Day", "General election across the country.", SITE)))
    with open(os.path.join(out_dir, "us.ics"), "w", encoding="utf-8", newline="") as f:
        f.write(calendar("Civic Forecast", "Dates that touch most households: health enrollment, taxes, the clocks, Election Day. Updates on its own.", us))
    return counts, len(us)
