"""Joins the scraped 2022 pages (scrape/out/*.json, made by tools/scrape_ekantipur.py) to the dashboard's municipalities
and writes data/results22.json:  { munId: {t:{mayor:[..],deputy:[..]}, w:{wardNo:{p:[..],m:[..],f:[..],d:[..]}}, v:[total,male,female,other]} }
A candidate is [name, party, votes, won]. Join key inside a district: the 2022 mayor winner's vote count in data/elections.json
equals the scraped one (near unique), with the municipality name as a tie-breaker.

    py tools/build_results22.py <scrape_out_dir> [out=data/results22.json]"""
import json, glob, re, sys, difflib, collections

src = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else 'data/results22.json'
H = json.load(open('data/hier.json', encoding='utf8')); E = json.load(open('data/elections.json', encoding='utf8'))
dn = {d['c']: d['n'] for d in H['dist']}
def nd(x): return re.sub(r'[^a-z]', '', x.lower().replace('makwanpur', 'makawanpur').replace('tanahun', 'tanahu').replace('nawalparasi', 'nawalpur'))
def nm(x):
    x = re.sub(r'(?<=[a-z])h', '', x.lower()); x = re.sub(r'(municipality|rural|metropolitan|sub|city|gaunpalika|nagarpalika)', '', x)
    x = x.replace('w', 'v').replace('sh', 's').replace('z', 'j').replace('aa', 'a').replace('ee', 'i').replace('oo', 'u')
    return re.sub(r'[^a-z]', '', re.sub(r'(.)\1+', r'\1', x))

POST = {'Mayor': 'mayor', 'Chairperson': 'mayor', 'Chairman': 'mayor', 'Chair': 'mayor', 'Deputy Mayor': 'deputy', 'Vice Chairperson': 'deputy', 'Vice Chairman': 'deputy', 'Vice Chair': 'deputy', 'Deputy Chairperson': 'deputy'}
WPOST = {'Ward President': 'p', 'Ward Chairperson': 'p', 'Member': 'm', 'Female Member': 'f', 'Dalit Female Member': 'd'}
cand = lambda c: [c['n'], c['p'], c['v'], c['w']]

bydist = collections.defaultdict(list)
for m in H['mun']: bydist[nd(dn[m['d']])].append(m)
used, res, miss, unk = set(), {}, [], collections.Counter()
for f in sorted(glob.glob(src + '/*.json')):
    s = json.load(open(f, encoding='utf8'))
    dist = re.search(r'district-([a-z0-9-]+)/', s['path']).group(1)
    top = {POST.get(k, k): v for k, v in s['top'].items()}
    wv = next((c['v'] for c in top.get('mayor', []) if c['w']), None)
    best = None
    dk = nd(dist).replace('easternrukum', 'rukumeast').replace('westernrukum', 'rukumwest')
    if dk not in bydist: dk = max(bydist, key=lambda k: difflib.SequenceMatcher(None, k, dk).ratio())
    for m in bydist[dk]:
        if m['id'] in used: continue
        r = E['mun'].get(str(m['id'])); h = (r or {}).get('h22') or []
        w = next((c for c in h if c[4]), None)
        sc = difflib.SequenceMatcher(None, nm(m['n']), nm(s['name'])).ratio() + (1.5 if w and wv is not None and w[3] == wv else 0) - .1 * min(abs(len(m['w']) - (s['nw'] or len(m['w']))), 3)
        if not best or sc > best[0]: best = (sc, m)
    if not best or best[0] < .65:
        miss.append((s['path'], s['name'], best and round(best[0], 2))); continue
    m = best[1]; used.add(m['id'])
    wards = {}
    for wn, posts in s['wards'].items():
        d = {}
        for k, cs in posts.items():
            key = WPOST.get(k)
            if key is None: unk[k] += 1; continue
            d[key] = [cand(c) for c in cs]
        wards[wn] = d
    v = s['voters']
    res[str(m['id'])] = {'t': {k: [cand(c) for c in cs] for k, cs in top.items() if k in ('mayor', 'deputy')}, 'w': wards, 'v': [v['t'], v['m'], v['f'], v['o']]}
json.dump(res, open(out, 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
print(f'{len(res)} joined of {len(H["mun"])} dashboard municipalities; {len(miss)} scraped pages unmatched; unknown ward posts: {dict(unk)}')
for x in miss[:40]: print('  unmatched', x)
