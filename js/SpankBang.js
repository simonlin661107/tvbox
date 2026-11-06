var rule = {
    title: 'SpankBang',
    host: 'https://spankbang.com',
    homeUrl: '/new_videos/',
    searchUrl: '/s/**/fypage/',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://spankbang.com/'
    },
    timeout: 30000,
    class_name: '最新&熱門&本週熱門&Amateur&Anal&亞洲&日本&Lesbian&MILF',
    class_url: 'new_videos&trending_videos&most_popular?p=w&s/amateur&s/anal&s/asian&s/japanese&s/lesbian&s/milf',
    limit: 72,
    searchable: 1,
    quickSearch: 1,
    filterable: 0,
    play_parse: true,
    lazy: String.raw`js:
        function decode(s) {
            let value = String(s || '');
            for (let i = 0; i < 3; i++) {
                let next = value.replace(/&amp;/gi, '&').replace(/&quot;|&#0*34;/gi, '"').replace(/&#0*39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
                if (next === value) break;
                value = next;
            }
            return value.replace(/\\u002f/gi, '/').replace(/\\\//g, '/').replace(/\\(["'])/g, '$1');
        }
        function challenged(html) {
            let value = String(html || '');
            return !value || /<title>\s*Just a moment|cf-mitigated|cf-chl-|Performing security verification/i.test(value);
        }
        function page(url) {
            let html = render(url, rule.headers, rule.timeout) || '';
            if (challenged(html)) html = request(url) || '';
            return challenged(html) ? '' : html;
        }
        function absolute(s) {
            let value = decode(s).trim();
            if (value.indexOf('//') === 0) return 'https:' + value;
            if (value.indexOf('/') === 0) return HOST + value;
            return value;
        }
        function quality(key, url) {
            if (/\b4k\b/i.test(key)) return 2160;
            let match = String(key || '').match(/(2160|1440|1080|720|480|360|320|240)/) || String(url || '').match(/(?:^|[^0-9])(2160|1440|1080|720|480|360|320|240)(?:p|[^0-9]|$)/i);
            return match ? parseInt(match[1], 10) : 0;
        }
        function add(list, seen, key, value, index) {
            let values = Array.isArray(value) ? value : [value];
            values.forEach(function (item) {
                let url = absolute(item);
                if (!/^https?:\/\//i.test(url) || seen[url]) return;
                seen[url] = 1;
                let name = String(key || '').toLowerCase();
                list.push({url: url, hls: name.indexOf('m3u8') === 0 || /\.m3u8(?:[?#]|$)/i.test(url), master: name === 'm3u8' || name === 'hls' || name === 'auto' || /master\.m3u8(?:[?#]|$)/i.test(url), quality: quality(name, url), index: index});
            });
        }
        function inline(html) {
            let list = [], seen = {}, index = 0, match;
            let stream = (html || '').match(/\bstream_data\s*=\s*\{([\s\S]*?)\}\s*;/i);
            if (stream) {
                let re = /['"]([^'"]+)['"]\s*:\s*\[\s*['"]([^'"]+)['"]/g;
                while ((match = re.exec(stream[1]))) add(list, seen, match[1], match[2], index++);
            }
            let legacy = /\bstream_url_([^\s=]+)\s*=\s*(["'])(.*?)\2/g;
            while ((match = legacy.exec(html || ''))) add(list, seen, match[1], match[3], index++);
            return {list: list, seen: seen, index: index};
        }
        function api(detail, html, state) {
            let key = (html || '').match(/data-streamkey\s*=\s*(["'])(.*?)\1/i);
            if (!key) return;
            let response = req(HOST + '/api/videos/stream', {
                method: 'POST',
                headers: {
                    'User-Agent': rule.headers['User-Agent'],
                    'Referer': detail,
                    'Origin': HOST,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Accept': 'application/json, text/plain, */*'
                },
                body: 'id=' + encodeURIComponent(decode(key[2])) + '&data=0'
            });
            try {
                let data = JSON.parse(response.content || '{}');
                Object.keys(data).forEach(function (name) { add(state.list, state.seen, name, data[name], state.index++); });
            } catch (e) {}
        }
        function choose(list) {
            let hls = list.filter(function (item) { return item.hls; });
            hls.sort(function (a, b) { return Number(b.master) - Number(a.master) || b.quality - a.quality || a.index - b.index; });
            if (hls.length) return hls[0].url;
            let mp4 = list.filter(function (item) { return /\.mp4(?:[?#]|$)/i.test(item.url); });
            mp4.sort(function (a, b) { return b.quality - a.quality || a.index - b.index; });
            return mp4.length ? mp4[0].url : '';
        }
        let detail = String(input || '');
        let valid = /^https?:\/\/(?:[^/]+\.)?spankbang\.com\/[a-z0-9]+\/(?:video|play)(?:[/?#]|$)/i.test(detail);
        let html = valid ? page(detail) : '';
        let state = inline(html);
        if (!state.list.length && html) api(detail, html, state);
        let playUrl = choose(state.list);
        input = playUrl ? {
            jx: 0,
            parse: 0,
            url: playUrl,
            fallbackUrl: detail,
            header: JSON.stringify({
                'user-agent': rule.headers['User-Agent'],
                'referer': detail,
                'origin': HOST,
                'accept': '*/*'
            })
        } : {
            jx: 0,
            parse: 1,
            url: detail || HOST + '/',
            fallbackUrl: detail || HOST + '/',
            header: JSON.stringify({
                'user-agent': rule.headers['User-Agent'],
                'referer': HOST + '/'
            })
        };
    `,
    推荐: String.raw`js:
        function decode(s) {
            let value = String(s || '');
            for (let i = 0; i < 3; i++) {
                let next = value.replace(/&amp;/gi, '&').replace(/&quot;|&#0*34;/gi, '"').replace(/&#0*39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&nbsp;/gi, ' ');
                if (next === value) break;
                value = next;
            }
            return value;
        }
        function text(s) { return decode(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
        function challenged(html) { return !html || /<title>\s*Just a moment|cf-mitigated|cf-chl-|Performing security verification/i.test(html); }
        function page(url) { let html = render(url, rule.headers, rule.timeout) || ''; if (challenged(html)) html = request(url) || ''; return challenged(html) ? '' : html; }
        function absolute(s) { let value = decode(s).trim(); if (value.indexOf('//') === 0) return 'https:' + value; if (value.indexOf('/') === 0) return HOST + value; return value; }
        function parseCards(html) {
            let list = [], seen = {};
            let blocks = (html || '').split(/<div[^>]+data-testid=["']video-item["'][^>]*>/i);
            for (let i = 1; i < blocks.length; i++) {
                let block = blocks[i].slice(0, 8000);
                let link = block.match(/<a[^>]+href=["'](\/[a-z0-9]+\/(?:video|play)\/[^"']*)["']/i);
                let image = block.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/i);
                let alt = image ? image[0].match(/alt=["']([^"']*)["']/i) : null;
                let name = block.match(/<a[^>]+href=["']\/[a-z0-9]+\/(?:video|play)\/[^"']*["'][^>]+title=["']([^"']+)["']/i);
                let duration = block.match(/data-testid=["']video-item-length["'][^>]*>([\s\S]*?)<\/div>/i);
                let resolution = block.match(/data-testid=["']video-item-resolution["'][^>]*>([\s\S]*?)<\/div>/i);
                let views = block.match(/data-testid=["']views["'][\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<\/span>/i);
                let id = link ? absolute(link[1]) : '';
                let title = text(name ? name[1] : (alt ? alt[1] : ''));
                if (!id || !title || seen[id]) continue;
                seen[id] = 1;
                list.push({vod_id: id, vod_name: title, vod_pic: image ? absolute(image[1]) : '', vod_remarks: [duration ? text(duration[1]) : '', resolution ? text(resolution[1]) : '', views ? text(views[1]) : ''].filter(Boolean).join(' · ') || 'SpankBang'});
            }
            return list;
        }
        VODS = parseCards(page(HOST + '/new_videos/')).slice(0, rule.limit);
    `,
    一级: String.raw`js:
        function decode(s) {
            let value = String(s || '');
            for (let i = 0; i < 3; i++) {
                let next = value.replace(/&amp;/gi, '&').replace(/&quot;|&#0*34;/gi, '"').replace(/&#0*39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&nbsp;/gi, ' ');
                if (next === value) break;
                value = next;
            }
            return value;
        }
        function text(s) { return decode(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
        function challenged(html) { return !html || /<title>\s*Just a moment|cf-mitigated|cf-chl-|Performing security verification/i.test(html); }
        function page(url) { let html = render(url, rule.headers, rule.timeout) || ''; if (challenged(html)) html = request(url) || ''; return challenged(html) ? '' : html; }
        function absolute(s) { let value = decode(s).trim(); if (value.indexOf('//') === 0) return 'https:' + value; if (value.indexOf('/') === 0) return HOST + value; return value; }
        function parseCards(html) {
            let list = [], seen = {};
            let blocks = (html || '').split(/<div[^>]+data-testid=["']video-item["'][^>]*>/i);
            for (let i = 1; i < blocks.length; i++) {
                let block = blocks[i].slice(0, 8000);
                let link = block.match(/<a[^>]+href=["'](\/[a-z0-9]+\/(?:video|play)\/[^"']*)["']/i);
                let image = block.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/i);
                let alt = image ? image[0].match(/alt=["']([^"']*)["']/i) : null;
                let name = block.match(/<a[^>]+href=["']\/[a-z0-9]+\/(?:video|play)\/[^"']*["'][^>]+title=["']([^"']+)["']/i);
                let duration = block.match(/data-testid=["']video-item-length["'][^>]*>([\s\S]*?)<\/div>/i);
                let resolution = block.match(/data-testid=["']video-item-resolution["'][^>]*>([\s\S]*?)<\/div>/i);
                let views = block.match(/data-testid=["']views["'][\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<\/span>/i);
                let id = link ? absolute(link[1]) : '';
                let title = text(name ? name[1] : (alt ? alt[1] : ''));
                if (!id || !title || seen[id]) continue;
                seen[id] = 1;
                list.push({vod_id: id, vod_name: title, vod_pic: image ? absolute(image[1]) : '', vod_remarks: [duration ? text(duration[1]) : '', resolution ? text(resolution[1]) : '', views ? text(views[1]) : ''].filter(Boolean).join(' · ') || 'SpankBang'});
            }
            return list;
        }
        let pageNo = Math.max(1, parseInt(MY_PAGE, 10) || 1);
        let category = String(MY_CATE || 'new_videos').replace(/^\/+|\/+$/g, '');
        let query = '';
        let queryAt = category.indexOf('?');
        if (queryAt > -1) { query = category.slice(queryAt); category = category.slice(0, queryAt); }
        let url = HOST + '/' + category + '/' + (pageNo > 1 ? pageNo + '/' : '');
        if (query) url += (pageNo > 1 ? '?' + query.slice(1).replace(/\/$/, '') : query);
        VODS = parseCards(page(url)).slice(0, rule.limit);
    `,
    二级: String.raw`js:
        function decode(s) {
            let value = String(s || '');
            for (let i = 0; i < 3; i++) {
                let next = value.replace(/&amp;/gi, '&').replace(/&quot;|&#0*34;/gi, '"').replace(/&#0*39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&nbsp;/gi, ' ');
                if (next === value) break;
                value = next;
            }
            return value.replace(/\\u002f/gi, '/').replace(/\\\//g, '/');
        }
        function text(s) { return decode(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
        function challenged(html) { return !html || /<title>\s*Just a moment|cf-mitigated|cf-chl-|Performing security verification/i.test(html); }
        function page(url) { let html = render(url, rule.headers, rule.timeout) || ''; if (challenged(html)) html = request(url) || ''; return challenged(html) ? '' : html; }
        function meta(html, key) {
            let re = new RegExp('<meta[^>]+(?:property|name)=["\\\']' + key + '["\\\'][^>]+content=["\\\']([^"\\\']*)["\\\']', 'i');
            let match = html.match(re);
            if (!match) { re = new RegExp('<meta[^>]+content=["\\\']([^"\\\']*)["\\\'][^>]+(?:property|name)=["\\\']' + key + '["\\\']', 'i'); match = html.match(re); }
            return match ? text(match[1]) : '';
        }
        function duration(seconds) {
            let value = parseInt(seconds, 10);
            if (!isFinite(value) || value <= 0) return '';
            let hours = Math.floor(value / 3600), minutes = Math.floor(value % 3600 / 60), secs = value % 60;
            return hours ? hours + ':' + String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0') : minutes + ':' + String(secs).padStart(2, '0');
        }
        let detail = String(input || '');
        let html = page(detail);
        let heading = html.match(/<h1[^>]+data-testid=["']video-title["'][^>]*>([\s\S]*?)<\/h1>/i);
        let titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        let title = text(heading ? heading[1] : (meta(html, 'og:title') || (titleTag ? titleTag[1] : ''))).replace(/\s*:\s*[^:]+\s+Porn\s*-\s*SpankBang\s*$/i, '').replace(/\s*-\s*SpankBang\s*$/i, '');
        let pic = meta(html, 'og:image');
        let content = meta(html, 'og:description') || meta(html, 'description');
        let remarks = duration(meta(html, 'og:video:duration')) || 'SpankBang';
        let removed = /<(?:div|span)[^>]+(?:id|class)=["'][^"']*video_removed/i.test(html);
        VOD = {
            vod_name: title || 'SpankBang',
            vod_pic: pic,
            vod_remarks: removed ? 'Unavailable' : remarks,
            vod_content: content,
            vod_play_from: detail ? 'SpankBang' : '',
            vod_play_url: detail ? (title || '播放') + '$' + detail : ''
        };
    `,
    搜索: String.raw`js:
        function decode(s) {
            let value = String(s || '');
            for (let i = 0; i < 3; i++) {
                let next = value.replace(/&amp;/gi, '&').replace(/&quot;|&#0*34;/gi, '"').replace(/&#0*39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&nbsp;/gi, ' ');
                if (next === value) break;
                value = next;
            }
            return value;
        }
        function text(s) { return decode(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
        function challenged(html) { return !html || /<title>\s*Just a moment|cf-mitigated|cf-chl-|Performing security verification/i.test(html); }
        function page(url) { let html = render(url, rule.headers, rule.timeout) || ''; if (challenged(html)) html = request(url) || ''; return challenged(html) ? '' : html; }
        function absolute(s) { let value = decode(s).trim(); if (value.indexOf('//') === 0) return 'https:' + value; if (value.indexOf('/') === 0) return HOST + value; return value; }
        function parseCards(html) {
            let list = [], seen = {};
            let blocks = (html || '').split(/<div[^>]+data-testid=["']video-item["'][^>]*>/i);
            for (let i = 1; i < blocks.length; i++) {
                let block = blocks[i].slice(0, 8000);
                let link = block.match(/<a[^>]+href=["'](\/[a-z0-9]+\/(?:video|play)\/[^"']*)["']/i);
                let image = block.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/i);
                let alt = image ? image[0].match(/alt=["']([^"']*)["']/i) : null;
                let name = block.match(/<a[^>]+href=["']\/[a-z0-9]+\/(?:video|play)\/[^"']*["'][^>]+title=["']([^"']+)["']/i);
                let duration = block.match(/data-testid=["']video-item-length["'][^>]*>([\s\S]*?)<\/div>/i);
                let id = link ? absolute(link[1]) : '';
                let title = text(name ? name[1] : (alt ? alt[1] : ''));
                if (!id || !title || seen[id]) continue;
                seen[id] = 1;
                list.push({title: title, pic_url: image ? absolute(image[1]) : '', desc: duration ? text(duration[1]) : 'SpankBang', url: id});
            }
            return list;
        }
        let pageNo = Math.max(1, parseInt(MY_PAGE, 10) || 1);
        let keyword = encodeURIComponent(String(KEY || '').trim()).replace(/%20/g, '+');
        let url = HOST + '/s/' + keyword + '/' + (pageNo > 1 ? pageNo + '/' : '');
        setResult(parseCards(page(url)).slice(0, rule.limit));
    `
};
