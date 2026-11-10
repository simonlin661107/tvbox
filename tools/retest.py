#!/usr/bin/env python3
"""未搬移點播源的再篩選：唯一條件是「能取得可播放的影片連結」。

與 harness.py 的差異：
- 以合成設定檔測試（放在 EXTRA_OVERLAY，與原設定檔同目錄，相對路徑照常可用）：
  全域 spider 換成 mix 用的 spider.jar（與部署後相同），csp 站點帶原設定檔的 jar；
  parses/flags = 原設定檔 + mix.json。
- 會讓 App 當機的 jar（xunlei 反竄改）不載入，改用 mix 的 spider.jar 嘗試（修復）。
- 取影片的來源更廣：分類（最多 5 個）、首頁推薦、搜尋（最多 4 個關鍵字）；每部影片最多 6 條線路。
- 串流驗證：ffprobe 失敗時，再以內容特徵檢查（m3u8 第一個分片 / MPD 第一個分段 / 直連檔頭）。

用法：
  retest.py build            產生合成設定檔與 plan（/tmp/retest）
  retest.py run [workers]    執行（結果寫到 RES，預設 /tmp/retest/results.json）
  retest.py single           把當機批次中的站點逐一重測
需要：union_server.py（EXTRA_OVERLAY=/tmp/retest/ov）、adb forward 9978、adb reverse 8765。
"""
import copy, collections, hashlib, json, os, re, subprocess, sys, threading, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
WORK = os.environ.get("RETEST_DIR", "/tmp/retest")
EXTRA = os.path.join(WORK, "ov")
os.environ.setdefault("RES", os.path.join(WORK, "results.json"))
import harness as H  # noqa: E402
import migrate as M  # noqa: E402

DST = os.path.dirname(HERE)
CRASH_MD5 = {"7c8f662c", "e58c3a29", "c9986646"}  # 前 8 碼
MIXJAR_REL = "__tvbox/spider.jar"
CHUNK = 30
WORDS = ["繁花", "庆余年", "斗罗大陆", "狂飙", "爱情", "海贼王"]
lock = threading.Lock()


def md5f(p):
    return hashlib.md5(open(p, "rb").read()).hexdigest()


def load_cfg(rel):
    p = M.phys(os.path.join(M.SRC, rel))
    t = open(p, encoding="utf-8", errors="ignore").read()
    try:
        return json.loads(t)
    except Exception:
        return json.loads(re.sub(r"^\s*//.*$", "", t, flags=re.M))


def jar_md5(spec, base):
    if not spec:
        return None
    u = spec.split(";")[0]
    if u.startswith("img+"):
        u = u[4:]
    if u.startswith("http"):
        p = M.download(u)
    else:
        p = M.resolve(u, base)
    return md5f(p) if p else None


def moved_set():
    s = set()
    for line in open(os.path.join(DST, "move_list.txt"), encoding="utf-8"):
        if line.startswith("#") or not line.strip():
            continue
        c = line.rstrip("\n").split("\t")
        s.add((c[3], c[4]))
    return s


