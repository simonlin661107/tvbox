#!/usr/bin/env python3
"""逐一設定檔重測（避免某個 jar 讓 App 當機後連鎖失敗）。
當機時：暫時以 overlay 放一個空殼設定檔讓 App 重新啟動時不再載入有問題的 jar，再恢復。
用法：redo.py <plan.json>   （結果寫到 RES 環境變數指定的檔案）
"""
import json, os, subprocess, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.argv_backup = list(sys.argv)
import harness

HERE = os.path.dirname(os.path.abspath(__file__))
OVERLAY = os.path.join(HERE, "overlay")
SAFE = "qist_tvbox/dianshi.json"


def sh(c):
    return subprocess.run(c, shell=True, capture_output=True, text=True).stdout


def crashed():
    return int(sh("adb logcat -d -b crash | grep -c 'Abort message' ").strip() or 0)


def recover(cfg):
    stub = os.path.join(OVERLAY, cfg)
    had = os.path.isfile(stub)
    bak = open(stub, "rb").read() if had else None
    os.makedirs(os.path.dirname(stub), exist_ok=True)
    open(stub, "w").write('{"sites":[{"key":"stub","name":"stub","type":1,"api":"http://127.0.0.1:1/"}]}')
    try:
        sh("adb shell am force-stop com.fongmi.android.tv; adb shell monkey -p com.fongmi.android.tv -c android.intent.category.LAUNCHER 1")
        time.sleep(8)
        sh("adb forward tcp:9978 tcp:9978; adb reverse tcp:8765 tcp:8765")
        harness.api("load", 90, url=harness.SRV + SAFE)
        time.sleep(5)
    finally:
        if had:
            open(stub, "wb").write(bak)
        else:
            os.remove(stub)


def main():
    plan = json.load(open(sys.argv[1]))
    for e in plan:
        sh("adb logcat -c -b crash")
        tmp = os.path.join(HERE, "_one.json")
        json.dump([e], open(tmp, "w"), ensure_ascii=False)
        harness.main(tmp, 1 if e.get("serial") else 4)
        if crashed():
            print(f"!! {e['cfg']} 造成 App 當機", flush=True)
            recover(e["cfg"])
            # 當機期間測得的結果不可信：標記讓之後判斷
            r = harness.load_results()
            for s in e["sites"]:
                v = r.get(s["gid"]) or r.get(str(s["gid"]))
                if v and not v.get("pass"):
                    v["crash_cfg"] = True
            harness.save_results(r)


if __name__ == "__main__":
    main()
