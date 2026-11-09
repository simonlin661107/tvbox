#!/usr/bin/env python3
"""把驗證通過的點播源搬到 tvbox 專案：每個源一個資料夾，共用檔案集中到 reference_file/。

1. 收集每個點播源站點設定引用的本地檔案（./ ../ assets://），遞迴收集 JS import（含遠端 import 下載本地化）。
2. 專屬檔案放在 <slug>/ 底下，保留相對於原設定檔目錄的結構；assets:// 檔案放在 lib/。
3. 連同 direct.json / direct18.json 的引用檔，以「深層雜湊」（內容 + import 目標深層雜湊）判斷，
   被兩個以上擁有者使用的檔案移到 reference_file/<類型>/。
4. 改寫站點設定與檔案內 import 路徑、校正 jar md5，輸出 mix.json、更新 direct*.json 與 move_list.txt。

用法：migrate.py <results.json> [--dry]
"""
import copy, hashlib, json, os, re, shutil, sys, collections, posixpath, urllib.request, urllib.parse, datetime, subprocess
from pypinyin import lazy_pinyin

SRC = os.environ.get("TVBOX_SRC", "/home/tailon/github_projects/android_tvbox_app/TV_Box_Sources")
ASSETS = os.environ.get("TVBOX_ASSETS", "/home/tailon/github_projects/android_tvbox_app/TV/quickjs/src/main/assets")
DST = os.environ.get("DST", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MIG = os.path.dirname(os.path.abspath(__file__))  # 本工具目錄（tvbox/tools）
REF = "reference_file"
REMOTE_CACHE = os.path.join(MIG, "remote")
OVERLAY = os.path.join(MIG, "overlay")  # 補齊的缺檔（路徑對應 SRC）


def phys(p):
    """虛擬路徑（SRC 底下）→ 實體檔案：overlay（補齊/修正檔）優先，其次原檔。"""
    if p.startswith(SRC + os.sep):
        q = OVERLAY + p[len(SRC):]
        if os.path.isfile(q):
            return q
    return p if os.path.isfile(p) else None


def canon(p):
    """實體路徑 → 虛擬路徑（overlay 檔視為在 SRC 底下）。"""
    return SRC + p[len(OVERLAY):] if p.startswith(OVERLAY + os.sep) else p

TOKEN = re.compile(r"""(assets://[^\s"'$;,|?#<>]+|(?<![\w.:/])\.\.?/[^\s"'$;,|?#<>]+)""")
JS_IMPORT = re.compile(r"""(\bimport\s*(?:[\w{}*\s,$]+?\s*from\s*)?|\brequire\s*\(\s*)(["'])([^"'\n]+)\2""")
CATS = {"jar", "js", "lib", "json", "py", "txt"}
EXT_CAT = {".jar": "jar", ".js": "js", ".json": "json", ".py": "py", ".txt": "txt"}


def md5b(b):
    return hashlib.md5(b).hexdigest()


def slugify(text, used):
    base = re.sub(r"[^A-Za-z0-9]+", "", "".join(lazy_pinyin(text or "site"))).lower()[:24] or "site"
    s, i = base, 2
    while s in used:
        s, i = f"{base}{i}", i + 1
    used.add(s)
    return s


def download(url):
    # 去掉 GitHub 代理前綴，直接抓 GitHub 原始檔
    m = re.search(r"https?://(raw\.githubusercontent\.com|github\.com)/.*", url[8:])
    if m:
        url = m.group(0)
    os.makedirs(REMOTE_CACHE, exist_ok=True)
    name = urllib.parse.unquote(url.split("?")[0].rstrip("/").split("/")[-1]) or "file"
    d = os.path.join(REMOTE_CACHE, md5b(url.encode())[:10])
    p = os.path.join(d, name)
    if os.path.isfile(p):
        return p
    try:
        url = urllib.parse.quote(url, safe=":/?&=%#;,+@!$*'()~")
        req = urllib.request.Request(url, headers={"User-Agent": "okhttp/4.12.0"})
        data = urllib.request.urlopen(req, timeout=30).read()
        if not data or data[:15].lower().startswith(b"<!doctype html") or data[:6].lower() == b"<html>":
            return None
        os.makedirs(d, exist_ok=True)
        open(p, "wb").write(data)
        return p
    except Exception as e:
        print("   download fail", url, e)
        return None


class Node:
    def __init__(self, src, content):
        self.src = src
        self.content = content
        self.imports = []  # (spec, Node)
        self._deep = None

    def deep(self, stack=()):
        if self._deep:
            return self._deep
        h = hashlib.md5(self.content)
        for spec, n in sorted(self.imports, key=lambda x: x[0]):
            h.update(b"|" + (md5b(n.content) if id(n) in stack else n.deep(stack + (id(self),))).encode())
        self._deep = h.hexdigest()
        return self._deep


NODES = {}


def node(src):
    if src in NODES:
        return NODES[src]
    n = Node(src, open(src, "rb").read())
    NODES[src] = n
    if src.endswith(".js"):
        text = n.content.decode("utf-8", "ignore")
        for m in JS_IMPORT.finditer(text):
            spec = m.group(3)
            t = None
            if spec.startswith("assets://"):
                p = os.path.join(ASSETS, spec[len("assets://"):])
                t = p if os.path.isfile(p) else None
            elif spec.startswith("./") or spec.startswith("../"):
                t = phys(os.path.normpath(os.path.join(os.path.dirname(canon(src)), spec)))
            elif spec.startswith("http") and re.search(r"\.(js|txt)(\?|$)", spec):
                t = download(spec)
            if t and all(s != spec for s, _ in n.imports):
                n.imports.append((spec, node(t)))
    return n


def resolve(tok, base_dir):
    if tok.startswith("assets://"):
        p = os.path.join(ASSETS, tok[len("assets://"):])
    else:
        return phys(os.path.normpath(os.path.join(base_dir, tok)))
    return p if os.path.isfile(p) else None


def walk(o, fn):
    if isinstance(o, dict):
        return {k: walk(v, fn) for k, v in o.items()}
    if isinstance(o, list):
        return [walk(v, fn) for v in o]
    if isinstance(o, str):
        return fn(o)
    return o


def strings(o):
    out = []
    walk(o, lambda s: out.append(s) or s)
    return out


def layout_rel(src, base_dir):
    if src.startswith(ASSETS):
        return "lib/" + os.path.basename(src)
    if src.startswith(REMOTE_CACHE):
        n = os.path.basename(src)
        return ("lib/" if n.endswith((".js", ".txt")) else "jar/") + n
    rel = os.path.relpath(canon(src), base_dir)
    parts = [p for p in rel.split(os.sep) if p not in ("..", ".")]
    return "/".join(parts)


def category(rel):
    parts = rel.split("/")
    if len(parts) > 1 and parts[-2] in CATS:
        return parts[-2]
    ext = os.path.splitext(rel)[1].lower()
    return EXT_CAT.get(ext, "misc")


SITE = "site_file"  # 點播源資料夾的上層目錄


def site_folder(t2):
    """設定檔中的引用路徑（去掉 ./）-> 所屬點播源資料夾（site_file/<slug>）。"""
    parts = t2.split("/")
    return "/".join(parts[:2]) if parts[0] == SITE and len(parts) > 2 else parts[0]


class Owner:
    """一個擁有者 = 一個點播源資料夾（或 direct*.json 的全域 spider）。"""

    def __init__(self, folder, base_dir, sites, cfg_name, top=None):
        self.folder = folder
        self.base_dir = base_dir
        self.sites = sites  # 站點 dict（會被改寫）
        self.cfg_name = cfg_name
        self.top = top or {}  # 設定檔頂層欄位（spider 等）需要改寫的
        self.files = {}  # src -> layout rel
        self.tokens = []  # (owner-level token, src)

    def collect(self):
        def scan(s):
            for m in TOKEN.finditer(s):
                p = resolve(m.group(1), self.base_dir)
                if p:
                    self.add(p, self.base_dir_rel(p))
            return s

        for site in self.sites:
            walk(site, scan)
        walk({k: v for k, v in self.top.items() if k != "sites"}, scan)

    def base_dir_rel(self, p):
        return layout_rel(p, self.base_dir)

    def add(self, src, rel):
        if src in self.files:
            return
        used = set(self.files.values())
        r = rel
        i = 2
        while r in used:
            stem, ext = os.path.splitext(rel)
            r, i = f"{stem}_{i}{ext}", i + 1
        self.files[src] = r
        n = node(src)
        for spec, t in n.imports:
            tr = posixpath.normpath(posixpath.join(posixpath.dirname(r), spec)) if spec.startswith(".") else layout_rel(t.src, self.base_dir)
            if tr.startswith(".."):
                tr = layout_rel(t.src, self.base_dir)
            self.add(t.src, tr)


class ExistingOwner(Owner):
    """direct18 既有資料夾：檔案已在 DST/<folder>/ 底下。"""

    def base_dir_rel(self, p):
        rel = os.path.relpath(p, os.path.join(DST, self.folder))
        if rel.startswith(".."):
            return layout_rel(p, DST)
        return rel


def main():
    results_file = sys.argv[1]
    dry = "--dry" in sys.argv
    results = json.load(open(results_file))
    groups = json.load(open(os.path.join(MIG, "groups.json")))
    moved_before = set()
    ml = os.path.join(DST, "move_list.txt")
    if os.path.isfile(ml):
        for line in open(ml, encoding="utf-8"):
            if line.startswith("#") or not line.strip():
                continue
            cols = line.rstrip("\n").split("\t")
            if len(cols) >= 5:
                moved_before.add((cols[3], cols[4]))

    exf = os.path.join(MIG, "excluded.txt")
    if os.path.isfile(exf):
        for line in open(exf, encoding="utf-8"):
            if line.startswith("#") or not line.strip():
                continue
            cols = line.rstrip("\n").split("\t")
            moved_before.add((cols[0], cols[1]))

    cfg_cache = {}

    def cfg_json(rel):
        if rel not in cfg_cache:
            t = open(phys(os.path.join(SRC, rel)), encoding="utf-8", errors="ignore").read()
            try:
                cfg_cache[rel] = json.loads(t)
            except Exception:
                cfg_cache[rel] = json.loads(re.sub(r"^\s*//.*$", "", t, flags=re.M))
        return cfg_cache[rel]

    # 既有 mix.json（續搬時保留）
    mix_path = os.path.join(DST, "mix.json")
    mix = json.load(open(mix_path)) if os.path.isfile(mix_path) else {"spider": "", "sites": [], "parses": [], "flags": []}
    sdir = os.path.join(DST, SITE)
    used_slugs = {d for d in os.listdir(sdir) if os.path.isdir(os.path.join(sdir, d))} if os.path.isdir(sdir) else set()
    used_keys = {s["key"] for s in mix["sites"]}

    owners = []
    new_records = []
    parse_cfgs = set()
    for gid, (gk, items) in enumerate(groups):
        r = results.get(str(gid))
        if not r or not r.get("pass"):
            continue
        if any((it["cfg"], it["key"]) in moved_before for it in items):
            continue
        cfg = (r.get("cfg") or items[0]["cfg"]).replace("_nojar.json", ".json")  # 測試用的去 jar 版對應回原設定檔
        it = next((x for x in items if x["cfg"] == cfg and x["key"] == r["key"]), items[0])
        conf = cfg_json(it["cfg"])
        # 設定檔有修正版（overlay）時，以修正版中的站點設定為準
        fixed = next((x for x in conf.get("sites", []) if x.get("key") == it["key"]), None)
        site = copy.deepcopy(fixed or it["site"])
        spider = conf.get("spider", "") or ""
        if str(site.get("api", "")).startswith("csp_") and not site.get("jar"):
            site["jar"] = spider
        # 遠端 jar 本地化
        jar = site.get("jar", "")
        if jar.startswith("http"):
            url = jar.split(";")[0]
            p = download(url)
            if p:
                site["jar"] = "__REMOTE__" + p
        info = (r.get("catpath") or {}).get("info") or (r.get("searchpath") or {}).get("info") or {}
        if info.get("useParse"):
            parse_cfgs.add(it["cfg"])
        # 依驗證結果修正 searchable
        if r.get("search_ok"):
            site["searchable"] = 1
            site.setdefault("quickSearch", 1)
        else:
            site["searchable"] = 0
            site["quickSearch"] = 0
        site["type"] = int(site.get("type", 0))
        slug = slugify(site.get("name") or site.get("key"), used_slugs)
        key = site["key"]
        k, i = key, 2
        while k in used_keys:
            k, i = f"{key}_{i}", i + 1
        used_keys.add(k)
        site["key"] = k
        base = os.path.dirname(os.path.join(SRC, it["cfg"]))
        o = Owner(f"{SITE}/{slug}", base, [site], it["cfg"])
        owners.append(o)
        new_records.append((o, it, items, r))

    # 遠端 jar：以 __REMOTE__ 標記，轉成 token 形式
    for o in owners:
        for s in o.sites:
            if str(s.get("jar", "")).startswith("__REMOTE__"):
                p = s["jar"][len("__REMOTE__"):]
                o.add(p, "jar/" + os.path.basename(p))
                s["jar"] = "@@" + p

    # 既有 direct*.json
    existing_cfgs = {}
    for name in ("direct.json", "direct18.json", "mix18.json"):
        p = os.path.join(DST, name)
        if not os.path.isfile(p):
            continue
        d = json.load(open(p))
        existing_cfgs[name] = d
        bysite = collections.OrderedDict()
        for s in d.get("sites", []):
            refs = [m.group(1) for x in strings(s) for m in TOKEN.finditer(x)]
            folder = None
            for t in refs:
                t2 = t[2:] if t.startswith("./") else t
                if "/" in t2:
                    folder = site_folder(t2)
                    break
            if folder:
                bysite.setdefault(folder, []).append(s)
        for folder, sites in bysite.items():
            owners.append(ExistingOwner(folder, DST, sites, name))
        owners.append(ExistingOwner(name, DST, [], name, top=d))  # 全域 spider 等頂層引用
    # mix.json 既有站點（續搬）
    if mix["sites"]:
        bysite = collections.OrderedDict()
        for s in mix["sites"]:
            refs = [m.group(1) for x in strings(s) for m in TOKEN.finditer(x)]
            folder = next((site_folder(t[2:]) for t in refs if t.startswith("./") and "/" in t[2:] and not t[2:].startswith(REF)), None)
            bysite.setdefault(folder or "__ref_only__", []).append(s)
        for folder, sites in bysite.items():
            owners.append(ExistingOwner(folder, DST, sites, "mix.json"))
    owners.append(ExistingOwner("mix.json", DST, [], "mix.json", top={"spider": mix.get("spider", ""), "parses": mix.get("parses", [])}))

    for o in owners:
        o.collect()

    # 深層雜湊 -> 擁有者集合
    usage = collections.defaultdict(set)
    for o in owners:
        for src in o.files:
            usage[node(src).deep()].add(o.folder)
    shared_dest = {}  # deep -> rel path under DST
    taken = {}
    # 既有 reference_file 中的檔案先占位
    for o in owners:
        for src, rel in o.files.items():
            if src.startswith(os.path.join(DST, REF) + os.sep):
                dp = os.path.relpath(src, DST).replace(os.sep, "/")
                shared_dest[node(src).deep()] = dp
                taken[dp] = node(src).deep()
    # 既有設定（direct*.json）的檔案優先取得原檔名
    for o in sorted(owners, key=lambda x: not isinstance(x, ExistingOwner)):
        for src, rel in o.files.items():
            dh = node(src).deep()
            if dh in shared_dest or len(usage[dh]) < 2:
                continue
            cat = category(rel)
            name = rel.split("/")[-1]
            dp = f"{REF}/{cat}/{name}"
            if dp in taken and taken[dp] != dh:
                # 同名不同內容：以來源 repo（與非分類的上層目錄）命名區分
                stem, ext = os.path.splitext(name)
                c = canon(src)
                if c.startswith(SRC + os.sep):
                    parts = os.path.relpath(c, SRC).split(os.sep)[:-1]
                    tag = "_".join([parts[0]] + [p for p in parts[1:] if p not in CATS])
                elif c.startswith(ASSETS):
                    tag = "app_assets"
                else:
                    tag = dh[:6]
                dp = f"{REF}/{cat}/{stem}.{tag}{ext}"
                if dp in taken and taken[dp] != dh:
                    dp = f"{REF}/{cat}/{stem}.{tag}.{dh[:6]}{ext}"
            shared_dest[dh] = dp
            taken[dp] = dh

    def dest_of(o, src):
        dh = node(src).deep()
        if dh in shared_dest:
            return shared_dest[dh]
        if isinstance(o, ExistingOwner) and src.startswith(DST + os.sep):
            return os.path.relpath(src, DST).replace(os.sep, "/")
        return f"{o.folder}/{o.files[src]}"

    def rel_spec(from_path, to_path):
        r = posixpath.relpath(to_path, posixpath.dirname(from_path))
        return r if r.startswith("../") else "./" + r

    # 寫檔
    writes = {}  # dest -> bytes
    for o in owners:
        for src in o.files:
            dp = dest_of(o, src)
            n = node(src)
            content = n.content
            if n.imports:
                text = content.decode("utf-8", "ignore")
                for spec, t in n.imports:
                    ns = rel_spec(dp, dest_of(o, t.src))
                    if ns != spec:
                        text = text.replace('"' + spec + '"', '"' + ns + '"').replace("'" + spec + "'", "'" + ns + "'")
                content = text.encode("utf-8")
            if dp in writes and writes[dp] != content:
                print("!! conflict", dp, o.folder)
            writes[dp] = content

    # 改寫站點與頂層字串
    def rewriter(o):
        def fn(s):
            if s.startswith("@@"):
                p = s[2:]
                dp = dest_of(o, p)
                return f"./{dp};md5;{md5b(writes[dp])}"

            def sub(m):
                p = resolve(m.group(1), o.base_dir)
                if not p or p not in o.files:
                    return m.group(1)
                return "./" + dest_of(o, p)

            out = TOKEN.sub(sub, s)
            # jar md5 校正
            mm = re.match(r"^\./([^;]+);md5;([0-9a-fA-F]*)$", out)
            if mm and mm.group(1) in writes:
                out = f"./{mm.group(1)};md5;{md5b(writes[mm.group(1)])}"
            return out
        return fn

    for o in owners:
        fn = rewriter(o)
        o.sites[:] = [walk(s, fn) for s in o.sites]
        if o.top:
            for k in list(o.top.keys()):
                if k in ("spider", "parses") or k == "wallpaper":
                    o.top[k] = walk(o.top[k], fn)

    # 舊檔（direct18 資料夾中已移至 reference_file 的檔案）要刪除
    removes = set()
    for o in owners:
        if isinstance(o, ExistingOwner):
            for src in o.files:
                cur = os.path.relpath(src, DST).replace(os.sep, "/")
                if src.startswith(DST + os.sep) and dest_of(o, src) != cur:
                    removes.add(cur)
    removes -= set(writes)

    # 組 mix.json
    new_sites = [s for o in owners if not isinstance(o, ExistingOwner) for s in o.sites]
    mix_sites = []
    for o in owners:
        if isinstance(o, ExistingOwner) and o.cfg_name == "mix.json":
            mix_sites += o.sites
    mix_sites += new_sites
    mix["sites"] = mix_sites
    # parses / flags
    parses = {json.dumps(p, sort_keys=True, ensure_ascii=False): p for p in mix.get("parses", [])}
    flags = list(mix.get("flags", []))
    for c in sorted(parse_cfgs):
        conf = cfg_json(c)
        for p in conf.get("parses", []) or []:
            parses.setdefault(json.dumps(p, sort_keys=True, ensure_ascii=False), p)
        for f in conf.get("flags", []) or []:
            if f not in flags:
                flags.append(f)
    mix["parses"] = list(parses.values())
    mix["flags"] = flags
    jars = collections.Counter(s.get("jar") for s in mix_sites if s.get("jar"))
    # 全域 spider 用 direct.json 的 jar（與本 App 相容，drpy2 的 pdfh 等函式由它提供）；csp 站點各自帶 jar
    dtop = next((o.top for o in owners if isinstance(o, ExistingOwner) and o.folder == "direct.json"), None)
    mix["spider"] = (dtop or {}).get("spider") or (jars.most_common(1)[0][0] if jars else "")
    mix_top = next(o for o in owners if isinstance(o, ExistingOwner) and o.folder == "mix.json")

    print(f"new sites: {len(new_sites)}, files to write: {len(writes)}, shared: {len(set(shared_dest.values()))}, removes: {len(removes)}")
    if dry:
        for o in owners[:0]:
            pass
        return
    for dp, content in writes.items():
        p = os.path.join(DST, dp)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        if not os.path.isfile(p) or open(p, "rb").read() != content:
            open(p, "wb").write(content)
    for rp in sorted(removes):
        p = os.path.join(DST, rp)
        if os.path.isfile(p):
            os.remove(p)
            d = os.path.dirname(p)
            while d != DST and os.path.isdir(d) and not os.listdir(d):
                os.rmdir(d)
                d = os.path.dirname(d)
    # 回寫 direct*.json
    for name, d in existing_cfgs.items():
        sites_out = []
        site_map = {}
        for o in owners:
            if isinstance(o, ExistingOwner) and o.cfg_name == name:
                for s in o.sites:
                    site_map[s["key"]] = s
        top = next(o.top for o in owners if isinstance(o, ExistingOwner) and o.folder == name)
        for s in d["sites"]:
            sites_out.append(site_map.get(s["key"], s))
        top["sites"] = sites_out
        json.dump(top, open(os.path.join(DST, name), "w"), ensure_ascii=False, indent=2)
    json.dump(mix, open(mix_path, "w"), ensure_ascii=False, indent=2)
    # move_list.txt
    today = datetime.date.today().isoformat()
    new_file = not os.path.isfile(ml)
    with open(ml, "a", encoding="utf-8") as f:
        if new_file:
            f.write("# 已搬入 mix.json / mix18.json 的點播源紀錄（續搬時以 原始設定檔+原始key 判斷是否已搬過）\n")
            f.write("# 欄位：資料夾\tkey\t名稱\t原始設定檔(相對 TV_Box_Sources)\t原始key\ttype\tapi\t驗證結果\t搬移日期\t相同內容的其他原始來源\t設定檔\n")
        for o, it, items, r in new_records:
            s = o.sites[0]
            verdict = "分類+播放" + ("+搜尋" if r.get("search_ok") else "") if r.get("pass_cat") else "搜尋+播放"
            others = ",".join(f"{x['cfg']}:{x['key']}" for x in items if (x["cfg"], x["key"]) != (it["cfg"], it["key"]))
            own = any(not dest_of(o, src).startswith(REF + "/") for src in o.files)
            folder = o.folder if own else ("（僅引用 reference_file 共用檔）" if o.files else "（無引用檔，直連 CMS）")
            f.write("\t".join([folder, s["key"], str(s.get("name")), it["cfg"], str(it["key"]), str(s.get("type")), str(it["site"].get("api")), verdict, today, others, "mix.json"]) + "\n")
    print("done")


if __name__ == "__main__":
    main()
