"""Scrapes the 2022 local election pages of localelection.ekantipur.com (robots.txt has no Disallow rules).
Per local level: mayor/chair and deputy (as published, two candidates), every ward post with all candidates and votes,
eligible voters. Resumable; output in out/<province>__<district>__<slug>.json. Polite: 3 workers, small delay."""
import re, json, os, sys, time, html, urllib.request, concurrent.futures as cf

B = 'https://localelection.ekantipur.com'
UA = 'Mozilla/5.0 (research; campaign dashboard data collection)'
os.makedirs('out', exist_ok=True)

def get(path, tries=4):
    for i in range(tries):
        try:
            r = urllib.request.Request(B + path, headers={'User-Agent': UA})
            return urllib.request.urlopen(r, timeout=60).read().decode('utf8', 'replace')
        except Exception as e:
            time.sleep(2 * (i + 1))
    return None

def index():
    if os.path.exists('urls.json'): return json.load(open('urls.json'))
    dj = json.loads(get('/json/districts.json?v=2022.030'))
    ms = [f"/pradesh-{p}/district-{d}/{l['id']}" for p, ds in dj.items() for d, dv in ds.items() for l in dv['locations']]
    json.dump(ms, open('urls.json', 'w')); return ms

T = lambda s: html.unescape(re.sub(r'<[^>]+>', '', s)).strip()
num = lambda s: int(re.sub(r'\D', '', s)) if s and re.search(r'\d', s) else None

def top_post(sec):
    out = []
    names = re.split(r'class="candididate candididate-\d', sec)[1:]
    votes = re.findall(r'class="candididate-p candididate-(\d)-p">(.*?)(?=<div class="candididate-p|</div></div></div>\s*</div>\s*</li>|$)', sec, re.S)
    vmap = {}
    for k, blk in re.findall(r'candididate-(\d)-p">(.*?)(?=candididate-\d-p">|</li>)', sec, re.S):
        m = re.search(r'total-vote[^>]*>\s*([\d,]*)', blk); vmap[k] = num(m.group(1)) if m else None
    for i, b in enumerate(names):
        n = re.search(r'<h4>(.*?)</h4>', b, re.S); p = re.search(r'<span>([^<]*)</span>\s*</a>', b)
        out.append({'n': T(n.group(1)) if n else '', 'p': T(p.group(1)) if p else '', 'v': vmap.get(str(i + 1)), 'w': 1 if 'title="Elected"' in b else 0})
    return out

def parse(t):
    r = {}
    m = re.search(r'<h2 class="header-title mb-4">(.*?)</h2>', t, re.S); r['name'] = T(m.group(1)) if m else ''
    top = {}
    for h, sec in re.findall(r'<h6 class="card-title fw-bold ?">(.*?)</h6>(.*?)(?=<h6 class="card-title|<div class="wada-data)', t, re.S):
        top[T(h)] = top_post(sec)
    r['top'] = top
    wards = {}
    for wn, blk in re.findall(r'<div id="tab-(\d+)" class="tab-content"[^>]*>(.*?)(?=<div id="tab-\d+" class="tab-content"|<div class="col-lg|<script)', t, re.S):
        posts = {}
        for h, sec in re.findall(r'<div class="card-header">(.*?)</div>\s*<ul class="result-wrapper(.*?)</ul>', blk, re.S):
            cs = []
            for li in re.findall(r'<li class="list-group-item">(.*?)</li>', sec, re.S):
                n = re.search(r'candidate-name">(.*?)</div>', li, re.S); p = re.search(r'candidate-party-name">(.*?)</div>', li, re.S); v = re.search(r'vote-numbers">\s*([\d,]*)', li)
                cs.append({'n': T(n.group(1)) if n else '', 'p': T(p.group(1)) if p else '', 'v': num(v.group(1)) if v else None, 'w': 1 if 'candidate-list-wada elected' in li else 0})
            posts[T(h)] = cs
        wards[wn] = posts
    r['wards'] = wards
    vt = {}
    for k, key in [('Male', 'm'), ('Female', 'f'), ('Other', 'o'), ('Total Eligible', 't')]:
        m = re.search(r'(?:Number of )?%s Voters\s*</span>\s*<span[^>]*>\s*([\d,]*)' % k, t); vt[key] = num(m.group(1)) if m else None
    r['voters'] = vt
    m = re.search(r'There are (\d+) wards[^.]*population of ([\d,]+)', t); r['nw'] = int(m.group(1)) if m else None; r['pop'] = num(m.group(2)) if m else None
    m = re.search(r'is in (.*?) district of (.*?)\. ', t); r['loc'] = [m.group(1), m.group(2)] if m else None
    return r

def job(path):
    f = 'out/' + path.strip('/').replace('/', '__') + '.json'
    if os.path.exists(f): return path, 'cached'
    t = get(path + '?lng=eng')
    if not t: return path, 'FAIL'
    d = parse(t); d['path'] = path
    json.dump(d, open(f, 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
    time.sleep(.3)
    return path, 'ok' if d['top'] and d['wards'] else 'EMPTY'

if __name__ == '__main__':
    ms = index(); lim = int(sys.argv[1]) if len(sys.argv) > 1 else None
    if lim: ms = ms[:lim]
    print(len(ms), 'local levels', flush=True)
    bad = []
    with cf.ThreadPoolExecutor(3) as ex:
        for i, (p, s) in enumerate(ex.map(job, ms)):
            if s in ('FAIL', 'EMPTY'): bad.append((p, s))
            if i % 25 == 0: print(i, p, s, flush=True)
    print('done; problems:', bad, flush=True)
