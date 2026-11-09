import json,glob,os,re,collections,hashlib
ROOT=os.environ.get("TVBOX_SRC", "/home/tailon/github_projects/android_tvbox_app/TV_Box_Sources")
def loadj(f):
    t=open(f,encoding='utf-8',errors='ignore').read()
    try: return json.loads(t)
    except Exception:
        t2=re.sub(r'^\s*//.*$','',t,flags=re.M)
        try: return json.loads(t2)
        except Exception: return None
items=[]
for f in sorted(glob.glob(ROOT+'/**/*.json',recursive=True)):
    d=loadj(f)
    if not (isinstance(d,dict) and isinstance(d.get('sites'),list)): continue
    rel=os.path.relpath(f,ROOT)
    for s in d['sites']:
        if not isinstance(s,dict): continue
        ext=s.get('ext','')
        if not isinstance(ext,str): ext=json.dumps(ext,ensure_ascii=False,sort_keys=True)
        items.append(dict(cfg=rel,spider=d.get('spider',''),site=s,key=s.get('key'),name=s.get('name'),type=int(s.get('type',0)),api=str(s.get('api','')),ext=ext,jar=s.get('jar','')))
# dedupe by (type, api basename/normalized, ext normalized)
def norm(x):
    x=x.strip()
    x=re.sub(r'^(\./|\.\./)+','',x)
    x=re.sub(r'^assets://js/','',x)
    x=re.sub(r'\?.*$','',x) if x.startswith('http') else x
    return x
groups=collections.OrderedDict()
for it in items:
    api=it['api']
    k=(it['type'], api if api.startswith('csp_') or api.startswith('http') else norm(api), norm(it['ext']) if it['ext'] else '')
    groups.setdefault(k,[]).append(it)
print('total',len(items),'unique',len(groups))
c=collections.Counter()
for k,v in groups.items():
    t,api,ext=k
    if t==3:
        if api.startswith('csp_'): kind='jar:'+api
        elif 'drpy' in api: kind='drpy'
        elif api.endswith('.py'): kind='py'
        elif api.endswith('.js'): kind='js(cat)'
        else: kind='other3'
    else: kind='cms%d'%t
    c[kind.split(':')[0]]+=1
print(c)
json.dump([[list(k),v] for k,v in groups.items()],open('groups.json','w'),ensure_ascii=False,indent=0)
