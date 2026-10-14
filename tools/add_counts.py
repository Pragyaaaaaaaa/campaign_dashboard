# Adds per-ward building and health-facility counts ("nb", "np") to data/hier.json.
# Run after build_boundaries.py and build_buildings.py:  py tools/add_counts.py
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
hp = os.path.join(DATA, 'hier.json')
H = json.load(open(hp, encoding='utf-8'))
tot_b = tot_p = 0
for m in H['mun']:
    try:
        pois = json.load(open(os.path.join(DATA, 'mun', f"{m['id']}.json"), encoding='utf-8'))['pois']
    except FileNotFoundError:
        pois = []
    per = {}
    for p in pois:
        per[p['w']] = per.get(p['w'], 0) + 1
    for w in m['w']:
        fp = os.path.join(DATA, 'bld', f"{w['id']}.json")
        n = 0
        if os.path.exists(fp):
            t = open(fp, encoding='utf-8').read()
            n = 0 if t == '[]' else t.count(']],[') + 1
        w['nb'] = n
        w['np'] = per.get(w['no'], 0)
        tot_b += n
        tot_p += w['np']
json.dump(H, open(hp, 'w', encoding='utf-8'), separators=(',', ':'))
print('buildings', tot_b, 'health facilities', tot_p)