def build():
    groups = json.load(open(os.path.join(HERE, "groups.json")))
    old = json.load(open(os.path.join(HERE, "results_all.json")))
    mix = json.load(open(os.path.join(DST, "mix.json")))
    moved = moved_set()
    os.makedirs(os.path.join(EXTRA, "__tvbox"), exist_ok=True)
    open(os.path.join(EXTRA, MIXJAR_REL), "wb").write(open(os.path.join(DST, "reference_file/jar/spider.jar"), "rb").read())
    mixjar = H.SRV + MIXJAR_REL
    bycfg = collections.OrderedDict()
    for gid, (gk, items) in enumerate(groups):
        if any((it["cfg"], it["key"]) in moved for it in items):
            continue
        rc = ((old.get(str(gid)) or {}).get("cfg") or "").replace("_nojar.json", ".json")
        it = next((x for x in items if x["cfg"] == rc), items[0])
        bycfg.setdefault(it["cfg"], []).append((gid, it))
    plan = []
    nover = 0
    for cfg, lst in bycfg.items():
        try:
            conf = load_cfg(cfg)
        except Exception as e:
            print("cfg fail", cfg, e)
            continue
        base = os.path.dirname(os.path.join(M.SRC, cfg))
        top = {k: v for k, v in conf.items() if k not in ("sites", "lives", "spider", "parses", "flags")}
        top["spider"] = mixjar
        parses = collections.OrderedDict()
        for p in (conf.get("parses") or []) + mix["parses"]:
            if isinstance(p, dict):
                parses.setdefault(p.get("url") or json.dumps(p, sort_keys=True), p)
        top["parses"] = list(parses.values())
        top["flags"] = list(dict.fromkeys((conf.get("flags") or []) + mix.get("flags", [])))
        sites = []
        for gid, it in lst:
            fixed = next((x for x in conf.get("sites", []) if isinstance(x, dict) and x.get("key") == it["key"]), None)
            s = copy.deepcopy(fixed or it["site"])
            ov = None
            if str(s.get("api", "")).startswith("csp_"):
                if not s.get("jar"):
                    s["jar"] = conf.get("spider", "") or ""
                m5 = jar_md5(s["jar"], base)
                if m5 and m5[:8] in CRASH_MD5:
                    s["jar"] = mixjar
                    ov = "mixjar"
                    nover += 1
                if not s["jar"]:
                    s.pop("jar")
            sites.append((gid, it, s, ov))
        d = os.path.dirname(cfg)
        b = os.path.splitext(os.path.basename(cfg))[0]
        for i in range(0, len(sites), CHUNK):
            chunk = sites[i:i + CHUNK]
            rel = posix_join(d, f"__retest_{b}_{i // CHUNK}.json")
            out = dict(top, sites=[s for _, _, s, _ in chunk])
            p = os.path.join(EXTRA, rel)
            os.makedirs(os.path.dirname(p), exist_ok=True)
            json.dump(out, open(p, "w"), ensure_ascii=False, indent=1)
            plan.append(dict(cfg=rel, src_cfg=cfg, sites=[dict(gid=str(g), key=s["key"], name=s.get("name"), override=ov) for g, it, s, ov in chunk]))
    json.dump(plan, open(os.path.join(WORK, "plan.json"), "w"), ensure_ascii=False, indent=1)
    print("batches", len(plan), "sites", sum(len(e["sites"]) for e in plan), "jar overrides", nover)


def posix_join(a, b):
    return f"{a}/{b}" if a else b


# ---------- 串流驗證 ----------
def is_media(b):
    if len(b) < 16:
        return False
    if b[4:8] in (b"ftyp", b"moof", b"sidx", b"styp", b"moov", b"free", b"mdat"):
        return True
    if b[:3] in (b"FLV", b"ID3") or b[:4] in (b"\x1aE\xdf\xa3", b"OggS", b"fLaC"):
        return True
    if b[0] == 0xFF and (b[1] & 0xE0) == 0xE0:  # mp3/aac
        return True
    for i in range(min(len(b) - 400, 4096)):  # MPEG-TS（含偽裝成圖片的分片）
        if b[i] == 0x47 and b[i + 188] == 0x47 and b[i + 376] == 0x47:
            return True
    return False


def fetch(url, header, n=8192):
    h = {"User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36"}
    h.update(header or {})
    h["Range"] = f"bytes=0-{n - 1}"
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read(n), r.geturl()


def content_check(url, header, depth=0):
    b, final = fetch(url, header, 65536)
    if is_media(b):
        return True, "media-bytes"
    t = b.decode("utf-8", "ignore")
    if t.lstrip().startswith("#EXTM3U") and depth < 3:
        lines = [x.strip() for x in t.splitlines()]
        if any(x.startswith("#EXT-X-STREAM-INF") for x in lines):
            nxt = next((x for x in lines if x and not x.startswith("#")), None)
            return content_check(urllib.parse.urljoin(final, nxt), header, depth + 1) if nxt else (False, "m3u8 no variant")
        if any(x.startswith("#EXT-X-KEY") and "NONE" not in x for x in lines):
            seg = next((x for x in lines if x and not x.startswith("#")), None)
            if seg:
                fetch(urllib.parse.urljoin(final, seg), header, 1024)
                return True, "m3u8 encrypted segment reachable"
        seg = next((x for x in lines if x and not x.startswith("#")), None)
        if not seg:
            return False, "m3u8 no segment"
        sb, _ = fetch(urllib.parse.urljoin(final, seg), header, 65536)
        return (True, "m3u8 segment") if is_media(sb) else (False, "m3u8 segment not media")
    if "<MPD" in t and depth < 3:
        m = re.search(r"<BaseURL>([^<]+)</BaseURL>", t)
        if m:
            u = urllib.parse.urljoin(final, m.group(1).replace("&amp;", "&"))
            hdr = dict(header or {})
            if "bilivideo" in u or "bilibili" in u:
                hdr.setdefault("Referer", "https://www.bilibili.com/")
            sb, _ = fetch(u, hdr, 65536)
            return (True, "mpd baseurl") if is_media(sb) else (False, "mpd segment not media")
        return False, "mpd no baseurl"
    return False, "not media"


