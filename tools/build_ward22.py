#!/usr/bin/env python3
"""
Build Ward 22 (Kathmandu) field-survey data for the campaign dashboard.

Inputs
  building_w22.zip (or folder)   building footprints, UTM 45N, survey fields already joined
  Ward-22_Final_Verification_*.xls   sheets Verif_Foam, SocioHousehold, FamilyHH
    (legacy .xls: convert once with `soffice --headless --convert-to xlsx file.xls`
     and pass the .xlsx, or `pip install xlrd` and pass the .xls)

Output
  data/bld/7123.json   Ward 22 buildings in the dashboard's compact format:
                       [lon*1e6, lat*1e6, [dx,dy,...], name, {survey attributes}]
  The original Galli footprints are kept in data/bld_original/7123.json.
  Re-run tools/add_counts.py afterwards so hier.json has the new building count.

Privacy: owner names, respondent names, surveyor names, phone numbers and
per-household health answers are never written. Only counts and categories.
Usage:  py tools/build_ward22.py <building_w22.zip|folder> <survey.xlsx|xls> [data_dir]
"""
import json, math, os, re, shutil, struct, sys, zipfile, collections
import pandas as pd

WARD_ID = 7123   # dashboard ward id of Kathmandu Metropolitan City ward 22 (data/hier.json)

# ---------- UTM zone 45N (WGS84) -> lon/lat, no external deps ----------
def utm45n_to_lonlat(E, N):
    a = 6378137.0; f = 1 / 298.257223563; k0 = 0.9996
    n = f / (2 - f); lon0 = math.radians(87.0)
    A = a / (1 + n) * (1 + n**2 / 4 + n**4 / 64)
    b = [n/2 - 2*n**2/3 + 37*n**3/96, n**2/48 + n**3/15, 17*n**3/480]
    d = [2*n - 2*n**2/3 - 2*n**3, 7*n**2/3 - 8*n**3/5, 56*n**3/15]
    xi = N / (k0 * A); eta = (E - 500000.0) / (k0 * A)
    xi_p = xi - sum(b[j] * math.sin(2*(j+1)*xi) * math.cosh(2*(j+1)*eta) for j in range(3))
    eta_p = eta - sum(b[j] * math.cos(2*(j+1)*xi) * math.sinh(2*(j+1)*eta) for j in range(3))
    chi = math.asin(math.sin(xi_p) / math.cosh(eta_p))
    lat = chi + sum(d[j] * math.sin(2*(j+1)*chi) for j in range(3))
    lon = lon0 + math.atan2(math.sinh(eta_p), math.cos(xi_p))
    return math.degrees(lon), math.degrees(lat)

# ---------- minimal shapefile + dbf readers ----------
def read_shp_polys(path):
    data = open(path, "rb").read()
    pos = 100; out = []
    while pos < len(data):
        _, clen = struct.unpack(">ii", data[pos:pos+8]); pos += 8
        body = data[pos:pos+clen*2]; pos += clen*2
        st = struct.unpack("<i", body[:4])[0]
        if st == 0: out.append(None); continue
        nparts, npts = struct.unpack("<ii", body[36:44])
        parts = list(struct.unpack("<%di" % nparts, body[44:44+4*nparts]))
        pts = struct.unpack("<%dd" % (2*npts), body[44+4*nparts:44+4*nparts+16*npts])
        pts = [(pts[2*i], pts[2*i+1]) for i in range(npts)]
        end = parts[1] if nparts > 1 else npts
        out.append(pts[parts[0]:end])          # outer ring only
    return out

def read_dbf(path):
    f = open(path, "rb"); h = f.read(32)
    n = struct.unpack("<I", h[4:8])[0]; hl, rl = struct.unpack("<HH", h[8:12])
    fields = []
    while True:
        d = f.read(32)
        if d[0] == 0x0D: break
        fields.append((d[:11].split(b"\0")[0].decode(), d[16]))
    f.seek(hl); rows = []
    for _ in range(n):
        r = f.read(rl); o = 1; row = {}
        for nm, ln in fields:
            row[nm] = r[o:o+ln].decode("utf8", "ignore").strip(); o += ln
        rows.append(row)
    return rows

# ---------- helpers ----------
def num(v):
    """'M3'->3, 'A0'->0, 'F'->None, '12'->12, ''->None"""
    if v is None or (isinstance(v, float) and math.isnan(v)): return None
    m = re.search(r"\d+(\.\d+)?", str(v))
    return int(float(m.group())) if m else None

def clean(v):
    if v is None or (isinstance(v, float) and math.isnan(v)): return None
    v = re.sub(r"\s+", " ", str(v)).strip()
    return v or None

