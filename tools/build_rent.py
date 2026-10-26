"""
Build public/data/rent.json from Zillow's Observed Rent Index (ZORI).

    python tools/build_rent.py <zip_csv> <county_csv>

Download the two inputs first (Zillow Research, free with attribution):
  https://files.zillowstatic.com/research/public_csvs/zori/Zip_zori_uc_sfrcondomfr_sm_month.csv
  https://files.zillowstatic.com/research/public_csvs/zori/County_zori_uc_sfrcondomfr_sm_month.csv

Output (compact, keyed for the page):
  { "asof": "2026-09", "source": "...",
    "zip":    { "19104": [1650, 3.2], ... },          # typical rent $, change vs a year ago %
    "county": { "42101": [1580, 2.9, "Philadelphia County"], ... },
    "state":  { "pa": [1490, 2.7, 212], ... } }       # median across tracked ZIPs, + ZIP count

Re-run monthly after Zillow publishes (mid-month).
"""
import csv, json, os, re, statistics, sys

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data", "rent.json")


def month_cols(header):
    return [h for h in header if re.fullmatch(r"\d{4}-\d{2}-\d{2}", h)]


def latest_and_yoy(row, months):
    # walk back to the newest month that has a value
    for i in range(len(months) - 1, 11, -1):
        now, ago = row.get(months[i]), row.get(months[i - 12])
        if now and ago:
            n, a = float(now), float(ago)
            if a > 0:
                return months[i][:7], round(n), round((n - a) / a * 100, 1)
    return None, None, None


def main(zip_csv, county_csv):
    out = {"source": "Zillow Observed Rent Index (ZORI), all homes, smoothed", "zip": {}, "county": {}, "state": {}}
    asof = set()
    by_state = {}

    with open(zip_csv, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        months = month_cols(r.fieldnames)
        for row in r:
            m, val, yoy = latest_and_yoy(row, months)
            if val is None:
                continue
            z = row["RegionName"].zfill(5)
            out["zip"][z] = [val, yoy]
            asof.add(m)
            st = (row.get("State") or "").lower()
            if st:
                by_state.setdefault(st, []).append((val, yoy))

    with open(county_csv, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        months = month_cols(r.fieldnames)
        for row in r:
            m, val, yoy = latest_and_yoy(row, months)
            if val is None:
                continue
            fips = row["StateCodeFIPS"].zfill(2) + row["MunicipalCodeFIPS"].zfill(3)
            out["county"][fips] = [val, yoy, row["RegionName"]]
            asof.add(m)

    for st, vals in by_state.items():
        out["state"][st] = [
            round(statistics.median(v for v, _ in vals)),
            round(statistics.median(y for _, y in vals), 1),
            len(vals),
        ]
    every = [x for vals in by_state.values() for x in vals]
    out["us"] = [round(statistics.median(v for v, _ in every)), round(statistics.median(y for _, y in every), 1), len(every)]

    # ZIP prefix -> state (majority), a fallback for when the live ZIP lookup is down
    prefix = {}
    with open(zip_csv, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            st = (row.get("State") or "").lower()
            if st:
                prefix.setdefault(row["RegionName"].zfill(5)[:3], {}).setdefault(st, 0)
                prefix[row["RegionName"].zfill(5)[:3]][st] += 1
    out["zip3"] = {p: max(c, key=c.get) for p, c in prefix.items()}

    out["asof"] = max(asof)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"wrote {os.path.abspath(OUT)}: {len(out['zip'])} ZIPs, {len(out['county'])} counties, "
          f"{len(out['state'])} states, as of {out['asof']}, {os.path.getsize(OUT)//1024} KB")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
