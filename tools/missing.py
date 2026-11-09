import json,os,re,collections,sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from migrate import TOKEN, resolve, strings, SRC, ASSETS, JS_IMPORT
groups=json.load(open('groups.json'))
miss=collections.defaultdict(set)   # (cfg, token) -> gids
cfgspider=collections.defaultdict(set)
for gid,(gk,items) in enumerate(groups):
  for it in items:
    base=os.path.dirname(os.path.join(SRC,it['cfg']))
    s=dict(it['site']); 
    if str(s.get('api','')).startswith('csp_') and not s.get('jar') and it.get('spider'): s['jar']=it['spider']
    for x in strings(s):
      for m in TOKEN.finditer(x):
        t=m.group(1)
        if not resolve(t,base):
          miss[(it['cfg'],t)].add(gid)
json.dump([[k[0],k[1],sorted(v)] for k,v in miss.items()],open('missing.json','w'),ensure_ascii=False,indent=0)
gids=set().union(*miss.values()) if miss else set()
print('missing refs',len(miss),'groups affected',len(gids))
c=collections.Counter(os.path.basename(k[1]) for k in miss)
for k,n in c.most_common(40): print(n,k)
