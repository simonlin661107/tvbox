"""本機來源伺服器：overlay（補齊/修正檔）優先，其次 TV_Box_Sources。"""
import os,sys,http.server,functools,urllib.parse
SRC=os.environ.get("TVBOX_SRC", "/home/tailon/github_projects/android_tvbox_app/TV_Box_Sources")
OV=os.path.join(os.path.dirname(os.path.abspath(__file__)),"overlay")
class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self,path):
        p=super().translate_path(path)
        rel=os.path.relpath(p,SRC)
        q=os.path.join(OV,rel)
        return q if os.path.isfile(q) else p
    def log_message(self,*a): pass
port=int(sys.argv[1]) if len(sys.argv)>1 else 8765
http.server.ThreadingHTTPServer(("0.0.0.0",port),functools.partial(H,directory=SRC)).serve_forever()
