var rule = {
    title: 'xHamster',
    host: 'https://xhamster.com',
    homeUrl: '/',
    url: '/categories/fyclass/fypage',
    searchUrl: '/search/**',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://xhamster.com/'
    },
    timeout: 10000,
    class_name: '臺灣&中文&日本&亞洲&素人&MILF',
    class_url: 'taiwanese&chinese&japanese&asian&amateur&milf',
    limit: 50,
    searchable: 1,
    quickSearch: 1,
    filterable: 0,
    play_parse: true,
    预处理: `js:
        try {
            request(HOST + '/');
            post(HOST + '/api/front/cookie-mgmt/accept', {
                headers: {
                    'User-Agent': rule.headers['User-Agent'],
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, text/plain, */*',
                    'Origin': HOST,
                    'Referer': HOST + '/'
                },
                body: JSON.stringify({
                    essential: true,
                    functional: true,
                    targeting: true,
                    analytical: true
                })
            });
        } catch (e) {
            print('xHamster consent bootstrap failed: ' + e.message);
        }
    `,
    lazy: `js:
        function decodeUrl(s) {
            let value = (s || '').trim();
            try { value = JSON.parse('"' + value + '"'); } catch (e) {}
            return value.replace(/&amp;/g, '&');
        }
        if (/^https?:\\/\\//.test(input) && input.indexOf('/videos/') > -1) {
            let html = request(input);
            let match = html.match(/<link rel="preload" href="([^"]+)" as="fetch"/i);
            let url = match ? decodeUrl(match[1]) : '';
            input = url ? {
                jx: 0,
                parse: 0,
                url: url,
                header: JSON.stringify({
                    'user-agent': rule.headers['User-Agent'],
                    'referer': input,
                    'origin': HOST,
                    'accept': '*/*'
                })
            } : {
                jx: 1,
                parse: 1,
                url: input
            };
        } else if (/^https?:\\/\\//.test(input)) {
            input = {
                jx: 0,
                parse: 0,
                url: input,
                header: JSON.stringify({
                    'user-agent': rule.headers['User-Agent'],
                    'referer': HOST + '/',
                    'origin': HOST,
                    'accept': '*/*'
                })
            };
        }
    `,
    推荐: `js:
        function decodeText(s) {
            let value = s || '';
            try { value = JSON.parse('"' + value + '"'); } catch (e) {}
            return value.replace(/&#0*39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\\s+/g, ' ').trim();
        }
        function decodeUrl(s) {
            let value = (s || '').trim();
            try { value = JSON.parse('"' + value + '"'); } catch (e) {}
            return value.replace(/&amp;/g, '&');
        }
        function parseCards(html) {
            let list = [];
            let seen = {};
            let marker = 'pageURL';
            let thumbMarker = 'thumbURL';
            let pos = 0;
            while ((pos = html.indexOf(marker, pos)) > -1) {
                let urlStart = html.indexOf(':', pos + marker.length);
                if (urlStart < 0) break;
                urlStart = html.indexOf('"', urlStart) + 1;
                let urlEnd = html.indexOf('"', urlStart);
                let thumbPos = html.indexOf(thumbMarker, urlEnd);
                if (urlEnd < 0 || thumbPos < 0 || thumbPos - urlEnd > 40) { pos += marker.length; continue; }
                let picStart = html.indexOf(':', thumbPos + thumbMarker.length);
                picStart = html.indexOf('"', picStart) + 1;
                let picEnd = html.indexOf('"', picStart);
                if (picEnd < 0) break;
                let url = decodeUrl(html.slice(urlStart, urlEnd));
                pos = picEnd + 1;
                if ((url.indexOf('http') !== 0 && url.indexOf('\\/\\/') !== 0) || url.indexOf('/videos/') < 0 && url.indexOf('\\/videos\\/') < 0 || seen[url]) continue;
                let prefix = html.slice(Math.max(0, urlStart - 3000), urlStart);
                let titleMark = 'title';
                let titleStart = prefix.lastIndexOf(titleMark);
                let durationMark = 'duration';
                let durationStart = prefix.lastIndexOf(durationMark);
                if (titleStart < 0) continue;
                titleStart = prefix.indexOf(':', titleStart + titleMark.length);
                titleStart = prefix.indexOf('"', titleStart) + 1;
                let titleEnd = prefix.indexOf('"', titleStart);
                if (titleEnd < 0) continue;
                let title = decodeText(prefix.slice(titleStart, titleEnd));
                if (!title) continue;
                let sec = 0;
                if (durationStart > -1) {
                    durationStart = prefix.indexOf(':', durationStart + durationMark.length);
                    sec = parseInt(prefix.slice(durationStart + 1), 10) || 0;
                }
                seen[url] = 1;
                let min = Math.floor(sec / 60);
                let rem = sec % 60;
                list.push({
                    vod_id: url,
                    vod_name: title,
                    vod_pic: decodeUrl(html.slice(picStart, picEnd)),
                    vod_remarks: sec ? min + ':' + (rem < 10 ? '0' + rem : rem) : 'xHamster'
                });
            }
            return list;
        }
        VODS = parseCards(request(HOST + '/')).slice(0, rule.limit);
    `,
    一级: `js:
        function decodeText(s) {
            let value = s || '';
            try { value = JSON.parse('"' + value + '"'); } catch (e) {}
            return value.replace(/&#0*39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\\s+/g, ' ').trim();
        }
        function decodeUrl(s) {
            let value = (s || '').trim();
            try { value = JSON.parse('"' + value + '"'); } catch (e) {}
            return value.replace(/&amp;/g, '&');
        }
        function parseCards(html) {
            let list = [];
            let seen = {};
            let marker = 'pageURL';
            let thumbMarker = 'thumbURL';
            let pos = 0;
            while ((pos = html.indexOf(marker, pos)) > -1) {
                let urlStart = html.indexOf(':', pos + marker.length);
                if (urlStart < 0) break;
                urlStart = html.indexOf('"', urlStart) + 1;
                let urlEnd = html.indexOf('"', urlStart);
                let thumbPos = html.indexOf(thumbMarker, urlEnd);
                if (urlEnd < 0 || thumbPos < 0 || thumbPos - urlEnd > 40) { pos += marker.length; continue; }
                let picStart = html.indexOf(':', thumbPos + thumbMarker.length);
                picStart = html.indexOf('"', picStart) + 1;
                let picEnd = html.indexOf('"', picStart);
                if (picEnd < 0) break;
                let url = decodeUrl(html.slice(urlStart, urlEnd));
                pos = picEnd + 1;
                if ((url.indexOf('http') !== 0 && url.indexOf('\\/\\/') !== 0) || url.indexOf('/videos/') < 0 && url.indexOf('\\/videos\\/') < 0 || seen[url]) continue;
                let prefix = html.slice(Math.max(0, urlStart - 3000), urlStart);
                let titleMark = 'title';
                let titleStart = prefix.lastIndexOf(titleMark);
                let durationMark = 'duration';
                let durationStart = prefix.lastIndexOf(durationMark);
                if (titleStart < 0) continue;
                titleStart = prefix.indexOf(':', titleStart + titleMark.length);
                titleStart = prefix.indexOf('"', titleStart) + 1;
                let titleEnd = prefix.indexOf('"', titleStart);
                if (titleEnd < 0) continue;
                let title = decodeText(prefix.slice(titleStart, titleEnd));
                if (!title) continue;
                let sec = 0;
                if (durationStart > -1) {
                    durationStart = prefix.indexOf(':', durationStart + durationMark.length);
                    sec = parseInt(prefix.slice(durationStart + 1), 10) || 0;
                }
                seen[url] = 1;
                let min = Math.floor(sec / 60);
                let rem = sec % 60;
                list.push({
                    vod_id: url,
                    vod_name: title,
                    vod_pic: decodeUrl(html.slice(picStart, picEnd)),
                    vod_remarks: sec ? min + ':' + (rem < 10 ? '0' + rem : rem) : 'xHamster'
                });
            }
            return list;
        }
        let page = parseInt(MY_PAGE, 10) || 1;
        let url = HOST + '/categories/' + MY_CATE + (page > 1 ? '/' + page : '');
        VODS = parseCards(request(url)).slice(0, rule.limit);
    `,
    二级: `js:
        function decodeText(s) {
            let value = s || '';
            try { value = JSON.parse('"' + value + '"'); } catch (e) {}
            return value.replace(/&#0*39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\\s+/g, ' ').trim();
        }
        function meta(html, key) {
            let re = new RegExp('<meta (?:property|name)="' + key + '" content=(?:"([^"]*)"|\\\'([^\\\']*)\\\')', 'i');
            let m = html.match(re);
            return m ? decodeText(m[1] || m[2] || '') : '';
        }
        let html = request(input);
        let title = meta(html, 'og:title') || decodeText(pdfh(html, 'title&&Text').replace(/\\s*[-|].*xHamster.*$/i, ''));
        let pic = meta(html, 'og:image');
        let content = meta(html, 'og:description') || meta(html, 'description');
        let duration = '';
        let dm = html.match(/"videoModel":\\{[\\s\\S]{0,1600}?"duration":(\\d+)/) || html.match(/"videoEntity":\\{[\\s\\S]{0,500}?"duration":(\\d+)/);
        if (dm) {
            let sec = parseInt(dm[1], 10) || 0;
            let min = Math.floor(sec / 60);
            let rem = sec % 60;
            duration = min + ':' + (rem < 10 ? '0' + rem : rem);
        }
        VOD = {
            vod_name: title || 'xHamster',
            vod_pic: pic,
            vod_remarks: duration || 'xHamster',
            vod_content: content,
            vod_play_from: 'xHamster',
            vod_play_url: (title || '播放') + '$' + input
        };
    `,
    搜索: `js:
        function decodeText(s) {
            let value = s || '';
            try { value = JSON.parse('"' + value + '"'); } catch (e) {}
            return value.replace(/&#0*39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\\s+/g, ' ').trim();
        }
        function decodeUrl(s) {
            let value = (s || '').trim();
            try { value = JSON.parse('"' + value + '"'); } catch (e) {}
            return value.replace(/&amp;/g, '&');
        }
        function parseCards(html) {
            let list = [];
            let seen = {};
            let marker = 'pageURL';
            let thumbMarker = 'thumbURL';
            let pos = 0;
            while ((pos = html.indexOf(marker, pos)) > -1) {
                let urlStart = html.indexOf(':', pos + marker.length);
                if (urlStart < 0) break;
                urlStart = html.indexOf('"', urlStart) + 1;
                let urlEnd = html.indexOf('"', urlStart);
                let thumbPos = html.indexOf(thumbMarker, urlEnd);
                if (urlEnd < 0 || thumbPos < 0 || thumbPos - urlEnd > 40) { pos += marker.length; continue; }
                let picStart = html.indexOf(':', thumbPos + thumbMarker.length);
                picStart = html.indexOf('"', picStart) + 1;
                let picEnd = html.indexOf('"', picStart);
                if (picEnd < 0) break;
                let url = decodeUrl(html.slice(urlStart, urlEnd));
                pos = picEnd + 1;
                if ((url.indexOf('http') !== 0 && url.indexOf('\\/\\/') !== 0) || url.indexOf('/videos/') < 0 && url.indexOf('\\/videos\\/') < 0 || seen[url]) continue;
                let prefix = html.slice(Math.max(0, urlStart - 3000), urlStart);
                let titleMark = 'title';
                let titleStart = prefix.lastIndexOf(titleMark);
                let durationMark = 'duration';
                let durationStart = prefix.lastIndexOf(durationMark);
                if (titleStart < 0) continue;
                titleStart = prefix.indexOf(':', titleStart + titleMark.length);
                titleStart = prefix.indexOf('"', titleStart) + 1;
                let titleEnd = prefix.indexOf('"', titleStart);
                if (titleEnd < 0) continue;
                let title = decodeText(prefix.slice(titleStart, titleEnd));
                if (!title) continue;
                let sec = 0;
                if (durationStart > -1) {
                    durationStart = prefix.indexOf(':', durationStart + durationMark.length);
                    sec = parseInt(prefix.slice(durationStart + 1), 10) || 0;
                }
                seen[url] = 1;
                let min = Math.floor(sec / 60);
                let rem = sec % 60;
                list.push({
                    vod_id: url,
                    vod_name: title,
                    vod_pic: decodeUrl(html.slice(picStart, picEnd)),
                    vod_remarks: sec ? min + ':' + (rem < 10 ? '0' + rem : rem) : 'xHamster'
                });
            }
            return list;
        }
        let page = parseInt(MY_PAGE, 10) || 1;
        let url = HOST + '/search/' + encodeURIComponent((KEY || '').trim()) + (page > 1 ? '?page=' + page : '');
        VODS = parseCards(request(url)).slice(0, rule.limit);
    `
};
