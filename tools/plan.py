import json,collections
groups=json.load(open('groups.json'))
# 每群組選代表：優先出現在涵蓋群組數最多的設定檔
cov=collections.Counter()
for k,v in groups:
    for cfg in {it['cfg'] for it in v}: cov[cfg]+=1
plan=collections.OrderedDict()
for gid,(k,v) in enumerate(groups):
    best=max(v,key=lambda it:(cov[it['cfg']], -len(it['cfg'])))
    plan.setdefault(best['cfg'],[]).append(dict(gid=str(gid),key=best['key'],name=best['name'],type=best['type'],api=best['api']))
out=[dict(cfg=c,sites=s) for c,s in sorted(plan.items(),key=lambda x:-len(x[1]))]
json.dump(out,open('plan.json','w'),ensure_ascii=False,indent=1)
for e in out: print(e['cfg'],len(e['sites']))
