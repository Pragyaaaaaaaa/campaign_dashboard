# Edit the source paths below, then run: py build_buildings.py
BUILDINGS = r'G:\election\building_election.geojson'  # source buildings (EPSG:3857); run build_boundaries.py first
import json,os,glob,math,time,collections,sys
import numpy as np, shapely
from shapely.geometry import shape
import os as _o
HERE=_o.path.dirname(_o.path.abspath(__file__))
BASE=_o.path.join(HERE,'..','data')
OUT=BASE+'/bld';os.makedirs(OUT,exist_ok=True)
R=6378137.0
# ward polygons
geoms=[];wid=[]
for fp in glob.glob(BASE+'/mun/*.json'):
    for f in json.load(open(fp))['wards']:
        geoms.append(shapely.from_geojson(json.dumps(f['geometry'])));wid.append(f['properties']['id'])
tree=shapely.STRtree(geoms);print('wards',len(geoms),flush=True)
store=collections.defaultdict(list);tot=0;kept=0;t0=time.time()
def flush(batch):
    global kept
    if not batch: return
    c=np.array([b[0] for b in batch])
    pts=shapely.points(c[:,0],c[:,1])
    qi,ti=tree.query(pts,predicate='within')
    _,first=np.unique(qi,return_index=True)
    done=set()
    for k in first:
        i=qi[k];w=wid[ti[k]];store[w].append(batch[i][1]);kept+=1;done.add(i)
    # buildings just outside the simplified ward outline: attach to the nearest ward within ~50 m
    rest=np.array([i for i in range(len(batch)) if i not in done],dtype=int)
    if len(rest):
        qi2,ti2=tree.query_nearest(pts[rest],max_distance=0.0005,return_distance=False)
        seen=set()
        for a,b in zip(qi2,ti2):
            if a in seen: continue
            seen.add(a);store[wid[b]].append(batch[rest[a]][1]);kept+=1
batch=[]
with open(BUILDINGS,encoding='utf-8') as fh:
    for line in fh:
        line=line.strip().rstrip(',')
        if not line.startswith('{"type":"Feature"'): continue
        try: f=json.loads(line)
        except Exception: continue
        g=f['geometry']
        if not g: continue
        ring=g['coordinates'][0][0] if g['type']=='MultiPolygon' else g['coordinates'][0]
        a=np.array(ring)[:-1]
        if len(a)<3: continue
        lon=np.degrees(a[:,0]/R);lat=np.degrees(2*np.arctan(np.exp(a[:,1]/R))-math.pi/2)
        if len(a)>8:
            s=shapely.Polygon(np.column_stack((lon,lat))).simplify(2e-6)
            if s.is_empty or s.geom_type!='Polygon': pass
            else:
                xy=np.array(s.exterior.coords)[:-1];lon,lat=xy[:,0],xy[:,1]
        x0=round(lon[0]*1e6);y0=round(lat[0]*1e6)
        d=[]
        for lo,la in zip(lon[1:],lat[1:]): d+= [round(lo*1e6)-x0,round(la*1e6)-y0]
        rec=json.dumps([x0,y0,d],separators=(',',':'))  # kept as text: the full file has ~13M buildings
        batch.append(((lon.mean(),lat.mean()),rec));tot+=1
        if len(batch)>=100000:
            flush(batch);batch=[]
            print(tot,kept,int(time.time()-t0),'s',flush=True)
flush(batch)
print('total',tot,'assigned',kept,flush=True)
for w,l in store.items():
    open(f'{OUT}/{w}.json','w').write('['+','.join(l)+']')
print('written',len(store),flush=True)
