var rule = {
    title: 'YouPorn',
    host: 'https://www.youporn.com',
    homeUrl: '/',
    searchUrl: '/search/?query=**&page=fypage',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://www.youporn.com/'
    },
    timeout: 20000,
    class_name: '最新&Anal&Amateur&Lesbian&MILF&亞洲&日本&HD',
    class_url: 'home&category/anal&category/amateur&category/lesbian&category/milf&category/asian&category/japanese&category/hd',
    limit: 50,
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
        function absolute(s) {
            let value = decode(s).trim();
            if (value.indexOf('//') === 0) return 'https:' + value;
            if (value.indexOf('/') === 0) return HOST + value;
            return value;
        }
        function objectAt(html, marker) {
            let at = String(html || '').indexOf(marker);
            if (at < 0) return {};
            let start = html.indexOf('{', at + marker.length);
            if (start < 0) return {};
            let depth = 0, quote = '', escaped = false;
            for (let i = start; i < html.length; i++) {
                let char = html.charAt(i);
                if (quote) {
                    if (escaped) escaped = false;
                    else if (char === '\\') escaped = true;
                    else if (char === quote) quote = '';
                    continue;
                }
                if (char === '"' || char === "'") { quote = char; continue; }
                if (char === '{') depth++;
                else if (char === '}' && --depth === 0) {
                    try { return JSON.parse(html.slice(start, i + 1)); } catch (e) { return {}; }
                }
            }
            return {};
        }
        function assetId(s) {
            let value = decode(s);
            let match = value.match(/(?:original_|\d{3,4}P_\d+K_)(\d{5,})/i)
                || value.match(/\/videos\/\d{6}\/\d{2}\/(\d{5,})(?:\/|$)/i);
            return match ? match[1] : '';
        }
        function seconds(item) {
            let keys = ['duration', 'videoDuration', 'video_duration', 'length'];
            for (let i = 0; i < keys.length; i++) {
                let value = parseFloat(item && item[keys[i]]);
                if (isFinite(value) && value > 0) return value;
            }
            return 0;
        }
        function quality(item, url) {
            let value = parseInt(item && (item.quality || item.height), 10);
            if (isFinite(value) && value > 0) return value;
            let match = String(url || '').match(/(?:^|[^0-9])(2160|1440|1080|720|480|360|240)(?:P|p|[^0-9]|$)/);
            return match ? parseInt(match[1], 10) : 0;
        }
        function advertised(item, url) {
            if (!item || typeof item !== 'object') return true;
            if (item.isAd === true || item.ad === true || item.preroll === true || item.isTrailer === true || item.isPreview === true) return true;
            let fields = [item.type, item.kind, item.role, item.label, item.formatId, item.format_id, url].join(' ').toLowerCase();
            return /(?:^|[^a-z])(advert|preroll|pre-roll|trailer|preview|promo)(?:[^a-z]|$)/.test(fields);
        }
        function urls(value) {
            if (Array.isArray(value)) return value;
            return typeof value === 'string' ? [value] : [];
        }
        function candidates(value, format, expectedDuration, expectedAsset, offset) {
            let list = [], seen = {}, items = Array.isArray(value) ? value : [];
            items.forEach(function (item, index) {
                if (!item || typeof item !== 'object' || String(item.format || '').toLowerCase() !== format) return;
                urls(item.videoUrl).forEach(function (source) {
                    let url = absolute(source);
                    if (!/^https?:\/\//i.test(url) || seen[url] || advertised(item, url)) return;
                    let duration = seconds(item);
                    if (expectedDuration > 60 && duration > 0 && duration < Math.min(30, expectedDuration * 0.25)) return;
                    let candidateAsset = assetId(url);
                    if (expectedAsset && candidateAsset && expectedAsset !== candidateAsset) return;
                    seen[url] = 1;
                    let distance = expectedDuration > 0 && duration > 0 ? Math.abs(duration - expectedDuration) / expectedDuration : 1;
                    let identity = expectedAsset && candidateAsset === expectedAsset ? 1 : 0;
                    let durationMatch = distance <= 0.2 ? 1 : 0;
                    if (expectedAsset && !identity && !durationMatch) return;
                    list.push({
                        url: url,
                        quality: quality(item, url),
                        duration: duration,
                        durationMatch: durationMatch,
                        identity: identity,
                        master: format === 'hls' && typeof item.defaultQuality !== 'boolean' ? 1 : 0,
                        index: offset + index
                    });
                });
            });
            return list;
        }
        function player(html, detail) {
            let data = objectAt(html, 'playervars:');
            let watch = String(detail || '').match(/\/watch\/(\d+)/i);
            let link = String(data.link_url || '').match(/\/watch\/(\d+)/i);
            if (!watch || !link || watch[1] !== link[1]) return {};
            return {
                definitions: Array.isArray(data.mediaDefinitions) ? data.mediaDefinitions : [],
                duration: parseFloat(data.video_duration) || 0,
                asset: assetId(data.image_url)
            };
        }
        let detail = String(input || '');
        let html = /^https?:\/\/[^/]*youporn\.com\/watch\/\d+/i.test(detail) ? (request(detail) || '') : '';
        let main = player(html, detail);
        let playUrl = '', formats = ['hls', 'mp4'], order = 0;
        for (let i = 0; i < formats.length && !playUrl; i++) {
            let format = formats[i], endpoints = [], endpointSeen = {};
            for (let j = 0; j < main.definitions.length; j++) {
                let definition = main.definitions[j];
                if (String(definition && definition.format || '').toLowerCase() !== format) continue;
                let api = absolute(definition.videoUrl);
                if (/^https?:\/\//i.test(api) && !endpointSeen[api]) { endpointSeen[api] = 1; endpoints.push(api); }
            }
            let list = [];
            for (let j = 0; j < endpoints.length; j++) {
                let response = req(endpoints[j], {headers: {
                    'User-Agent': rule.headers['User-Agent'],
                    'Referer': detail,
                    'Accept': 'application/json, text/plain, */*'
                }});
                try {
                    let found = candidates(JSON.parse(response.content || '[]'), format, main.duration || 0, main.asset || '', order);
                    order += found.length + 1;
                    list = list.concat(found);
                } catch (e) { order++; }
            }
            list.sort(function (a, b) {
                return b.identity - a.identity || b.durationMatch - a.durationMatch || b.master - a.master || b.duration - a.duration || b.quality - a.quality || a.index - b.index;
            });
            if (list.length) playUrl = list[0].url;
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
        function absolute(s) {
            let value = decode(s).trim();
            if (value.indexOf('//') === 0) return 'https:' + value;
            if (value.indexOf('/') === 0) return HOST + value;
            return value;
        }
        function parseCards(html) {
            let list = [];
            let seen = {};
            let blocks = (html || '').split(/<article[^>]+class=["'][^"']*\bvideo-box\b[^"']*\bjs_video-box\b[^"']*["'][^>]*>/i);
            for (let i = 1; i < blocks.length; i++) {
                let block = blocks[i].slice(0, 7000);
                let link = block.match(/<a[^>]+href=["'](\/watch\/\d+\/)["']/i);
                let image = block.match(/<img[^>]+(?:data-src|data-poster|src)=["']([^"']+)["'][^>]*>/i);
                let titleMatch = block.match(/<a[^>]+class=["'][^"']*\bvideo-title-text\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
                let alt = image ? image[0].match(/alt=["']([^"']*)["']/i) : null;
                let duration = block.match(/class=["'][^"']*\bvideo-duration\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
                let views = block.match(/class=["']info-views["'][^>]*>[\s\S]*?<\/span>\s*([^<]+)<\/span>/i);
                let rating = block.match(/Rating:\s*<\/span>\s*([^<]+)<\/span>/i);
                let id = link ? absolute(link[1]) : '';
                let title = text(titleMatch ? titleMatch[1] : (alt ? alt[1] : ''));
                if (!id || !title || seen[id]) continue;
                seen[id] = 1;
                list.push({vod_id: id, vod_name: title, vod_pic: image ? absolute(image[1]) : '', vod_remarks: [duration ? text(duration[1]) : '', views ? text(views[1]) : '', rating ? text(rating[1]) : ''].filter(Boolean).join(' · ') || 'YouPorn'});
            }
            return list;
        }
        VODS = parseCards(request(HOST + '/') || '').slice(0, rule.limit);
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
        function absolute(s) {
            let value = decode(s).trim();
            if (value.indexOf('//') === 0) return 'https:' + value;
            if (value.indexOf('/') === 0) return HOST + value;
            return value;
        }
        function parseCards(html) {
            let list = [];
            let seen = {};
            let blocks = (html || '').split(/<article[^>]+class=["'][^"']*\bvideo-box\b[^"']*\bjs_video-box\b[^"']*["'][^>]*>/i);
            for (let i = 1; i < blocks.length; i++) {
                let block = blocks[i].slice(0, 7000);
                let link = block.match(/<a[^>]+href=["'](\/watch\/\d+\/)["']/i);
                let image = block.match(/<img[^>]+(?:data-src|data-poster|src)=["']([^"']+)["'][^>]*>/i);
                let titleMatch = block.match(/<a[^>]+class=["'][^"']*\bvideo-title-text\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
                let alt = image ? image[0].match(/alt=["']([^"']*)["']/i) : null;
                let duration = block.match(/class=["'][^"']*\bvideo-duration\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
                let views = block.match(/class=["']info-views["'][^>]*>[\s\S]*?<\/span>\s*([^<]+)<\/span>/i);
                let rating = block.match(/Rating:\s*<\/span>\s*([^<]+)<\/span>/i);
                let id = link ? absolute(link[1]) : '';
                let title = text(titleMatch ? titleMatch[1] : (alt ? alt[1] : ''));
                if (!id || !title || seen[id]) continue;
                seen[id] = 1;
                list.push({vod_id: id, vod_name: title, vod_pic: image ? absolute(image[1]) : '', vod_remarks: [duration ? text(duration[1]) : '', views ? text(views[1]) : '', rating ? text(rating[1]) : ''].filter(Boolean).join(' · ') || 'YouPorn'});
            }
            return list;
        }
        let page = Math.max(1, parseInt(MY_PAGE, 10) || 1);
        let category = String(MY_CATE || 'home').replace(/^\/+|\/+$/g, '');
        let url = category === 'home' ? HOST + '/' : HOST + '/' + category + '/';
        if (page > 1) url += '?page=' + page;
        VODS = parseCards(request(url) || '').slice(0, rule.limit);
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
        function duration(value) {
            let match = String(value || '').match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
            if (!match) return String(value || '');
            let hours = parseInt(match[1], 10) || 0, minutes = parseInt(match[2], 10) || 0, seconds = parseInt(match[3], 10) || 0;
            minutes += Math.floor(seconds / 60);
            seconds %= 60;
            hours += Math.floor(minutes / 60);
            minutes %= 60;
            return hours ? hours + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0') : minutes + ':' + String(seconds).padStart(2, '0');
        }
        function videoObject(html) {
            let scripts = (html || '').match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/ig) || [];
            for (let i = 0; i < scripts.length; i++) {
                let body = scripts[i].replace(/^[\s\S]*?>/, '').replace(/<\/script>[\s\S]*$/i, '');
                try {
                    let data = JSON.parse(body);
                    let values = Array.isArray(data) ? data : (Array.isArray(data['@graph']) ? data['@graph'] : [data]);
                    for (let j = 0; j < values.length; j++) if (values[j] && values[j]['@type'] === 'VideoObject') return values[j];
                } catch (e) {}
            }
            return {};
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
        let detail = String(input || '');
        let html = request(detail) || '';
        let data = videoObject(html);
        let titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        let title = text(data.name || meta(html, 'og:title') || (titleTag ? titleTag[1] : '')).replace(/\s*-\s*Free Porn Videos\s*-\s*YouPorn\s*$/i, '');
        let pic = decode(Array.isArray(data.thumbnailUrl) ? data.thumbnailUrl[0] : (data.thumbnailUrl || meta(html, 'og:image')));
        let content = text(data.description || meta(html, 'og:description') || meta(html, 'description'));
        let remarks = duration(data.duration || '') || 'YouPorn';
        VOD = {
            vod_name: title || 'YouPorn',
            vod_pic: pic,
            vod_remarks: remarks,
            vod_content: content,
            vod_play_from: html ? 'YouPorn' : '',
            vod_play_url: html ? (title || '播放') + '$' + detail : ''
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
        function absolute(s) {
            let value = decode(s).trim();
            if (value.indexOf('//') === 0) return 'https:' + value;
            if (value.indexOf('/') === 0) return HOST + value;
            return value;
        }
        function parseCards(html) {
            let list = [];
            let seen = {};
            let blocks = (html || '').split(/<article[^>]+class=["'][^"']*\bvideo-box\b[^"']*\bjs_video-box\b[^"']*["'][^>]*>/i);
            for (let i = 1; i < blocks.length; i++) {
                let block = blocks[i].slice(0, 7000);
                let link = block.match(/<a[^>]+href=["'](\/watch\/\d+\/)["']/i);
                let image = block.match(/<img[^>]+(?:data-src|data-poster|src)=["']([^"']+)["'][^>]*>/i);
                let titleMatch = block.match(/<a[^>]+class=["'][^"']*\bvideo-title-text\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
                let alt = image ? image[0].match(/alt=["']([^"']*)["']/i) : null;
                let duration = block.match(/class=["'][^"']*\bvideo-duration\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
                let id = link ? absolute(link[1]) : '';
                let title = text(titleMatch ? titleMatch[1] : (alt ? alt[1] : ''));
                if (!id || !title || seen[id]) continue;
                seen[id] = 1;
                list.push({title: title, pic_url: image ? absolute(image[1]) : '', desc: duration ? text(duration[1]) : 'YouPorn', url: id});
            }
            return list;
        }
        let page = Math.max(1, parseInt(MY_PAGE, 10) || 1);
        let url = HOST + '/search/?query=' + encodeURIComponent(String(KEY || '').trim()) + (page > 1 ? '&page=' + page : '');
        setResult(parseCards(request(url) || '').slice(0, rule.limit));
    `
};
