"""Final voter roll 2083 (Election Commission notice 'अन्तिम मतदाता नामावली बमोजिम मतदाता संख्या', published 2083-06-30)
-> data/roll83.json, joined to the dashboard's municipalities.

    py tools/build_roll83.py <roll.pdf> [out=data/roll83.json]

The PDF (54 pages) holds province, district and local-level tables: male, female, other, total voters and polling places.
Its Nepali text uses a font that pdfplumber cannot decode (names come out as (cid:NNN)), so names are not read. Rows are joined by
order: districts are found by adding up local-level totals until they equal each district total, then the local levels of each
district are matched to the dashboard's municipalities (data/elections.json) by closeness of the 2022 voter count.
Needs: pip install pdfplumber"""
import re, sys, json, itertools, math
import pdfplumber

src = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else 'data/roll83.json'
num = re.compile(r'^\d{1,3}(?:,\d{2})*(?:,\d{3})?$|^\d+$')
def n(x): return int(x.replace(',', ''))
DEV = str.maketrans('०१२३४५६७८९', '0123456789')

pdf = pdfplumber.open(src)
prov, dist, loc = [], [], []
for pi, pg in enumerate(pdf.pages):
    for line in (pg.extract_text() or '').split('\n'):
        t = line.split()
        tail = []
        for x in reversed(t):
            if num.match(x): tail.append(x)
            else: break
        if len(tail) < 5: continue
        v = [n(x) for x in reversed(tail[:5])]          # male, female, other, total, polling places
        if abs(v[0] + v[1] + v[2] - v[3]) > 2: continue
        first = t[0].translate(DEV)
        row = {'m': v[0], 'f': v[1], 'o': v[2], 't': v[3], 'p': v[4], 'page': pi + 1}
        if pi == 0 and first.isdigit(): prov.append(row)
        elif first.isdigit() and t[0].translate(DEV) != t[0]: loc.append(row)   # serial written in Devanagari digits
        elif first.isdigit() and pi <= 3: dist.append(row)
tot = {'m': 9769825, 'f': 9321336, 'o': 214, 't': 19091375, 'p': 10967}
print(len(prov), 'provinces,', len(dist), 'districts,', len(loc), 'local levels; sum', sum(r['t'] for r in loc))
assert len(prov) == 7 and len(dist) == 77 and len(loc) == 753, 'unexpected table sizes'
assert sum(r['t'] for r in loc) == tot['t'], 'local levels do not add up to the national total'

# group local levels into districts by running totals
groups, i = [], 0
for d in dist:
    s, g = 0, []
    while s < d['t'] and i < len(loc):
        g.append(loc[i]); s += loc[i]['t']; i += 1
    assert s == d['t'], 'district total does not match its local levels'
    groups.append(g)
assert i == 753

H = json.load(open('data/hier.json', encoding='utf8')); E = json.load(open('data/elections.json', encoding='utf8'))
mun_by_dist = {}   # district code -> [(municipality id, Census 2021 adults, 2022 registered voters or 0)]
for m in H['mun']:
    r = E['mun'].get(str(m['id']))
    if r: mun_by_dist.setdefault(m['d'], []).append((m['id'], (r.get('cen') or [0] * 5)[4] or 1, (r.get('v22') or [0])[0] or 0))
pdist = []   # province code of each pdf district
k = 0
for pi, p in enumerate(prov):
    s = 0
    while s < p['t']: s += dist[k]['t']; pdist.append(pi + 1); k += 1
    assert s == p['t']
dprov = {d['c']: d['p'] for d in H['dist']}

def ref(ms, scale):
    """Expected 2083 voters of each municipality: Census adults, blended with the 2022 voter count where it exists."""
    out = []
    for _, a, v in ms:
        e = a * scale
        out.append(math.exp((math.log(e) + math.log(v)) / 2) if v else e)
    return out

# A pdf district is identified by the sorted sizes of its local levels (totals alone are ambiguous between similar districts)
cost = {}
for a, g in enumerate(groups):
    gt = sorted(r['t'] for r in g)
    for dc, ms in mun_by_dist.items():
        if dprov[dc] != pdist[a] or len(ms) != len(g): continue
        scale = sum(gt) / sum(x[1] for x in ms)
        rf = sorted(ref(ms, scale))
        cost[(a, dc)] = sum(abs(math.log(x / y)) for x, y in zip(gt, rf)) / len(gt)
amap, used = {}, set()
for (a, dc), c in sorted(cost.items(), key=lambda kv: kv[1]):
    if a in amap or dc in used: continue
    amap[a] = dc; used.add(dc)
assert len(amap) == 77, f'{77 - len(amap)} districts could not be matched'

mun = {}
for a, g in enumerate(groups):
    ms = mun_by_dist[amap[a]]
    scale = sum(r['t'] for r in g) / sum(x[1] for x in ms)
    rf = ref(ms, scale)
    gi = sorted(range(len(g)), key=lambda i: g[i]['t']); mi = sorted(range(len(ms)), key=lambda i: rf[i])
    for x, y in zip(mi, gi):
        r = g[y]; mun[str(ms[x][0])] = [r['m'], r['f'], r['o'], r['t'], r['p']]
doc = {'date': '2083-06-30', 'asof': '2083-05-15', 'nat': tot,
       'prov': {str(i + 1): [p['m'], p['f'], p['o'], p['t'], p['p']] for i, p in enumerate(prov)},
       'dist': {str(amap[a]): [dist[a]['m'], dist[a]['f'], dist[a]['o'], dist[a]['t'], dist[a]['p']] for a in range(77)},
       'mun': mun}
json.dump(doc, open(out, 'w', encoding='utf8'), separators=(',', ':'))
print(len(mun), 'local levels joined; worst district cost', round(max(cost[(a, amap[a])] for a in amap), 3))
bad = [k for k, v in mun.items() if (lambda r: r and (v[3] / r < .6 or v[3] / r > 1.7))((E['mun'][k].get('v22') or [0])[0])]
print(len(bad), 'local levels differ from their 2022 voter count by more than -40% / +70%')
