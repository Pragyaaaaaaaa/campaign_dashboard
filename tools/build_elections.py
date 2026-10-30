"""Builds data/elections.json from the Nepal Local Election Atlas page (its embedded <script id="data"> JSON)
and joins it to the dashboard's municipalities (data/hier.json).

    py tools/build_elections.py <atlas.html> [out=data/elections.json]

Join: district name -> municipality name (spelling-tolerant) -> ward count / Census population as tie-breakers,
then a second pass on identical 2021 population for municipalities renamed between the two sources.
Parks, reserves and Kalapani have no election data and stay unmatched."""
import re, json, sys, difflib, collections

src = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else 'data/elections.json'
s = open(src, encoding='utf8').read()
A = json.loads(re.search(r'<script type="application/json" id="data">(.*?)</script>', s, re.S).group(1))
H = json.load(open('data/hier.json', encoding='utf8'))
dn = {x['c']: x['n'] for x in H['dist']}

def nd(x):
    x = x.lower().replace('makwanpur', 'makawanpur').replace('tanahun', 'tanahu')
    return re.sub(r'[^a-z]', '', x)
def nm(x):
    x = re.sub(r'(?<=[a-z])h', '', x.lower())
    x = x.replace('w', 'v').replace('sh', 's').replace('z', 'j').replace('aa', 'a').replace('ee', 'i').replace('oo', 'u').replace('ii', 'i').replace('uu', 'u')
    return re.sub(r'[^a-z]', '', re.sub(r'(.)\1+', r'\1', x))

adist = [nd(x[0]) for x in A['districts']]
byd = collections.defaultdict(list)
for l in A['lls']: byd[adist[l['d']]].append(l)

pairs = []
for m in H['mun']:
    for l in byd[nd(dn[m['d']])]:
        sim = difflib.SequenceMatcher(None, nm(m['n']), nm(l['n'])).ratio()
        pp = abs(m['t'] - l['cen'][0]) / max(m['t'], 1)
        pairs.append((sim - .15 * min(abs(len(m['w']) - l['w']), 4) - .5 * min(pp, 1), m['id'], l['c'], sim, pp))
pairs.sort(reverse=True)
mm, ul = {}, set()
for sc, mid, lc, sim, pp in pairs:
    if mid in mm or lc in ul or sc < .3 or (sim < .55 and pp >= .02): continue
    mm[mid] = lc; ul.add(lc)
for m in H['mun']:   # pass 2: identical census population inside the same district = renamed municipality
    if m['id'] in mm or m['ty'] not in ('Rural Municipality', 'Municipality'): continue
    c = [l for l in byd[nd(dn[m['d']])] if l['c'] not in ul and l['cen'][0] == m['t']]
    if len(c) == 1: mm[m['id']] = c[0]['c']; ul.add(c[0]['c'])
L = {l['c']: l for l in A['lls']}
drop = {'pyr', 'src22', 'np'}
mun = {str(i): {k: v for k, v in L[c].items() if k not in drop} for i, c in mm.items()}
d26 = {}
for c, n in dn.items():
    k = adist.index(nd(n)) if nd(n) in adist else None
    if k is not None and str(k) in A['d26']: d26[str(c)] = A['d26'][str(k)]
doc = {'parties': A['parties'], 'ck': A['ck'], 'mun': mun, 'd26': d26, 'nat26': A['nat26'], 'nat21': A['nat21'], 'summary': A['summary']}
json.dump(doc, open(out, 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
print(f'{len(mm)} of {len(H["mun"])} municipalities joined, {len(ul)} of {len(A["lls"])} atlas local levels used; {len(d26)} districts with 2026 results')
