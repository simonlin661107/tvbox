#!/usr/bin/env python3
"""TVBox 點播源自動驗證。透過 App 的 /spider 除錯端點呼叫爬蟲，主機端以 ffprobe 驗證串流。"""
import json, os, re, subprocess, sys, time, threading, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

APP = "http://127.0.0.1:9978/spider"
SRV = os.environ.get("SRV", "http://127.0.0.1:8765/")
RES = os.environ.get("RES", os.path.join(os.path.dirname(os.path.abspath(__file__)), "results.json"))
lock = threading.Lock()
FALLBACK_WORDS = ["斗罗大陆", "庆余年", "繁花", "爱情"]


def api(do, timeout=30, **kw):
    kw["do"] = do
    kw["timeout"] = str(timeout)
    url = APP + "?" + urllib.parse.urlencode(kw)
    try:
        with urllib.request.urlopen(url, timeout=timeout + 20) as r:
            return json.loads(r.read().decode("utf-8", "ignore"))
    except Exception as e:
        return {"ok": False, "error": "http:" + str(e)[:200]}


def alive():
    try:
        with urllib.request.urlopen(APP + "?do=sites", timeout=10) as r:
            return True
    except Exception:
        return False


def restart_app():
    subprocess.run("adb shell am force-stop com.fongmi.android.tv; adb shell monkey -p com.fongmi.android.tv -c android.intent.category.LAUNCHER 1", shell=True, capture_output=True)
    time.sleep(8)
    subprocess.run("adb forward tcp:9978 tcp:9978; adb reverse tcp:8765 tcp:8765", shell=True, capture_output=True)


def ensure_alive():
    for _ in range(3):
        if alive():
            return True
        restart_app()
    return alive()


def get_url(res):
    u = res.get("url")
    if isinstance(u, dict):
        vals = u.get("values") or []
        return vals[0].get("v", "") if vals else ""
    return u or ""


forwarded = set()


def probe(url, header):
    if not url or not url.startswith("http"):
        return False, "bad url: " + str(url)[:120]
    m = re.match(r"https?://(127\.0\.0\.1|localhost):(\d+)", url)
    if m and m.group(2) not in forwarded:
        subprocess.run(f"adb forward tcp:{m.group(2)} tcp:{m.group(2)}", shell=True, capture_output=True)
        forwarded.add(m.group(2))
    header = dict(header or {})
    ua = None
    for k in list(header):
        if k.lower() == "user-agent":
            ua = header.pop(k)
    cmd = ["ffprobe", "-v", "error", "-rw_timeout", "15000000", "-show_entries", "stream=codec_type", "-of", "json"]
    cmd += ["-user_agent", ua or "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36"]
    if header:
        cmd += ["-headers", "".join(f"{k}: {v}\r\n" for k, v in header.items())]
    cmd += ["-allowed_extensions", "ALL", "-extension_picky", "0", "-i", url] if ".m3u8" in url else ["-i", url]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
        try:
            streams = json.loads(p.stdout or "{}").get("streams", [])
        except Exception:
            streams = []
        types = {s.get("codec_type") for s in streams}
        if "video" in types or "audio" in types:
            return True, ",".join(sorted(t for t in types if t))
        # 舊版 ffprobe 不支援 -extension_picky 時重試
        if "extension_picky" in (p.stderr or "") or "Unrecognized option" in (p.stderr or ""):
            cmd2 = [c for c in cmd if c not in ("-extension_picky", "0")]
            p = subprocess.run(cmd2, capture_output=True, text=True, timeout=45)
            streams = json.loads(p.stdout or "{}").get("streams", [])
            types = {s.get("codec_type") for s in streams}
            if "video" in types or "audio" in types:
                return True, ",".join(sorted(t for t in types if t))
        return False, (p.stderr or "no stream").strip()[-200:]
    except subprocess.TimeoutExpired:
        return False, "ffprobe timeout"


def episodes(vod):
    froms = (vod.get("vod_play_from") or "").split("$$$")
    urls = (vod.get("vod_play_url") or "").split("$$$")
    out = []
    for i, f in enumerate(froms):
        if i >= len(urls):
            break
        eps = [e for e in urls[i].split("#") if e]
        if not eps:
            continue
        first = eps[0]
        eid = first.split("$", 1)[1] if "$" in first else first
        out.append((f, eid, len(eps)))
    return out


def try_detail_play(key, vods, log):
    """對候選影片取詳情並嘗試播放，回傳 (detail_ok, play_ok, info)。"""
    detail_ok = False
    for vod in vods[:3]:
        vid = vod.get("vod_id")
        if not vid:
            continue
        d = api("detail", 30, key=key, id=vid)
        lst = (d.get("result") or {}).get("list") or [] if d.get("ok") else []
        if not lst:
            log.append(f"detail fail id={str(vid)[:60]} err={d.get('error','empty')}")
            continue
        v = lst[0]
        eps = episodes(v)
        if not eps:
            log.append(f"detail no play url id={str(vid)[:60]}")
            continue
        detail_ok = True
        for flag, eid, n in eps[:4]:
            p = api("parse", 45, key=key, flag=flag, id=eid)
            if not p.get("ok"):
                log.append(f"play/parse err flag={flag} {str(p.get('error'))[:150]}")
                continue
            r = p.get("result") or {}
            url = r.get("url") or ""
            hdr = {k: v for k, v in (r.get("header") or {}).items() if k.lower() not in ("range", "accept-encoding") and not k.lower().startswith("sec-")}
            ok, why = probe(url, hdr)
            log.append(f"probe flag={flag} needParse={r.get('needParse')} ok={ok} {why[:100]} url={url[:120]}")
            if ok:
                return True, True, dict(vod=v.get("vod_name"), flag=flag, eps=n, url=url[:300], probe=why, needParse=r.get("needParse"), useParse=r.get("useParse"), jxfrom=r.get("from"), raw=(r.get("raw") or "")[:200])
    return detail_ok, False, None


