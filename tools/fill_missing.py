"""補齊缺少的引用檔：先找 TV_Box_Sources 內同名檔，再到 GitHub（Sourcegraph 搜尋）找；放到 overlay/，路徑對應原 repo 相對路徑。"""
import json,os,re,collections,hashlib,urllib.parse,urllib.request,time
from sg import sg
SRC=os.environ.get("TVBOX_SRC", "/home/tailon/github_projects/android_tvbox_app/TV_Box_Sources")
OV=os.path.join(os.path.dirname(os.path.abspath(__file__)),"overlay")
miss=json.load(open('missing.json'))
groups=json.load(open('groups.json'))
idx=collections.defaultdict(list)
for root,ds,fs in os.walk(SRC):
  if '/.git' in root: continue
  for f in fs: idx[f].append(os.path.join(root,f))
md5=lambda b:hashlib.md5(b).hexdigest()
# 每個缺檔 token 期望的 md5（若有 ;md5;）
want={}
for gid,(gk,items) in enumerate(groups):
  for it in items:
    for v in json.dumps(it['site'],ensure_ascii=False).split('"'):
      m=re.match(r'^(\.\.?/[^;]+);md5;([0-9a-f]{32})',v)
      if m: want[(it['cfg'],m.group(1))]=m.group(2)
log=[]
def fetch(repo,commit,path):
  owner_repo=repo.replace('github.com/','')
  url=f"https://raw.githubusercontent.com/{owner_repo}/{commit}/{urllib.parse.quote(path)}"
  try:
    return urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0"}),timeout=60).read(), f"https://github.com/{owner_repo}/blob/{commit}/{path}"
  except Exception as e:
    return None,None
for cfg,tok,gids in miss:
  if tok.startswith('assets://'): 
    log.append((cfg,tok,'assets 不存在，略過',''));continue
  target=os.path.normpath(os.path.join(os.path.dirname(os.path.join(SRC,cfg)),tok))
  if not target.startswith(SRC+os.sep): log.append((cfg,tok,'路徑超出來源目錄','')); continue
  ovp=OV+target[len(SRC):]
  if os.path.isfile(ovp): continue
  base=urllib.parse.unquote(os.path.basename(tok))
  w=want.get((cfg,tok))
  chosen=None;origin=None
  cands=idx.get(base,[])
  top=cfg.split('/')[0]
  cands=sorted(cands,key=lambda p:(not p.startswith(os.path.join(SRC,top)+os.sep), len(p)))
  for p in cands:
    b=open(p,'rb').read()
    if w and md5(b)!=w: continue
    chosen,origin=b,'本地:'+os.path.relpath(p,SRC);break
  if chosen is None and not w and cands:
    p=cands[0];chosen,origin=open(p,'rb').read(),'本地:'+os.path.relpath(p,SRC)
  if chosen is None:
    q='file:(^|/)'+re.escape(base)+'$ count:40'
    try: hits=sg(q,40)
    except Exception as e: hits=[];print('sg err',e)
    time.sleep(1)
    first=None
    for repo,commit,path in hits[:15]:
      b,u=fetch(repo,commit,path)
      if not b: continue
      if first is None: first=(b,u)
      if w and md5(b)==w: chosen,origin=b,'GitHub:'+u;break
    if chosen is None and first and (not w or base.endswith('.jar')):
      chosen,origin=first[0],'GitHub(md5不同):'+first[1]
  if chosen is None:
    log.append((cfg,tok,'找不到','')); print('NOTFOUND',cfg,tok); continue
  os.makedirs(os.path.dirname(ovp),exist_ok=True)
  open(ovp,'wb').write(chosen)
  log.append((cfg,tok,origin,md5(chosen)))
  print('OK',cfg,tok,'<=',origin)
json.dump(log,open('fill_log.json','w'),ensure_ascii=False,indent=0)
