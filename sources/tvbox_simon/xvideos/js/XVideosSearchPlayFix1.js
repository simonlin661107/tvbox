var rule = {
    title: 'XVideos',
    host: 'https://www.xvideos.com',
    homeUrl: '/',
    searchUrl: '/?k=**',
    headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://www.xvideos.com/'
    },
    timeout: 10000,
    class_name: '推荐&最佳&中文&亚洲',
    class_url: 'home&best&zh&asia',
    limit: 20,
    searchable: 1,
    quickSearch: 1,
    filterable: 0,
    play_parse: true,
    lazy: `js:
        if (/^https?:\\/\\//.test(input)) {
            input = {
                jx: 0,
                parse: 0,
                url: input,
                header: JSON.stringify({
                    'user-agent': 'Mozilla/5.0',
                    'referer': HOST + '/',
                    'origin': HOST,
                    'accept': '*/*'
                })
            };
        } else {
            input = {
                jx: 1,
                parse: 1,
                url: input
            };
        }
    `,
    推荐: `js:
        function decodeText(s) {
            return (s || '')
                .replace(/&#0*39;/g, "'")
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/\\s+/g, ' ')
                .trim();
        }
        function parseCards(html) {
            let list = [];
            let seen = {};
            let blocks = html.match(/<div id="video_[\\s\\S]*?<script>xv\\.thumbs\\.prepareVideo\\([^<]+<\\/script><\\/div>/ig) || [];
            blocks.forEach(function (block) {
                let vm = block.match(/<a href="(\\/video\\.[^"]+)"[^>]*title="([^"]*)"/i);
                if (!vm) return;
                let url = vm[1];
                if (seen[url]) return;
                let title = decodeText(vm[2]);
                let pic = '';
                let pm = block.match(/data-src="([^"]+)"/i) || block.match(/data-sfwthumb="([^"]+)"/i) || block.match(/src="([^"]+xvideos-cdn[^"]+)"/i);
                if (pm) pic = pm[1].replace(/&amp;/g, '&');
                let remark = '';
                let rm = block.match(/<span class="duration">([^<]+)<\\/span>/i);
                if (rm) remark = decodeText(rm[1]);
                if (!title) {
                    let tm = block.match(/<p class="title"><a [^>]*>([\\s\\S]*?)<span class="duration">/i);
                    if (tm) title = decodeText(tm[1].replace(/<[^>]+>/g, ''));
                }
                if (!title) return;
                seen[url] = 1;
                list.push({
                    vod_id: HOST + url,
                    vod_name: title,
                    vod_pic: pic,
                    vod_remarks: remark || 'XVideos'
                });
            });
            return list;
        }
        let html = request(HOST + '/');
        VODS = parseCards(html).slice(0, 20);
    `,
    一级: `js:
        function decodeText(s) {
            return (s || '')
                .replace(/&#0*39;/g, "'")
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/\\s+/g, ' ')
                .trim();
        }
        function parseCards(html) {
            let list = [];
            let seen = {};
            let blocks = html.match(/<div id="video_[\\s\\S]*?<script>xv\\.thumbs\\.prepareVideo\\([^<]+<\\/script><\\/div>/ig) || [];
            blocks.forEach(function (block) {
                let vm = block.match(/<a href="(\\/video\\.[^"]+)"[^>]*title="([^"]*)"/i);
                if (!vm) return;
                let url = vm[1];
                if (seen[url]) return;
                let title = decodeText(vm[2]);
                let pic = '';
                let pm = block.match(/data-src="([^"]+)"/i) || block.match(/data-sfwthumb="([^"]+)"/i) || block.match(/src="([^"]+xvideos-cdn[^"]+)"/i);
                if (pm) pic = pm[1].replace(/&amp;/g, '&');
                let remark = '';
                let rm = block.match(/<span class="duration">([^<]+)<\\/span>/i);
                if (rm) remark = decodeText(rm[1]);
                if (!title) {
                    let tm = block.match(/<p class="title"><a [^>]*>([\\s\\S]*?)<span class="duration">/i);
                    if (tm) title = decodeText(tm[1].replace(/<[^>]+>/g, ''));
                }
                if (!title) return;
                seen[url] = 1;
                list.push({
                    vod_id: HOST + url,
                    vod_name: title,
                    vod_pic: pic,
                    vod_remarks: remark || 'XVideos'
                });
            });
            return list;
        }
        let url = HOST + '/';
        if (MY_CATE === 'best') url = HOST + '/best';
        else if (MY_CATE === 'zh') url = HOST + '/lang/chinese';
        else if (MY_CATE === 'asia') url = HOST + '/c/Asian_Woman-32';
        let html = request(url);
        VODS = parseCards(html);
    `,
    二级: `js:
        function decodeText(s) {
            return (s || '')
                .replace(/\\\\'/g, "'")
                .replace(/\\"/g, '"')
                .replace(/&#0*39;/g, "'")
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&')
                .replace(/\\s+/g, ' ')
                .trim();
        }
        let html = request(input);
        let title = '';
        let pic = '';
        let content = '';
        let remark = '';
        let playUrls = [];
        let seen = {};
        let tm = html.match(/html5player\\.setVideoTitle\\('([\\s\\S]*?)'\\);/);
        if (tm) title = decodeText(tm[1]);
        if (!title) title = decodeText(pdfh(html, 'title&&Text').replace(/ - XVIDEOS\\.COM.*/i, ''));
        let pm = html.match(/html5player\\.setThumbUrl\\('([^']+)'\\);/) || html.match(/html5player\\.setThumbUrl169\\('([^']+)'\\);/);
        if (pm) pic = pm[1].replace(/&amp;/g, '&');
        if (!pic) pic = pdfh(html, 'meta[property=og:image]&&content') || '';
        let cm = html.match(/<meta name="description" content="([^"]+)"/i);
        if (cm) content = decodeText(cm[1]);
        let rm = html.match(/<meta property="og:duration" content="(\\d+)"/i);
        if (rm) {
            let sec = parseInt(rm[1], 10);
            if (!isNaN(sec)) {
                let m = Math.floor(sec / 60);
                let s = sec % 60;
                remark = m + ':' + (s < 10 ? '0' + s : s);
            }
        }
        function push(label, url) {
            let u = (url || '').trim();
            if (!u || seen[u]) return;
            seen[u] = 1;
            playUrls.push(label + '$' + u);
        }
        let hls = html.match(/html5player\\.setVideoHLS\\('([^']+)'\\);/);
        if (hls) push('HLS', hls[1].replace(/&amp;/g, '&'));
        let high = html.match(/html5player\\.setVideoUrlHigh\\('([^']+)'\\);/);
        if (high) push('MP4-High', high[1].replace(/&amp;/g, '&'));
        let low = html.match(/html5player\\.setVideoUrlLow\\('([^']+)'\\);/);
        if (low) push('MP4-Low', low[1].replace(/&amp;/g, '&'));
        VOD = {
            vod_name: title || 'XVideos',
            vod_pic: pic,
            vod_remarks: remark || 'XVideos',
            vod_content: content,
            vod_play_from: playUrls.length ? 'XVideos' : '',
            vod_play_url: playUrls.join('#')
        };
    `,
    搜索: `js:
        function uniq(arr) {
            let out = [];
            let seen = {};
            arr.forEach(function (it) {
                let s = (it || '').trim();
                if (s && !seen[s]) {
                    seen[s] = 1;
                    out.push(s);
                }
            });
            return out;
        }
        function extractCode(str) {
            let s = (str || '').toUpperCase();
            let m = s.match(/[A-Z]{2,10}[-_ ]?\\d{2,6}/);
            return m ? m[0].replace(/[_ ]+/g, '-') : '';
        }
        function cnSlices(str) {
            let chars = (str.match(/[\\u4e00-\\u9fa5]/g) || []).join('');
            let out = [];
            if (chars.length <= 3) return out;
            out.push(chars.slice(0, 3));
            out.push(chars.slice(chars.length - 3));
            for (let i = 1; i + 3 <= chars.length - 1; i++) out.push(chars.slice(i, i + 3));
            return out;
        }
        function buildQueries(str) {
            let raw = (str || '').trim();
            let compact = raw.replace(/\\s+/g, '');
            let code = extractCode(raw);
            let code2 = code ? code.replace(/-/g, ' ') : '';
            let code3 = code ? code.replace(/-/g, '') : '';
            let shortTitle = raw.replace(/^[^A-Z\\u4e00-\\u9fa5]+/i, '').replace(/[|｜].*$/, '').trim();
            return uniq([raw, compact, code, code2, code3, shortTitle].concat(cnSlices(raw)));
        }
        function decodeText(s) {
            return (s || '')
                .replace(/&#0*39;/g, "'")
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/\\s+/g, ' ')
                .trim();
        }
        function parseCards(html) {
            let list = [];
            let seen = {};
            let blocks = html.match(/<div id="video_[\\s\\S]*?<script>xv\\.thumbs\\.prepareVideo\\([^<]+<\\/script><\\/div>/ig) || [];
            blocks.forEach(function (block) {
                let vm = block.match(/<a href="(\\/video\\.[^"]+)"[^>]*title="([^"]*)"/i);
                if (!vm) return;
                let url = vm[1];
                if (seen[url]) return;
                let title = decodeText(vm[2]);
                let pic = '';
                let pm = block.match(/data-src="([^"]+)"/i) || block.match(/data-sfwthumb="([^"]+)"/i) || block.match(/src="([^"]+xvideos-cdn[^"]+)"/i);
                if (pm) pic = pm[1].replace(/&amp;/g, '&');
                let remark = '';
                let rm = block.match(/<span class="duration">([^<]+)<\\/span>/i);
                if (rm) remark = decodeText(rm[1]);
                if (!title) {
                    let tm = block.match(/<p class="title"><a [^>]*>([\\s\\S]*?)<span class="duration">/i);
                    if (tm) title = decodeText(tm[1].replace(/<[^>]+>/g, ''));
                }
                if (!title) return;
                seen[url] = 1;
                list.push({
                    vod_id: HOST + url,
                    vod_name: title,
                    vod_pic: pic,
                    vod_remarks: remark || 'XVideos'
                });
            });
            return list;
        }
        let queries = buildQueries(KEY);
        let out = [];
        let ids = {};
        for (let i = 0; i < queries.length; i++) {
            let q = queries[i];
            if (!q) continue;
            let html = request(HOST + '/?k=' + encodeURIComponent(q));
            let arr = parseCards(html);
            arr.forEach(function (it) {
                if (!ids[it.vod_id]) {
                    ids[it.vod_id] = 1;
                    out.push(it);
                }
            });
            if (out.length > 0 && i >= 1) break;
        }
        VODS = out;
    `
};