def test_site(site):
    key = site["key"]
    log = []
    out = dict(key=key, name=site.get("name"), cfg=site.get("_cfg"), t0=time.time())
    h = api("home", 40, key=key)
    hr = h.get("result") or {} if h.get("ok") else {}
    types = hr.get("class") or []
    hlist = hr.get("list") or []
    out["home"] = dict(ok=h.get("ok"), types=len(types), list=len(hlist), err=h.get("error"))
    clist = []
    for t in types[:3]:
        c = api("category", 30, key=key, tid=t.get("type_id"), pg="1")
        clist = (c.get("result") or {}).get("list") or [] if c.get("ok") else []
        out.setdefault("cat", []).append(dict(tid=t.get("type_id"), name=t.get("type_name"), n=len(clist), err=c.get("error")))
        if clist:
            break
    path_a = None
    vods = [v for v in clist if v.get("vod_id")] or [v for v in hlist if v.get("vod_id")]
    if types and clist:
        d_ok, p_ok, info = try_detail_play(key, vods, log)
        out["catpath"] = dict(detail=d_ok, play=p_ok, info=info)
        path_a = p_ok
    # 搜尋
    words = []
    for v in (clist or hlist)[:3]:
        n = (v.get("vod_name") or "").strip()
        if n:
            words.append(re.split(r"[ （(【\[:：第]", n)[0] or n)
    words += FALLBACK_WORDS
    seen = set()
    s_ok = False
    for w in words:
        if w in seen or len(seen) >= 3:
            continue
        seen.add(w)
        s = api("search", 30, key=key, wd=w)
        slist = (s.get("result") or {}).get("list") or [] if s.get("ok") else []
        out.setdefault("search", []).append(dict(wd=w, n=len(slist), err=s.get("error")))
        if slist:
            s_ok = True
            if not path_a:
                d_ok, p_ok, info = try_detail_play(key, slist, log)
                out["searchpath"] = dict(detail=d_ok, play=p_ok, info=info)
            break
    out["search_ok"] = s_ok
    path_b = bool(out.get("searchpath", {}).get("play")) or (s_ok and path_a)
    out["pass_cat"] = bool(path_a)
    out["pass_search"] = bool(path_b)
    out["pass"] = bool(path_a or path_b)
    out["log"] = log[-12:]
    out["secs"] = round(time.time() - out.pop("t0"), 1)
    return out


def load_results():
    try:
        return json.load(open(RES))
    except Exception:
        return {}


def save_results(r):
    tmp = RES + ".tmp"
    json.dump(r, open(tmp, "w"), ensure_ascii=False, indent=1)
    os.replace(tmp, RES)


def main(plan_file, workers=4):
    plan = json.load(open(plan_file))  # [{cfg, sites:[{gid,key,name}]}]
    results = load_results()
    for entry in plan:
        cfg = entry["cfg"]
        todo = [s for s in entry["sites"] if s["gid"] not in results]
        if not todo:
            continue
        ensure_alive()
        print(f"== load {cfg} ({len(todo)} sites)", flush=True)
        ld = api("load", 90, url=SRV + urllib.parse.quote(cfg))
        if not ld.get("ok") and ("timeout" in str(ld.get("error")) or "http:" in str(ld.get("error"))):
            # App 可能卡住：重啟後再試一次
            print("   load stuck, restart & retry", flush=True)
            restart_app()
            ld = api("load", 120, url=SRV + urllib.parse.quote(cfg))
            if not ld.get("ok"):
                restart_app()  # 不要讓卡住的狀態影響下一個設定檔
        if not ld.get("ok"):
            print("   load fail", ld.get("error"), flush=True)
            for s in todo:
                results[s["gid"]] = dict(key=s["key"], name=s.get("name"), cfg=cfg, pass_=False, loadfail=ld.get("error"))
            save_results(results)
            continue
        keys = {x["key"] for x in ld.get("result") or []}

        def run(s):
            if s["key"] not in keys:
                return s, dict(key=s["key"], cfg=cfg, pass_=False, err="key not loaded")
            s2 = dict(s, _cfg=cfg)
            try:
                return s, test_site(s2)
            except Exception as e:
                return s, dict(key=s["key"], cfg=cfg, pass_=False, err=str(e)[:200])

        with ThreadPoolExecutor(workers) as ex:
            for s, r in ex.map(run, todo):
                r["gid"] = s["gid"]
                with lock:
                    results[s["gid"]] = r
                    save_results(results)
                print(f"   [{'PASS' if r.get('pass') else 'fail'}] {s['key']} {s.get('name')} cat={r.get('pass_cat')} search={r.get('search_ok')} {r.get('secs')}s", flush=True)
                if not alive():
                    print("   app down, restarting & reloading", flush=True)
                    ensure_alive()
                    api("load", 90, url=SRV + urllib.parse.quote(cfg))


if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 4)