def probe2(url, header):
    ok, why = H.probe(url, header)
    if ok or not url.startswith("http"):
        return ok, why
    try:
        ok2, why2 = content_check(url, header)
        return ok2, ("fallback:" + why2) if ok2 else why + " | " + why2
    except Exception as e:
        return False, why + " | fallback err " + str(e)[:80]


# ---------- 單站測試 ----------
def detail_play(key, vods, log, deadline):
    for vod in vods[:3]:
        if time.time() > deadline:
            return None
        vid = vod.get("vod_id")
        if not vid:
            continue
        d = H.api("detail", 30, key=key, id=vid)
        lst = (d.get("result") or {}).get("list") or [] if d.get("ok") else []
        if not lst:
            log.append(f"detail fail id={str(vid)[:50]} err={str(d.get('error','empty'))[:80]}")
            continue
        v = lst[0]
        eps = H.episodes(v)
        if not eps:
            log.append(f"detail no play url id={str(vid)[:50]}")
            continue
        for flag, eid, n in eps[:6]:
            if time.time() > deadline:
                return None
            p = H.api("parse", 45, key=key, flag=flag, id=eid)
            if not p.get("ok"):
                log.append(f"parse err flag={flag} {str(p.get('error'))[:120]}")
                continue
            r = p.get("result") or {}
            url = r.get("url") or ""
            hdr = {k: v2 for k, v2 in (r.get("header") or {}).items() if k.lower() not in ("range", "accept-encoding") and not k.lower().startswith("sec-")}
            ok, why = probe2(url, hdr)
            log.append(f"probe flag={flag} needParse={r.get('needParse')} ok={ok} {why[:100]} url={url[:120]}")
            if ok:
                return dict(vod=v.get("vod_name"), flag=flag, eps=n, url=url[:300], probe=why, needParse=r.get("needParse"), useParse=r.get("useParse"), jxfrom=r.get("from"), raw=(r.get("raw") or "")[:200])
    return None


def test_site(key, budget=300):
    t0 = time.time()
    deadline = t0 + budget
    log = []
    out = dict(key=key)
    h = H.api("home", 40, key=key)
    hr = h.get("result") or {} if h.get("ok") else {}
    types = hr.get("class") or []
    hlist = [v for v in (hr.get("list") or []) if v.get("vod_id")]
    out["home"] = dict(ok=h.get("ok"), types=len(types), list=len(hlist), err=str(h.get("error"))[:150] if h.get("error") else None)
    names = []
    # 1) 分類
    for t in types[:5]:
        if time.time() > deadline:
            break
        c = H.api("category", 30, key=key, tid=t.get("type_id"), pg="1")
        cl = [v for v in ((c.get("result") or {}).get("list") or [] if c.get("ok") else []) if v.get("vod_id")]
        out.setdefault("cat", []).append(dict(tid=t.get("type_id"), n=len(cl), err=str(c.get("error"))[:100] if c.get("error") else None))
        if cl:
            names += [v.get("vod_name") for v in cl[:3]]
            info = detail_play(key, cl, log, deadline)
            if info:
                out.update(catpath=dict(detail=True, play=True, info=info), pass_cat=True, how="category")
                break
    # 2) 首頁推薦
    if not out.get("how") and hlist and time.time() < deadline:
        names += [v.get("vod_name") for v in hlist[:3]]
        info = detail_play(key, hlist, log, deadline)
        if info:
            out.update(catpath=dict(detail=True, play=True, info=info), pass_cat=True, how="home")
    # 3) 搜尋（也用來判斷 searchable）
    words = []
    for n in names:
        n = (n or "").strip()
        if n:
            w = re.split(r"[ （(【\[:：第]", n)[0] or n
            if w not in words:
                words.append(w)
    words = words[:2] + [w for w in WORDS if w not in words]
    s_ok = False
    for w in words[:4]:
        if time.time() > deadline:
            break
        s = H.api("search", 30, key=key, wd=w)
        sl = [v for v in ((s.get("result") or {}).get("list") or [] if s.get("ok") else []) if v.get("vod_id")]
        out.setdefault("search", []).append(dict(wd=w, n=len(sl), err=str(s.get("error"))[:100] if s.get("error") else None))
        if sl:
            s_ok = True
            if out.get("how"):
                break
            info = detail_play(key, sl, log, deadline)
            if info:
                out.update(searchpath=dict(detail=True, play=True, info=info), how="search")
                break
    out["search_ok"] = s_ok
    out["pass_cat"] = bool(out.get("pass_cat"))
    out["pass"] = bool(out.get("how"))
    out["log"] = log[-14:]
    out["secs"] = round(time.time() - t0, 1)
    return out


