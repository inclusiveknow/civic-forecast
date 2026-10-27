"""
The life calendar that extends itself: dates that recur by rule, generated for
the next 18 months every time the data is rebuilt (monthly, by the GitHub
Action), so the forecast never runs out of things that are coming.

Every rule here is set in law or by the agency that runs it:
- Federal holidays and their observed days: 5 U.S.C. 6103, OPM.
- Daylight saving time: 15 U.S.C. 260a (2nd Sunday in March, 1st Sunday in November).
- Medicare Open Enrollment (Oct 15 to Dec 7) and Medicare Advantage Open
  Enrollment (Jan 1 to Mar 31): Medicare.gov.
- Federal tax dates: Tax Day, estimated taxes, extensions, W-2s. When a date
  falls on a weekend or legal holiday it moves to the next business day
  (26 U.S.C. 7503), and D.C. Emancipation Day counts as a legal holiday. The
  IRS confirms each year, so these are marked "medium" (expected).

Researched items (data/research/calendar_ballot.json) always win: a generated
item is dropped when a researched one has the same date and category.
"""
from datetime import date, timedelta

OPM = "https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/"
NIST = "https://www.nist.gov/pml/time-and-frequency-division/popular-links/daylight-saving-time-dst"
MEDICARE_OE = "https://www.medicare.gov/basics/get-started-with-medicare/get-more-coverage/joining-a-plan"
MEDICARE_MA = "https://www.medicare.gov/basics/get-started-with-medicare/get-more-coverage/your-coverage-options/compare-original-medicare-medicare-advantage"
IRS_WHEN = "https://www.irs.gov/filing/individuals/when-to-file"
IRS_EST = "https://www.irs.gov/businesses/small-businesses-self-employed/estimated-taxes"
IRS_509 = "https://www.irs.gov/publications/p509"


def nth_weekday(y, m, weekday, n):
    """n-th weekday (Mon=0) of a month; n=-1 for the last."""
    if n > 0:
        d = date(y, m, 1)
        d += timedelta(days=(weekday - d.weekday()) % 7)
        return d + timedelta(weeks=n - 1)
    nxt = date(y + (m == 12), m % 12 + 1, 1)
    d = nxt - timedelta(days=1)
    return d - timedelta(days=(d.weekday() - weekday) % 7)


def observed(d):
    """Federal rule: Saturday holidays are observed Friday, Sunday holidays Monday."""
    if d.weekday() == 5:
        return d - timedelta(days=1)
    if d.weekday() == 6:
        return d + timedelta(days=1)
    return d


def federal_holidays(y):
    fixed = [(date(y, 1, 1), "New Year's Day"), (date(y, 6, 19), "Juneteenth"),
             (date(y, 7, 4), "Independence Day"), (date(y, 11, 11), "Veterans Day"),
             (date(y, 12, 25), "Christmas Day")]
    moving = [(nth_weekday(y, 1, 0, 3), "Martin Luther King Jr. Day"),
              (nth_weekday(y, 2, 0, 3), "Washington's Birthday (Presidents Day)"),
              (nth_weekday(y, 5, 0, -1), "Memorial Day"),
              (nth_weekday(y, 9, 0, 1), "Labor Day"),
              (nth_weekday(y, 10, 0, 2), "Columbus Day"),
              (nth_weekday(y, 11, 3, 4), "Thanksgiving Day")]
    out = []
    for d, name in fixed:
        o = observed(d)
        out.append((o, name if o == d else f"{name} (observed)"))
    return out + moving


def legal_holidays(y):
    """Days that push an IRS deadline: federal holidays plus D.C. Emancipation Day (Apr 16, observed)."""
    days = {d for d, _ in federal_holidays(y)}
    days.add(observed(date(y, 4, 16)))
    return days


def business_day(d):
    while d.weekday() >= 5 or d in legal_holidays(d.year):
        d += timedelta(days=1)
    return d


