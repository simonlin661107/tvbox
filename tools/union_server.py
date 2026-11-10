"""本機來源伺服器：EXTRA_OVERLAY（測試用暫存設定，可多個以 : 分隔）優先，其次 overlay（補齊/修正檔），最後 TV_Box_Sources。"""
import os,sys,http.server,functools,urllib.parse
SRC=os.environ.get("TVBOX_SRC", "/home/tailon/github_projects/android_tvbox_app/TV_Box_Sources")
OV=os.path.join(os.path.dirname(os.path.abspath(__file__)),"overlay")
OVS=[d for d in os.environ.get("EXTRA_OVERLAY","").split(":") if d]+[OV]
class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self,path):
        p=super().translate_path(path)
        rel=os.path.relpath(p,SRC)
        for d in OVS:
            q=os.path.join(d,rel)
            if os.path.isfile(q): return q
        return p
    def log_message(self,*a): pass
port=int(sys.argv[1]) if len(sys.argv)>1 else 8765
http.server.ThreadingHTTPServer(("0.0.0.0",port),functools.partial(H,directory=SRC)).serve_forever()
