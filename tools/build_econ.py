"""
Build public/data/econ.json from the Bureau of Labor Statistics public API (v1, no key).

    python tools/build_econ.py

- Unemployment rate, seasonally adjusted, for every state + D.C. + the U.S.
  (Local Area Unemployment Statistics; Current Population Survey for the U.S.)
- Price change vs a year ago for groceries (food at home), gasoline and
  electricity, by Census region + U.S. (CPI-U, not seasonally adjusted, so the
  year-over-year comparison is like-for-like).

The v1 API allows 25 series per request and 25 requests a day per IP, so this
makes 4 requests. Re-run monthly after BLS releases (CPI mid-month, state jobs
~3rd week). The Worker can run the same logic on a cron.
"""
import json, os, urllib.request
from datetime import date

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data", "econ.json")
API = "https://api.bls.gov/publicAPI/v1/timeseries/data/"

FIPS = {
    "al": "01", "ak": "02", "az": "04", "ar": "05", "ca": "06", "co": "08", "ct": "09", "de": "10",
    "dc": "11", "fl": "12", "ga": "13", "hi": "15", "id": "16", "il": "17", "in": "18", "ia": "19",
    "ks": "20", "ky": "21", "la": "22", "me": "23", "md": "24", "ma": "25", "mi": "26", "mn": "27",
    "ms": "28", "mo": "29", "mt": "30", "ne": "31", "nv": "32", "nh": "33", "nj": "34", "nm": "35",
    "ny": "36", "nc": "37", "nd": "38", "oh": "39", "ok": "40", "or": "41", "pa": "42", "ri": "44",
    "sc": "45", "sd": "46", "tn": "47", "tx": "48", "ut": "49", "vt": "50", "va": "51", "wa": "53",
    "wv": "54", "wi": "55", "wy": "56",
}
REGIONS = {"us": "0000", "northeast": "0100", "midwest": "0200", "south": "0300", "west": "0400"}
ITEMS = {"groceries": "SAF11", "gas": "SETB01", "electricity": "SEHF01"}


def fetch(series):
    year = date.today().year
    payload = {"seriesid": series, "startyear": str(year - 2), "endyear": str(year)}
    url = API
    # optional free key (bls.gov/developers): higher daily limit, useful on shared CI runners
    if os.environ.get("BLS_KEY"):
        url = API.replace("/v1/", "/v2/")
        payload["registrationkey"] = os.environ["BLS_KEY"]
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        d = json.load(r)
    if d.get("status") != "REQUEST_SUCCEEDED":
        raise SystemExit(f"BLS error: {d.get('status')} {d.get('message')}")
    return {s["seriesID"]: s["data"] for s in d["Results"]["series"]}


def monthly(data):
    """[(year, period, periodName, value)] newest first, monthly periods only."""
    return [(int(p["year"]), p["period"], p["periodName"], float(p["value"]))
            for p in data if p["period"].startswith("M") and p["period"] != "M13" and p["value"] not in ("-", "")]


def latest_and_year_ago(data):
    pts = monthly(data)
    if not pts:
        return None
    y, per, name, val = pts[0]
    ago = next((v for (yy, pp, _, v) in pts if yy == y - 1 and pp == per), None)
    return {"value": val, "yearAgo": ago, "month": f"{name} {y}"}


def main():
    out = {"source": "U.S. Bureau of Labor Statistics", "jobs": {}, "prices": {}}

    # unemployment: 51 state series + U.S. -> 3 requests of <= 25
    state_ids = {f"LASST{fips}0000000000003": st for st, fips in FIPS.items()}
    ids = list(state_ids) + ["LNS14000000"]
    for i in range(0, len(ids), 25):
        for sid, data in fetch(ids[i:i + 25]).items():
            r = latest_and_year_ago(data)
            if r:
                out["jobs"][state_ids.get(sid, "us")] = r

    # prices: 5 regions x 3 items = 15 series -> 1 request
    price_ids = {f"CUUR{code}{item}": (reg, name) for reg, code in REGIONS.items() for name, item in ITEMS.items()}
    for sid, data in fetch(list(price_ids)).items():
        reg, name = price_ids[sid]
        r = latest_and_year_ago(data)
        if r and r["yearAgo"]:
            out["prices"].setdefault(reg, {})[name] = {
                "change": round((r["value"] - r["yearAgo"]) / r["yearAgo"] * 100, 1),
                "month": r["month"],
            }

    out["jobsMonth"] = out["jobs"].get("us", {}).get("month")
    out["pricesMonth"] = out["prices"].get("us", {}).get("groceries", {}).get("month")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1)
    print(f"wrote {os.path.abspath(OUT)}: jobs for {len(out['jobs'])} places ({out['jobsMonth']}), "
          f"prices for {len(out['prices'])} regions ({out['pricesMonth']})")


if __name__ == "__main__":
    main()
