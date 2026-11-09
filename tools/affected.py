import json,os,sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import migrate as M
groups=json.load(open('groups.json')); plan=json.load(open('plan.json'))
rep={int(s['gid']):e['cfg'] for e in plan for s in e['sites']}
def closure(p,acc):
  if p in acc: return
  acc.add(p)
  for spec,n in M.node(p).imports: closure(n.src,acc)
aff=[]
for gid,(gk,items) in enumerate(groups):
  it=next((x for x in items if x['cfg']==rep.get(gid)),items[0])
  base=os.path.dirname(os.path.join(M.SRC,it['cfg']))
  s=dict(it['site'])
  if str(s.get('api','')).startswith('csp_') and not s.get('jar') and it.get('spider'): s['jar']=it['spider']
  acc=set()
  for x in M.strings(s):
    for m in M.TOKEN.finditer(x):
      p=M.resolve(m.group(1),base)
      if p: closure(p,acc)
  if any(p.startswith(M.OVERLAY) for p in acc): aff.append(gid)
json.dump(aff,open('affected.json','w'))
r=json.load(open('results.json'))
print('affected',len(aff),'already tested',sum(1 for g in aff if str(g) in r),'of which failed',sum(1 for g in aff if str(g) in r and not r[str(g)].get('pass')))
