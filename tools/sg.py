import json,sys,urllib.request,urllib.parse
def sg(q, n=30):
    url="https://sourcegraph.com/.api/search/stream?"+urllib.parse.urlencode({"q":q,"display":n})
    req=urllib.request.Request(url,headers={"Accept":"text/event-stream","User-Agent":"Mozilla/5.0"})
    out=[];ev=None
    for line in urllib.request.urlopen(req,timeout=60).read().decode("utf-8","ignore").splitlines():
        if line.startswith("event:"): ev=line[6:].strip()
        elif line.startswith("data:") and ev=="matches":
            for m in json.loads(line[5:]): out.append((m.get("repository"),m.get("commit"),m.get("path")))
    return out
if __name__=="__main__":
    for r in sg(sys.argv[1]): print(*r)
