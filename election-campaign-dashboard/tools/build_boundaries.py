# Edit the source paths below, then run: py build_boundaries.py
BOUNDARIES = r'G:\election\boundaries.geojson'  # admin boundaries + Census 2021 (EPSG:3857)
HEALTH = r'G:\GIS GALLI\dashboard2\health.geojson'  # health facility points (EPSG:3857)
import json,os,math,collections
import numpy as np, shapely
from shapely.geometry import shape,mapping,Point
import os as _o
HERE=_o.path.dirname(_o.path.abspath(__file__))
OUT=_o.path.join(HERE,'..','data')
os.makedirs(OUT+'/mun',exist_ok=True);os.makedirs(OUT+'/dist',exist_ok=True)
R=6378137.0
def inv(c):
    x=c[:,0];y=c[:,1]
    return np.column_stack((np.degrees(x/R),np.degrees(2*np.arctan(np.exp(y/R))-math.pi/2)))
def rnd(o):
    if isinstance(o,(list,tuple)):
        if o and isinstance(o[0],(int,float)): return [round(o[0],5),round(o[1],5)]
        return [rnd(i) for i in o]
    return o
def geo(g,tol):
    g=shapely.transform(g,inv)
    g=g.simplify(tol,preserve_topology=True)
    if g.is_empty: return None,None
    m=mapping(g)
    return {'type':m['type'],'coordinates':rnd(m['coordinates'])},[round(v,4) for v in g.bounds]
PN={1:'Koshi',2:'Madhesh',3:'Bagmati',4:'Gandaki',5:'Lumbini',6:'Karnali',7:'Sudurpashchim'}
TY={'mahanagarpalika':'Metropolitan City','upamahanagarpalika':'Sub-Metropolitan City','nagarpalika':'Municipality','gaunpalika':'Rural Municipality'}
def tc(s): return ' '.join(w.capitalize() for w in s.replace('_',' ').split())
AG=['0_4','5_9','10_14','15_19','20_24','25_29','30_34','35_39','40_44','45_49','50_54','55_59','60_64','65_69','70_74','75_79','80_84','85_89','90_94','95_']
def dem(p):
    g=lambda s:[int(p.get(a+'_'+s) or p.get(a+'__'+s) or 0) if a!='95_' else int(p.get('95__'+s) or 0) for a in AG]
    return {'t':int(p['total'] or 0),'m':int(p['male'] or 0),'f':int(p['female'] or 0),'am':g('m'),'af':g('f')}
print('loading');d=json.load(open(BOUNDARIES,encoding='utf-8'))
F=d['features'];print(len(F))
H={'prov':[],'dist':[],'mun':[]}
dist_ids={}
# provinces
prov_geo=[]
for f in F:
    p=f['properties'];l=p['adminlevel']
    if l==4:
        g,b=geo(shape(f['geometry']),0.004)
        H['prov'].append({'c':int(p['state_code']),'n':PN[int(p['state_code'])],'bb':b,**dem(p)})
        prov_geo.append({'type':'Feature','properties':{'k':'p','c':int(p['state_code']),'n':PN[int(p['state_code'])]},'geometry':g})
    elif l==5:
        g,b=geo(shape(f['geometry']),0.002)
        H['dist'].append({'c':int(p['di_code']),'n':tc(p['district']),'p':int(p['state_code']),'bb':b,**dem(p)})
        prov_geo.append({'type':'Feature','properties':{'k':'d','c':int(p['di_code']),'n':tc(p['district']),'p':int(p['state_code'])},'geometry':g})
    elif l==3: H['nation']=dem(p)
H['prov'].sort(key=lambda x:x['c']);H['dist'].sort(key=lambda x:x['n'])
json.dump({'type':'FeatureCollection','features':prov_geo},open(OUT+'/bounds.json','w'),separators=(',',':'))
print('bounds done')
# municipalities
mun={}
for f in F:
    p=f['properties']
    if p['adminlevel']==6:
        k=(p['district'],(p['gana_name'] or '').replace(' ',''))
        g,b=geo(shape(f['geometry']),0.0003)
        mun[k]={'id':int(p['id']),'n':tc(p['gana_name']),'ty':TY.get(p['gana_type'],tc(p['gana_type'] or '')),'rural':p['gana_type']=='gaunpalika','d':int(p['di_code']),'p':int(p['state_code']),'bb':b,'g':g,'w':[],**dem(p)}
wards=[]
for f in F:
    p=f['properties']
    if p['adminlevel']==7:
        k=(p['district'],(p['gana_name'] or '').replace(' ',''))
        if k not in mun: print('orphan',k);continue
        g0=shape(f['geometry']);g,b=geo(g0,0.00004)
        if g is None: continue
        w={'no':int(p['ward_no']),'id':int(p['id']),'bb':b,'ca':p['ca_np'] or '',**dem(p)}
        mun[k]['w'].append(w)
        wards.append((mun[k]['id'],w,g,shapely.from_geojson(json.dumps(g))))
print('wards',len(wards))
# health POIs
h=json.load(open(HEALTH,encoding='utf-8'))['features']
xy=np.array([f['geometry']['coordinates'][:2] for f in h]);ll=inv(xy)
pts=shapely.points(ll[:,0],ll[:,1])
tree=shapely.STRtree([w[3] for w in wards])
qi,ti=tree.query(pts,predicate='within')
seen=set();pois=collections.defaultdict(list)
for a,b in zip(qi,ti):
    if a in seen: continue
    seen.add(a);pr=h[a]['properties'];mid,w,_,_=wards[b]
    pois[(mid,w['id'])].append({'n':pr['name'] or '','s':pr['sub_type'],'a':pr['address'] or '','c':pr['contact'] or '','x':round(ll[a,0],5),'y':round(ll[a,1],5)})
print('pois assigned',len(seen),'of',len(h))
# write per-municipality files + hier
byd=collections.defaultdict(list)
for k,m in mun.items():
    wl=sorted(m['w'],key=lambda w:w['no'])
    feats=[]
    for w in wl:
        wg=[x for x in wards if x[1] is w][0][2] if False else None
    m['w']=wl
for mid,w,g,_ in wards: pass
gm=collections.defaultdict(dict)
for mid,w,g,_ in wards: gm[mid][w['id']]=g
for k,m in mun.items():
    feats=[{'type':'Feature','properties':{'no':w['no'],'id':w['id']},'geometry':gm[m['id']][w['id']]} for w in m['w']]
    pl=[]
    for w in m['w']:
        for q in pois.get((m['id'],w['id']),[]): pl.append({**q,'w':w['no']})
    json.dump({'outline':m['g'],'wards':feats,'pois':pl},open(f"{OUT}/mun/{m['id']}.json",'w'),separators=(',',':'))
    byd[m['d']].append({'type':'Feature','properties':{'id':m['id'],'n':m['n']},'geometry':m['g']})
    for w in m['w']: w.pop('bb',None) if False else None
for dc,fs in byd.items(): json.dump({'type':'FeatureCollection','features':fs},open(f"{OUT}/dist/{dc}.json",'w'),separators=(',',':'))
ml=[]
for k,m in mun.items():
    mm={x:m[x] for x in m if x not in('g',)}
    ml.append(mm)
ml.sort(key=lambda m:m['n'])
H['mun']=ml
json.dump(H,open(OUT+'/hier.json','w'),separators=(',',':'))
print('done')