def yn(v):
    v = (clean(v) or "").lower()
    return True if v == "yes" else False if v == "no" else None

def main():
    src, xls = sys.argv[1], sys.argv[2]
    data = sys.argv[3] if len(sys.argv) > 3 else "data"
    if src.lower().endswith(".zip"):
        zipfile.ZipFile(src).extractall("_tmp_w22"); src = "_tmp_w22"
    shp = [os.path.join(r, f) for r, _, fs in os.walk(src) for f in fs if f.endswith(".shp")][0]
    polys = read_shp_polys(shp); recs = read_dbf(shp[:-4] + ".dbf")
    assert len(polys) == len(recs), "shp/dbf mismatch"
    fam = pd.ExcelFile(xls).parse("FamilyHH", dtype=str)

    by_link = collections.defaultdict(lambda: dict(fam=0, m=0, f=0, o=0, abroad=0))
    for _, r in fam.iterrows():
        b = by_link[clean(r.get("HH_LINK"))]; b["fam"] += 1
        b["m"] += num(r.get("MALEPOPU10")) or 0; b["f"] += num(r.get("FEMALPOP11")) or 0
        b["o"] += num(r.get("OTHERPOP12")) or 0
        if (clean(r.get("PLACESTAY9")) or "").startswith("Outside Country"): b["abroad"] += 1

    PRB = (("parking","PROBPARK22"),("sewer","PROSEWDR22"),("light","PROLIGHT22"),("noise","PRONOISE22"),
           ("water","PROWATER22"),("road","PROBROAD22"),("none","PROBWARD22"),("other","PRBOTHER22"))  # PROBWARD22 = "no problem"
    out, seen = [], collections.Counter(); matched = set()
    for i, (ring, r) in enumerate(zip(polys, recs)):
        if not ring: continue
        pts = [tuple(round(c * 1e6) for c in utm45n_to_lonlat(x, y)) for x, y in ring]
        if pts[0] == pts[-1]: pts = pts[:-1]
        x0, y0 = pts[0]; d = []
        for x, y in pts[1:]: d += [x - x0, y - y0]
        link = clean(r.get("HH_LINK")) or f"W22-{i+1}"
        seen[link] += 1; uid = link if seen[link] == 1 else f"{link}#{seen[link]}"
        fm = by_link.get(clean(r.get("HH_LINK"))); matched.add(clean(r.get("HH_LINK")))
        sv = bool(clean(r.get("RESPONAME6")))
        a = {"id": uid, "road": clean(r.get("ROAD_CODE")), "no": clean(r.get("HOUSE_NO")),
             "bt": clean(r.get("BUILD_TYPE")), "st": clean(r.get("STRUC_TYPE")), "use": clean(r.get("FUNCTI_USE")),
             "sub": clean(r.get("SUBCATEGOR")), "fl": num(r.get("FLOOR")), "sh": num(r.get("SHUTTERSNO")),
             "dr": yn(r.get("DRAIN")), "ra": yn(r.get("ROADACCESS")), "sv": 1 if sv else None}
        if sv:
            a.update(rent=yn(r.get("RENTAHOU13")), veh=yn(r.get("OWNVEHIC17")), cctv=yn(r.get("CCCAMERA19")),
                     sat=clean(r.get("SATISFAC21")), pr=[k for k, c in PRB if num(r.get(c)) == 1])
        if fm: a.update(fam=fm["fam"], ppl=fm["m"]+fm["f"]+fm["o"], m=fm["m"], f=fm["f"], o=fm["o"], ab=fm["abroad"])
        a = {k: (int(v) if isinstance(v, bool) else v) for k, v in a.items() if v is not None and v != []}
        out.append([x0, y0, d, clean(r.get("DESIG_NAME")) or "", a])

    fp = os.path.join(data, "bld", f"{WARD_ID}.json"); bak = os.path.join(data, "bld_original", f"{WARD_ID}.json")
    if os.path.exists(fp) and not os.path.exists(bak):
        os.makedirs(os.path.dirname(bak), exist_ok=True); shutil.copy(fp, bak)
    json.dump(out, open(fp, "w", encoding="utf-8"), separators=(",", ":"), ensure_ascii=False)
    print("buildings", len(out), "| with survey", sum(1 for o in out if o[4].get("sv")),
          "| with family data", sum(1 for o in out if "fam" in o[4]))
    print("family rows not matched to a building:", sum(v["fam"] for k, v in by_link.items() if k not in matched))

if __name__ == "__main__":
    main()
