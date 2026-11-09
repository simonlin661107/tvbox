"""檢查設定檔中所有 ./ 引用與 JS import 是否存在，jar md5 是否正確。"""
import json,os,re,sys,hashlib
D=sys.argv[1]; bad=0
TOK=re.compile(r"""(?<![\w.:/])\./[^\s"'$;,|?#<>]+""")
IMP=re.compile(r"""(\bimport\s*(?:[\w{}*\s,$]+?\s*from\s*)?|\brequire\s*\(\s*)(["'])([^"'\n]+)\2""")
seen=set()
def chkjs(p):
  global bad
  if p in seen or not p.endswith('.js'): return
  seen.add(p)
  for m in IMP.finditer(open(p,'rb').read().decode('utf-8','ignore')):
    sp=m.group(3)
    if sp.startswith('.'):
      q=os.path.normpath(os.path.join(os.path.dirname(p),sp))
      if not os.path.isfile(q): print('MISSING import',os.path.relpath(p,D),sp); bad+=1
      else: chkjs(q)
    elif sp.startswith('http') or sp.startswith('assets://'):
      print('NONLOCAL import',os.path.relpath(p,D),sp[:80])
for cfg in sys.argv[2:]:
  t=open(os.path.join(D,cfg)).read()
  for v in re.findall(r'"((?:[^"\\]|\\.)*)"',t):
    m=re.match(r'^\./([^;]+);md5;([0-9a-f]+)$',v)
    if m:
      p=os.path.join(D,m.group(1))
      if not os.path.isfile(p) or hashlib.md5(open(p,'rb').read()).hexdigest()!=m.group(2): print('BAD md5',cfg,v); bad+=1
    for tok in TOK.findall(v):
      p=os.path.normpath(os.path.join(D,tok))
      if not os.path.isfile(p): print('MISSING',cfg,tok); bad+=1
      else: chkjs(p)
    if 'assets://' in v: print('ASSETS ref',cfg,v[:80])
print('bad',bad)