# ---------- 執行 ----------
def sh(c):
    return subprocess.run(c, shell=True, capture_output=True, text=True).stdout


def crashed():
    return int(sh("adb logcat -d -b crash | grep -c 'Abort message\\|FATAL EXCEPTION'").strip() or 0)


def run_batch(e, results, workers):
    sh("adb logcat -c -b crash")
    H.ensure_alive()
    todo = [s for s in e["sites"] if s["gid"] not in results]
    if not todo:
        return
    print(f"== {e['src_cfg']} -> {e['cfg']} ({len(todo)} sites)", flush=True)
    ld = H.api("load", 120, url=H.SRV + urllib.parse.quote(e["cfg"]))
    if not ld.get("ok"):
        H.restart_app()
        ld = H.api("load", 120, url=H.SRV + urllib.parse.quote(e["cfg"]))
    if not ld.get("ok"):
        print("   load fail", ld.get("error"), flush=True)
        for s in todo:
            results[s["gid"]] = dict(key=s["key"], name=s["name"], cfg=e["src_cfg"], pass_=False, loadfail=str(ld.get("error"))[:200], gid=s["gid"])
        H.save_results(results)
        return
    keys = {x["key"] for x in ld.get("result") or []}

    def one(s):
        if s["key"] not in keys:
            return s, dict(key=s["key"], pass_=False, err="key not loaded")
        try:
            return s, test_site(s["key"])
        except Exception as ex:
            return s, dict(key=s["key"], pass_=False, err=str(ex)[:200])

    with ThreadPoolExecutor(workers) as ex:
        for s, r in ex.map(one, todo):
            r.update(gid=s["gid"], name=s["name"], cfg=e["src_cfg"], override=s.get("override"), batch=e["cfg"])
            with lock:
                results[s["gid"]] = r
                H.save_results(results)
            print(f"   [{'PASS' if r.get('pass') else 'fail'}] {s['key']} {s['name']} how={r.get('how')} search={r.get('search_ok')} {r.get('secs')}s", flush=True)
            if not H.alive():
                print("   app down, restarting & reloading", flush=True)
                H.ensure_alive()
                H.api("load", 120, url=H.SRV + urllib.parse.quote(e["cfg"]))
    if crashed():
        print(f"!! {e['cfg']} 期間 App 當機，失敗結果標記為待逐一重測", flush=True)
        for s in e["sites"]:
            r = results.get(s["gid"])
            if r and not r.get("pass"):
                r["crash_batch"] = True
        H.save_results(results)
        H.restart_app()


def main():
    cmd = sys.argv[1]
    if cmd == "build":
        return build()
    plan = json.load(open(os.path.join(WORK, "plan.json")))
    results = H.load_results()
    if cmd == "run":
        workers = int(sys.argv[2]) if len(sys.argv) > 2 else 4
        for e in plan:
            run_batch(e, results, workers)
    elif cmd == "single":
        # 當機批次 / 並行造成的失敗：逐站單獨重測
        # App 當掉 / 重啟期間的請求（Connection refused、Remote end closed）也不可信
        flaky = ("Rejected", "Connection refused", "Remote end closed")
        redo = {g for g, r in results.items() if not r.get("pass") and (r.get("crash_batch") or r.get("err") or any(k in json.dumps(r) for k in flaky))}
        for e in plan:
            for s in e["sites"]:
                if s["gid"] in redo:
                    results.pop(s["gid"], None)
                    run_batch(dict(e, sites=[s]), results, 1)


if __name__ == "__main__":
    main()
