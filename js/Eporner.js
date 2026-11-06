var rule = {
    title: 'Eporner',
    host: 'https://www.eporner.com',
    homeUrl: '/',
    url: '/fyclass/fypage/',
    searchUrl: '/tag/**/fypage/',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 16; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://www.eporner.com/'
    },
    timeout: 20000,
    class_name: '最新&全部&1080p&60fps&4K&熱門&最佳&業餘&日本&亞洲&VR',
    class_url: 'home&cat/all&cat/hd-1080p&cat/60fps&cat/4k-porn&top-rated&best-videos&cat/amateur&cat/japanese&cat/asian&cat/vr-porn',
    limit: 80,
    searchable: 1,
    quickSearch: 1,
    filterable: 0,
    play_parse: true,
    sniffer: 1,
    isVideo: String.raw`^https?://(?:dash-[^/]+-cdn\.eporner\.com/hls/v\d+/[^?]+/master\.m3u8|vid-[^/]+-cdn\.eporner\.com/v\d+/[^/]+/[^/]+-\d+p\.mp4)(?:\?.*)?$`,
    lazy: String.raw`js:
        if (/^https?:\/\//.test(input) && input.indexOf('/video-') > -1) {
            let detail = input;
            let html = request(detail) || '';
            let vidMatch = html.match(/EP\.video\.player\.vid\s*=\s*['"]([^'"]+)['"]/i);
            let hashMatch = html.match(/EP\.video\.player\.hash\s*=\s*['"]([^'"]+)['"]/i);
            let playUrl = '';
            if (vidMatch && hashMatch) {
                let vid = vidMatch[1];
                let api = HOST + '/xhr/video/' + encodeURIComponent(vid)
                    + '?hash=' + encodeURIComponent(hashMatch[1])
                    + '&domain=' + encodeURIComponent(HOST.replace(/^https?:\/\//, ''))
                    + '&pixelRatio=1&playerWidth=1280&playerHeight=720'
                    + '&fallback=false&embed=false&supportedFormats=hls,dash,h265,vp9,av1,mp4';
                let response = req(api, {headers: {
                    'User-Agent': rule.headers['User-Agent'],
                    'Referer': detail,
                    'X-Requested-With': 'XMLHttpRequest'
                }});
                try {
                    let data = JSON.parse(response.content || '{}');
                    if (data.available !== false && (!data.code || data.code === 1)) {
                        let hls = data.sources && data.sources.hls ? data.sources.hls : {};
                        let master = hls.auto && hls.auto.src ? hls.auto.src : '';
                        if (!master) {
                            Object.keys(hls).some(function (key) {
                                let item = hls[key] || {};
                                if (/^https?:\/\//.test(item.src || '')) {
                                    master = item.src;
                                    return true;
                                }
                                return false;
                            });
                        }
                        if (master) {
                            playUrl = master;
                        } else {
                            let sources = data.sources && data.sources.mp4 ? data.sources.mp4 : {};
                            let best = null;
                            Object.keys(sources).forEach(function (key) {
                                let item = sources[key] || {};
                                let quality = parseInt(item.labelShort || key, 10) || 0;
                                if (item.src && (!best || quality > best.quality)) best = {url: item.src, quality: quality};
                            });
                            if (best) playUrl = best.url;
                        }
                    }
                } catch (e) {}
            }
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
                url: detail,
                fallbackUrl: detail,
                header: JSON.stringify({
                    'user-agent': rule.headers['User-Agent'],
                    'referer': HOST + '/'
                })
            };
        } else if (/^https?:\/\//.test(input)) {
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
    推荐: String.raw`js:
        function getHtml(url) {
            let html = request(url);
            if (!html || html.indexOf('cf-mitigated') > -1 || html.indexOf('<title>Just a moment') > -1) html = render(url, rule.headers, rule.timeout);
            return html || '';
        }
        function text(s) {
            return (s || '').replace(/<[^>]+>/g, ' ').replace(/&#0*39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
        }
        function absolute(s) {
            let value = (s || '').replace(/&amp;/g, '&').trim();
            if (!value) return '';
            if (value.indexOf('//') === 0) return 'https:' + value;
            if (value.indexOf('/') === 0) return HOST + value;
            return value;
        }
        function parseCards(html) {
            let list = [];
            let seen = {};
            let blocks = html.split(/<div class=["']mb(?:\s[^"']*)?["'][^>]*>/i);
            for (let i = 1; i < blocks.length; i++) {
                let block = blocks[i].slice(0, 5000);
                let link = block.match(/<a[^>]+href=["']([^"']*\/video-[^"']+)["']/i);
                let image = block.match(/<img[^>]+(?:data-src|src)=["']([^"']+)["'][^>]*>/i);
                let alt = image ? image[0].match(/alt=["']([^"']*)["']/i) : null;
                let name = block.match(/<p[^>]+class=["']mbtit["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
                let duration = block.match(/class=["']mbtim["'][^>]*>([^<]*)</i);
                let quality = block.match(/class=["']mvhdico["'][\s\S]*?<span[^>]*>([^<]*)</i);
                let rating = block.match(/class=["']mbrate["'][^>]*>([^<]*)</i);
                let id = link ? absolute(link[1]) : '';
                let title = text(name ? name[1] : (alt ? alt[1] : ''));
                if (!id || !title || seen[id]) continue;
                seen[id] = 1;
                list.push({
                    vod_id: id,
                    vod_name: title,
                    vod_pic: image ? absolute(image[1]) : '',
                    vod_remarks: [duration ? text(duration[1]) : '', quality ? text(quality[1]) : '', rating ? text(rating[1]) : ''].filter(Boolean).join(' · ') || 'Eporner'
                });
            }
            return list;
        }
        VODS = parseCards(getHtml(HOST + '/')).slice(0, rule.limit);
    `,
    一级: String.raw`js:
        function getHtml(url) {
            let html = request(url);
            if (!html || html.indexOf('cf-mitigated') > -1 || html.indexOf('<title>Just a moment') > -1) html = render(url, rule.headers, rule.timeout);
            return html || '';
        }
        function text(s) {
            return (s || '').replace(/<[^>]+>/g, ' ').replace(/&#0*39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
        }
        function absolute(s) {
            let value = (s || '').replace(/&amp;/g, '&').trim();
            if (!value) return '';
            if (value.indexOf('//') === 0) return 'https:' + value;
            if (value.indexOf('/') === 0) return HOST + value;
            return value;
        }
        function parseCards(html) {
            let list = [];
            let seen = {};
            let blocks = html.split(/<div class=["']mb(?:\s[^"']*)?["'][^>]*>/i);
            for (let i = 1; i < blocks.length; i++) {
                let block = blocks[i].slice(0, 5000);
                let link = block.match(/<a[^>]+href=["']([^"']*\/video-[^"']+)["']/i);
                let image = block.match(/<img[^>]+(?:data-src|src)=["']([^"']+)["'][^>]*>/i);
                let alt = image ? image[0].match(/alt=["']([^"']*)["']/i) : null;
                let name = block.match(/<p[^>]+class=["']mbtit["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
                let duration = block.match(/class=["']mbtim["'][^>]*>([^<]*)</i);
                let quality = block.match(/class=["']mvhdico["'][\s\S]*?<span[^>]*>([^<]*)</i);
                let rating = block.match(/class=["']mbrate["'][^>]*>([^<]*)</i);
                let id = link ? absolute(link[1]) : '';
                let title = text(name ? name[1] : (alt ? alt[1] : ''));
                if (!id || !title || seen[id]) continue;
                seen[id] = 1;
                list.push({vod_id: id, vod_name: title, vod_pic: image ? absolute(image[1]) : '', vod_remarks: [duration ? text(duration[1]) : '', quality ? text(quality[1]) : '', rating ? text(rating[1]) : ''].filter(Boolean).join(' · ') || 'Eporner'});
            }
            return list;
        }
        let page = parseInt(MY_PAGE, 10) || 1;
        let path = MY_CATE || 'home';
        let url = path === 'home' ? HOST + '/' : HOST + '/' + path + '/';
        if (page > 1) url += page + '/';
        VODS = parseCards(getHtml(url)).slice(0, rule.limit);
    `,
    二级: String.raw`js:
        function getHtml(url) {
            let html = request(url);
            if (!html || html.indexOf('cf-mitigated') > -1 || html.indexOf('<title>Just a moment') > -1) html = render(url, rule.headers, rule.timeout);
            return html || '';
        }
        function text(s) {
            return (s || '').replace(/<[^>]+>/g, ' ').replace(/&#0*39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
        }
        function meta(html, key) {
            let re = new RegExp('<meta[^>]+(?:property|name)=["\\\']' + key + '["\\\'][^>]+content=["\\\']([^"\\\']*)["\\\']', 'i');
            let match = html.match(re);
            if (!match) {
                re = new RegExp('<meta[^>]+content=["\\\']([^"\\\']*)["\\\'][^>]+(?:property|name)=["\\\']' + key + '["\\\']', 'i');
                match = html.match(re);
            }
            return match ? text(match[1]) : '';
        }
        let html = getHtml(input);
        let title = meta(html, 'og:title').replace(/\s*-\s*EPORNER\s*$/i, '');
        let pic = meta(html, 'og:image');
        let content = meta(html, 'og:description') || meta(html, 'description');
        let duration = '';
        let jsonLd = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
        if (jsonLd) {
            try {
                let data = JSON.parse(jsonLd[1]);
                if (!title && data.name) title = text(data.name);
                if (!pic && data.thumbnailUrl) pic = Array.isArray(data.thumbnailUrl) ? data.thumbnailUrl[0] : data.thumbnailUrl;
                if (!content && data.description) content = text(data.description);
                if (data.duration) duration = String(data.duration).replace(/^PT/i, '').replace(/H/i, ':').replace(/M/i, ':').replace(/S/i, '');
            } catch (e) {}
        }
        if (!duration) {
            let seconds = parseInt(meta(html, 'og:duration'), 10) || 0;
            if (seconds) duration = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
        }
        VOD = {
            vod_name: title || 'Eporner',
            vod_pic: pic,
            vod_remarks: duration || 'Eporner',
            vod_content: content,
            vod_play_from: html ? 'Eporner' : '',
            vod_play_url: html ? (title || '播放') + '$' + input : ''
        };
    `,
    搜索: String.raw`js:
        function getHtml(url) {
            let html = request(url);
            if (!html || html.indexOf('cf-mitigated') > -1 || html.indexOf('<title>Just a moment') > -1) html = render(url, rule.headers, rule.timeout);
            return html || '';
        }
        function text(s) {
            return (s || '').replace(/<[^>]+>/g, ' ').replace(/&#0*39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
        }
        function absolute(s) {
            let value = (s || '').replace(/&amp;/g, '&').trim();
            if (!value) return '';
            if (value.indexOf('//') === 0) return 'https:' + value;
            if (value.indexOf('/') === 0) return HOST + value;
            return value;
        }
        function parseCards(html) {
            let list = [];
            let seen = {};
            let blocks = html.split(/<div class=["']mb(?:\s[^"']*)?["'][^>]*>/i);
            for (let i = 1; i < blocks.length; i++) {
                let block = blocks[i].slice(0, 5000);
                let link = block.match(/<a[^>]+href=["']([^"']*\/video-[^"']+)["']/i);
                let image = block.match(/<img[^>]+(?:data-src|src)=["']([^"']+)["'][^>]*>/i);
                let alt = image ? image[0].match(/alt=["']([^"']*)["']/i) : null;
                let name = block.match(/<p[^>]+class=["']mbtit["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
                let duration = block.match(/class=["']mbtim["'][^>]*>([^<]*)</i);
                let quality = block.match(/class=["']mvhdico["'][\s\S]*?<span[^>]*>([^<]*)</i);
                let id = link ? absolute(link[1]) : '';
                let title = text(name ? name[1] : (alt ? alt[1] : ''));
                if (!id || !title || seen[id]) continue;
                seen[id] = 1;
                list.push({title: title, pic_url: image ? absolute(image[1]) : '', desc: [duration ? text(duration[1]) : '', quality ? text(quality[1]) : ''].filter(Boolean).join(' · ') || 'Eporner', url: id});
            }
            return list;
        }
        let keyword = (KEY || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        let page = parseInt(MY_PAGE, 10) || 1;
        let url = HOST + '/tag/' + encodeURIComponent(keyword) + '/' + (page > 1 ? page + '/' : '');
        setResult(parseCards(getHtml(url)).slice(0, rule.limit));
    `
};