def item(id_, d, title, text, category, source, confidence="high", end=None):
    return {"id": id_, "date": d.isoformat(), "end": end.isoformat() if end else None, "title": title, "text": text,
            "category": category, "source": source, "confidence": confidence, "note": None, "basis": "rule"}


def generate(start, months=18):
    stop = start + timedelta(days=int(months * 30.5))
    out = []
    for y in range(start.year, stop.year + 1):
        for d, name in federal_holidays(y):
            out.append(item(f"holiday-{d.isoformat()}", d, name,
                            "Federal offices are closed and there's normally no regular mail delivery. Banks and many state and local offices close too.",
                            "holiday", OPM))
        out.append(item(f"dst-start-{y}", nth_weekday(y, 3, 6, 2), "Clocks spring forward one hour",
                        "Daylight saving time starts at 2 a.m., so clocks jump to 3 a.m. and you lose an hour of sleep. Hawaii and most of Arizona don't change.",
                        "clock", NIST))
        out.append(item(f"dst-end-{y}", nth_weekday(y, 11, 6, 1), "Clocks fall back one hour",
                        "Daylight saving time ends at 2 a.m., so clocks go back to 1 a.m. and you get an extra hour. Hawaii and most of Arizona don't change.",
                        "clock", NIST))
        out.append(item(f"medicare-oe-{y}", date(y, 10, 15), "Medicare Open Enrollment",
                        f"If you have Medicare, this is the window to join, drop, or switch Medicare Advantage and drug (Part D) plans for {y + 1}.",
                        "health", MEDICARE_OE, end=date(y, 12, 7)))
        out.append(item(f"medicare-oe-last-{y}", date(y, 12, 7), "Last day to change Medicare plans",
                        f"Medicare Open Enrollment ends today. Changes to your Medicare Advantage or drug plan for {y + 1} have to be in by today.",
                        "health", MEDICARE_OE))
        out.append(item(f"medicare-ma-oe-{y}", date(y, 1, 1), "Medicare Advantage switch window",
                        "If you're in a Medicare Advantage plan, you can switch to a different one or go back to Original Medicare, once, before March 31.",
                        "health", MEDICARE_MA, end=date(y, 3, 31)))
        # taxes (the IRS confirms each year: "expected" dates)
        tax = lambda d: business_day(d)
        out.append(item(f"w2-{y}", tax(date(y, 1, 31)), "Your W-2 should be on its way",
                        "Employers have to send W-2 forms by this date. If yours hasn't shown up by mid-February, ask your employer.",
                        "tax", IRS_509, "medium"))
        out.append(item(f"tax-day-{y}", tax(date(y, 4, 15)), f"Tax Day: {y - 1} returns are due",
                        "Federal income tax returns are due, and so is any tax you owe. If you need more time to file, request an extension by today. An extension gives you more time to file, not to pay.",
                        "tax", IRS_WHEN, "medium"))
        for m, d_, label in [(4, 15, "first"), (6, 15, "second"), (9, 15, "third")]:
            out.append(item(f"est-{y}-{m}", tax(date(y, m, d_)), f"Estimated tax payment due ({label} for {y})",
                            "If you pay quarterly estimated taxes (for example, self-employed or gig income), a payment is due today.",
                            "tax", IRS_EST, "medium"))
        out.append(item(f"est-{y}-q4", tax(date(y, 1, 15)), f"Last estimated tax payment for {y - 1} due",
                        "If you pay quarterly estimated taxes, the fourth payment for last year is due today.",
                        "tax", IRS_EST, "medium"))
        out.append(item(f"extension-{y}", tax(date(y, 10, 15)), "Extended tax returns are due",
                        f"If you got an extension for your {y - 1} return, it's due today.",
                        "tax", IRS_WHEN, "medium"))
    keep = [i for i in out if start.isoformat() <= (i["end"] or i["date"]) and i["date"] <= stop.isoformat()]
    return sorted(keep, key=lambda i: (i["date"], i["id"]))


if __name__ == "__main__":
    import sys
    s = date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else date.today()
    for i in generate(s):
        print(i["date"], (i["end"] or "").ljust(10), i["category"].ljust(8), i["title"])
