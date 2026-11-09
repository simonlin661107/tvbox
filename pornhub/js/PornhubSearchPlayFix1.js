var rule = {
    title: 'Pornhub',
    host: 'https://www.pornhub.com',
    homeUrl: '/',
    searchUrl: '/video/search?search=**',
    headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://www.pornhub.com/'
    },
    timeout: 10000,
    class_name: '推荐&最热&最多观看&最高评分',
    class_url: 'home&ht&mv&tr',
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
        function parseCards(html) {
            let list = [];
            let seen = {};
            let blocks = html.match(/<li class="pcVideoListItem[\\s\\S]*?<\\/li>/ig) || [];
            blocks.forEach(function (block) {
                let vm = block.match(/href="\\/view_video\\.php\\?viewkey=([^"&]+)[^"]*"[^>]*title="([^"]+)"/i);
                if (!vm) return;
                let key = vm[1];
                if (seen[key]) return;
                let title = (vm[2] || '').replace(/&#0*39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\\s+/g, ' ').trim();
                if (!title) return;
                let pic = '';
                let pm = block.match(/data-mediumthumb="([^"]+)"/i) || block.match(/src="([^"]+phncdn[^"]+)"/i);
                if (pm) pic = pm[1].replace(/&amp;/g, '&');
                let remark = '';
                let rm = block.match(/data-title="Video Duration">([^<]+)</i) || block.match(/class="bgShadeEffect duration[^"]*"[^>]*>([^<]+)</i);
                if (rm) remark = rm[1].replace(/\\s+/g, ' ').trim();
                seen[key] = 1;
                list.push({
                    vod_id: HOST + '/view_video.php?viewkey=' + key,
                    vod_name: title,
                    vod_pic: pic,
                    vod_remarks: remark || 'Pornhub'
                });
            });
            return list;
        }
        let html = request(HOST + '/');
        VODS = parseCards(html).slice(0, 20);
    `,
    一级: `js:
        function parseCards(html) {
            let list = [];
            let seen = {};
            let blocks = html.match(/<li class="pcVideoListItem[\\s\\S]*?<\\/li>/ig) || [];
            blocks.forEach(function (block) {
                let vm = block.match(/href="\\/view_video\\.php\\?viewkey=([^"&]+)[^"]*"[^>]*title="([^"]+)"/i);
                if (!vm) return;
                let key = vm[1];
                if (seen[key]) return;
                let title = (vm[2] || '').replace(/&#0*39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\\s+/g, ' ').trim();
                if (!title) return;
                let pic = '';
                let pm = block.match(/data-mediumthumb="([^"]+)"/i) || block.match(/src="([^"]+phncdn[^"]+)"/i);
                if (pm) pic = pm[1].replace(/&amp;/g, '&');
                let remark = '';
                let rm = block.match(/data-title="Video Duration">([^<]+)</i) || block.match(/class="bgShadeEffect duration[^"]*"[^>]*>([^<]+)</i);
                if (rm) remark = rm[1].replace(/\\s+/g, ' ').trim();
                seen[key] = 1;
                list.push({
                    vod_id: HOST + '/view_video.php?viewkey=' + key,
                    vod_name: title,
                    vod_pic: pic,
                    vod_remarks: remark || 'Pornhub'
                });
            });
            return list;
        }
        let url = HOST + '/';
        if (MY_CATE === 'ht') url = HOST + '/video?o=ht';
        else if (MY_CATE === 'mv') url = HOST + '/video?o=mv';
        else if (MY_CATE === 'tr') url = HOST + '/video?o=tr';
        let html = request(url);
        VODS = parseCards(html);
    `,
    二级: `js:
        let html = request(input);
        let title = '';
        let pic = '';
        let content = '';
        let remark = '';
        let playMap = {};
        let playUrls = [];
        let tm = html.match(/"video_title":"([^"]+)"/);
        if (tm) title = tm[1];
        if (!title) title = pdfh(html, 'title&&Text') || 'Pornhub';
        title = title.replace(/\\"/g, '"').replace(/&#0*39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\\s+/g, ' ').trim();
        let pm = html.match(/"image_url":"([^"]+)"/);
        if (pm) pic = pm[1].replace(/\\\//g, '/').replace(/&amp;/g, '&');
        if (!pic) pic = pdfh(html, 'meta[property=og:image]&&content') || '';
        let cm = html.match(/<meta name="description" content="([^"]+)"/i);
        if (cm) content = cm[1].replace(/&#0*39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
        let rm = html.match(/"video_duration":(\\d+)/);
        if (rm) {
            let sec = parseInt(rm[1]);
            if (!isNaN(sec)) {
                let m = Math.floor(sec / 60);
                let s = sec % 60;
                remark = m + ':' + (s < 10 ? '0' + s : s);
            }
        }
        let fm = html.match(/var\\s+flashvars_\\d+\\s*=\\s*(\\{[\\s\\S]*?\\});/);
        if (fm) {
            try {
                let flashvars = JSON.parse(fm[1]);
                let defs = flashvars.mediaDefinitions || [];
                let media = [];
                defs.forEach(function (it) {
                    if (!it || !it.videoUrl) return;
                    let url = String(it.videoUrl).replace(/\\\//g, '/').replace(/&amp;/g, '&');
                    if (playMap[url]) return;
                    playMap[url] = 1;
                    media.push({
                        url: url,
                        quality: String(it.quality || '').trim(),
                        format: String(it.format || '').toLowerCase()
                    });
                });
                media.sort(function (a, b) {
                    let aHls = a.format === 'hls';
                    let bHls = b.format === 'hls';
                    if (aHls !== bHls) return aHls ? -1 : 1;
                    let aQuality = parseInt(a.quality, 10) || 0;
                    let bQuality = parseInt(b.quality, 10) || 0;
                    if (aHls) {
                        let aDistance = Math.abs(aQuality - 480);
                        let bDistance = Math.abs(bQuality - 480);
                        if (aDistance !== bDistance) return aDistance - bDistance;
                    }
                    return aQuality - bQuality;
                });
                media.forEach(function (it) {
                    let label = (it.format === 'hls' ? 'HLS' : 'MP4') + (it.quality ? '-' + it.quality : '');
                    playUrls.push(label + '$' + it.url);
                });
            } catch (e) {}
        }
        VOD = {
            vod_name: title,
            vod_pic: pic,
            vod_remarks: remark || 'Pornhub',
            vod_content: content,
            vod_play_from: playUrls.length ? 'Pornhub' : '',
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
        function enSlices(str) {
            let words = (str || '').replace(/[-–—]+/g, ' ').match(/[A-Za-z0-9]+/g) || [];
            let out = [];
            for (let len = 4; len >= 3; len--) {
                for (let i = 0; i + len <= words.length; i++) out.push(words.slice(i, i + len).join(' '));
            }
            return out;
        }
        function buildQueries(str) {
            let raw = (str || '').trim();
            let compact = raw.replace(/\\s+/g, '');
            let code = extractCode(raw);
            let code2 = code ? code.replace(/-/g, ' ') : '';
            let code3 = code ? code.replace(/-/g, '') : '';
            let shortTitle = raw.replace(/^[^A-Z\\u4e00-\\u9fa5]+/i, '').replace(/[|｜].*$/, '').replace(/\\s+-\\s+More\\s+at\\s+.*$/i, '').trim();
            return uniq([raw, compact, code, code2, code3, shortTitle].concat(enSlices(shortTitle)).concat(cnSlices(raw)));
        }
        function parseCards(html) {
            let list = [];
            let seen = {};
            let blocks = html.match(/<li class="pcVideoListItem[\\s\\S]*?<\\/li>/ig) || [];
            blocks.forEach(function (block) {
                let vm = block.match(/href="\\/view_video\\.php\\?viewkey=([^"&]+)[^"]*"[^>]*title="([^"]+)"/i);
                if (!vm) return;
                let key = vm[1];
                if (seen[key]) return;
                let title = (vm[2] || '').replace(/&#0*39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\\s+/g, ' ').trim();
                if (!title) return;
                let pic = '';
                let pm = block.match(/data-mediumthumb="([^"]+)"/i) || block.match(/src="([^"]+phncdn[^"]+)"/i);
                if (pm) pic = pm[1].replace(/&amp;/g, '&');
                let remark = '';
                let rm = block.match(/data-title="Video Duration">([^<]+)</i) || block.match(/class="bgShadeEffect duration[^"]*"[^>]*>([^<]+)</i);
                if (rm) remark = rm[1].replace(/\\s+/g, ' ').trim();
                seen[key] = 1;
                list.push({
                    vod_id: HOST + '/view_video.php?viewkey=' + key,
                    vod_name: title,
                    vod_pic: pic,
                    vod_remarks: remark || 'Pornhub'
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
            let html = request(HOST + '/video/search?search=' + encodeURIComponent(q));
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
