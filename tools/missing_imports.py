import json,os,re,collections,sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import migrate as M
groups=json.load(open('groups.json'))
miss=collections.defaultdict(set)
seen=set()
def chk(p,gid):
  if p in seen: return
  seen.add(p)
  if not p.endswith('.js'): return
  text=open(p,'rb').read().decode('utf-8','ignore')
  for m in M.JS_IMPORT.finditer(text):
    spec=m.group(3)
    if spec.startswith('assets://'): t=M.phys(os.path.join(M.ASSETS,spec[9:]))
    elif spec.startswith('.'): t=M.phys(os.path.normpath(os.path.join(os.path.dirname(M.canon(p)),spec)))
    else: continue
    if t: chk(t,gid)
    else: miss[(os.path.relpath(M.canon(p),M.SRC),spec)].add(gid)
for gid,(gk,items) in enumerate(groups):
  for it in items:
    base=os.path.dirname(os.path.join(M.SRC,it['cfg']))
    for x in M.strings(it['site']):
      for m in M.TOKEN.finditer(x):
        p=M.resolve(m.group(1),base)
        if p: chk(p,gid)
for k,v in sorted(miss.items()): print(len(v),k)
remote=collections.Counter()
for p in seen:
  if p.endswith('.js'):
    for m in M.JS_IMPORT.finditer(open(p,'rb').read().decode('utf-8','ignore')):
      if m.group(3).startswith('http'): remote[m.group(3)]+=1
for k,n in remote.most_common(): print('remote',n,k)
