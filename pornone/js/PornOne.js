var rule = {
    title: 'PornOne',
    host: 'https://pornone.com',
    homeUrl: '/',
    searchUrl: '/search/?q=**',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://pornone.com/'
    },
    timeout: 20000,
    class_name: '最新&熱門&Anal&Amateur&亞洲&日本&MILF&Lesbian',
    class_url: 'newest&home&anal&amateur&asian&japanese&milf&lesbian',
    limit: 50,
    searchable: 1,
    quickSearch: 1,
    filterable: 0,
    play_parse: true,
    lazy: String.raw`js:
        function decode(s) {
            let value = String(s || '');
            for (let i = 0; i < 3; i++) {
                let next = value.replace(/&amp;/gi, '&').replace(/&quot;|&#0*34;/gi, '"').replace(/&#0*39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&nbsp;/gi, ' ');
                if (next === value) break;
                value = next;
            }
            return value.replace(/\\u002f/gi, '/').replace(/\\\//g, '/');
        }
        function attrs(tag) {
            let result = {}, re = /([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g, match;
            while ((match = re.exec(tag || ''))) result[match[1].toLowerCase()] = decode(match[3]);
            return result;
        }
        function videoId(value) {
            let inputValue = String(value || ''), found = '', re = /\/(\d{5,})(?=\/|_|\?|$)/g, match;
            while ((match = re.exec(inputValue))) found = match[1];
            return found;
        }
        function quality(value) {
            let match = String(value || '').match(/(?:^|[^0-9])(2160|1440|1080|720|480|360|240)(?:p|x\d+|[^0-9]|$)/i);
            return match ? parseInt(match[1], 10) : 0;
        }
        function sources(html, expectedId) {
            let player = String(html || '').match(/<video[^>]+id=["']pornone-video-player["'][^>]*>[\s\S]*?<\/video>/i);
            let list = [], seen = {};
            if (player) {
                let tags = player[0].match(/<source\b[^>]*>/ig) || [];
                tags.forEach(function (tag, index) {
                    let item = attrs(tag), url = String(item.src || '').trim();
                    if (String(item.type || '').toLowerCase() !== 'video/mp4' || !/^https:\/\/[^/]*\.pornone\.com\//i.test(url) || videoId(url) !== expectedId || seen[url]) return;
                    seen[url] = 1;
                    list.push({url: url, quality: parseInt(item.res, 10) || quality(item.label) || quality(url), index: index});
                });
            }
            list.sort(function (a, b) { return b.quality - a.quality || a.index - b.index; });
            return list;
        }
        function videoObject(html) {
            let scripts = String(html || '').match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/ig) || [];
            for (let i = 0; i < scripts.length; i++) {
                let body = scripts[i].replace(/^[\s\S]*?>/, '').replace(/<\/script>[\s\S]*$/i, '');
                try {
                    let data = JSON.parse(body), values = Array.isArray(data) ? data : (Array.isArray(data['@graph']) ? data['@graph'] : [data]);
                    for (let j = 0; j < values.length; j++) if (values[j] && values[j]['@type'] === 'VideoObject') return values[j];
                } catch (e) {}
            }
            return {};
        }
        let detail = String(input || ''), expectedId = videoId(detail), html = expectedId ? (request(detail) || '') : '';
        let list = sources(html, expectedId), media = list.length ? list[0].url : '';
        if (!media) {
            let data = videoObject(html), fallback = decode(data.contentUrl || '').trim();
            if (/^https:\/\/[^/]*\.pornone\.com\//i.test(fallback) && /\.mp4(?:\?|$)/i.test(fallback) && videoId(fallback) === expectedId) media = fallback;
        }
        input = media ? {
            jx: 0,
            parse: 0,
            url: media,
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
        function absolute(s) { let value = decode(s).trim(); return value.indexOf('//') === 0 ? 'https:' + value : (value.indexOf('/') === 0 ? HOST + value : value); }
        function detailUrl(s) {
            let value = absolute(s), cut = value.search(/[?#]/);
            if (cut >= 0) value = value.slice(0, cut);
            return /^https:\/\/pornone\.com\/[^/?#]+\/[^/?#]+\/\d+\/$/i.test(value) ? value : '';
        }
        function cards(html) {
            let list = [], seen = {}, re = /<a\b([^>]*\bclass=["'][^"']*\bvideocard\b[^"']*["'][^>]*)>([\s\S]*?)<\/a>/ig, match;
            while ((match = re.exec(html || ''))) {
                let href = match[1].match(/\bhref=["']([^"']+)["']/i), block = match[2];
                let id = href ? detailUrl(href[1]) : '';
                if (!id || seen[id]) continue;
                let image = block.match(/<img[^>]+(?:data-src|src)=["'](https?:\/\/[^"']+\/t\/[^"']+)["'][^>]*>/i);
                let title = block.match(/class=["'][^"']*\bvideotitle\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
                let alt = image ? image[0].match(/\balt=["']([^"']*)["']/i) : null;
                let duration = block.match(/class=["'][^"']*\bdurlabel\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
                let views = block.match(/\bviewsIcon\b[^>]*><\/i>\s*([^<]+)/i);
                let name = text(title ? title[1] : (alt ? alt[1] : ''));
                if (!name || !image) continue;
                seen[id] = 1;
                list.push({vod_id: id, vod_name: name, vod_pic: absolute(image[1]), vod_remarks: [duration ? text(duration[1]) : '', views ? text(views[1]) + ' views' : ''].filter(Boolean).join(' · ') || 'PornOne'});
            }
            return list;
        }
        VODS = cards(request(HOST + '/') || '').slice(0, rule.limit);
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
        function absolute(s) { let value = decode(s).trim(); return value.indexOf('//') === 0 ? 'https:' + value : (value.indexOf('/') === 0 ? HOST + value : value); }
        function detailUrl(s) {
            let value = absolute(s), cut = value.search(/[?#]/);
            if (cut >= 0) value = value.slice(0, cut);
            return /^https:\/\/pornone\.com\/[^/?#]+\/[^/?#]+\/\d+\/$/i.test(value) ? value : '';
        }
        function cards(html) {
            let list = [], seen = {}, re = /<a\b([^>]*\bclass=["'][^"']*\bvideocard\b[^"']*["'][^>]*)>([\s\S]*?)<\/a>/ig, match;
            while ((match = re.exec(html || ''))) {
                let href = match[1].match(/\bhref=["']([^"']+)["']/i), block = match[2];
                let id = href ? detailUrl(href[1]) : '';
                if (!id || seen[id]) continue;
                let image = block.match(/<img[^>]+(?:data-src|src)=["'](https?:\/\/[^"']+\/t\/[^"']+)["'][^>]*>/i);
                let title = block.match(/class=["'][^"']*\bvideotitle\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
                let alt = image ? image[0].match(/\balt=["']([^"']*)["']/i) : null;
                let duration = block.match(/class=["'][^"']*\bdurlabel\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
                let views = block.match(/\bviewsIcon\b[^>]*><\/i>\s*([^<]+)/i);
                let name = text(title ? title[1] : (alt ? alt[1] : ''));
                if (!name || !image) continue;
                seen[id] = 1;
                list.push({vod_id: id, vod_name: name, vod_pic: absolute(image[1]), vod_remarks: [duration ? text(duration[1]) : '', views ? text(views[1]) + ' views' : ''].filter(Boolean).join(' · ') || 'PornOne'});
            }
            return list;
        }
        let page = Math.max(1, parseInt(MY_PAGE, 10) || 1), category = String(MY_CATE || 'home').replace(/^\/+|\/+$/g, '');
        let url = category === 'home' ? HOST + (page > 1 ? '/' + page + '/' : '/') : HOST + '/' + category + '/' + (page > 1 ? page + '/' : '');
        VODS = cards(request(url) || '').slice(0, rule.limit);
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
            let match = String(value || '').match(/^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
            if (!match) return String(value || '');
            let hours = parseInt(match[1], 10) || 0, minutes = parseInt(match[2], 10) || 0, seconds = parseInt(match[3], 10) || 0;
            return hours ? hours + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0') : minutes + ':' + String(seconds).padStart(2, '0');
        }
        function videoObject(html) {
            let scripts = String(html || '').match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/ig) || [];
            for (let i = 0; i < scripts.length; i++) {
                let body = scripts[i].replace(/^[\s\S]*?>/, '').replace(/<\/script>[\s\S]*$/i, '');
                try {
                    let data = JSON.parse(body), values = Array.isArray(data) ? data : (Array.isArray(data['@graph']) ? data['@graph'] : [data]);
                    for (let j = 0; j < values.length; j++) if (values[j] && values[j]['@type'] === 'VideoObject') return values[j];
                } catch (e) {}
            }
            return {};
        }
        function meta(html, key) {
            let match = String(html || '').match(new RegExp('<meta[^>]+(?:property|name)=["\\\']' + key + '["\\\'][^>]+content=["\\\']([^"\\\']*)["\\\']', 'i'));
            if (!match) match = String(html || '').match(new RegExp('<meta[^>]+content=["\\\']([^"\\\']*)["\\\'][^>]+(?:property|name)=["\\\']' + key + '["\\\']', 'i'));
            return match ? text(match[1]) : '';
        }
        let detail = String(input || ''), html = request(detail) || '', data = videoObject(html);
        let titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        let title = text(data.name || meta(html, 'og:title') || (titleTag ? titleTag[1] : '')).replace(/\s*[—-]\s*PornOne(?:\s+ex\s+vPorn)?\s*$/i, '');
        let thumbnails = Array.isArray(data.thumbnailUrl) ? data.thumbnailUrl : [data.thumbnailUrl || meta(html, 'og:image')];
        let stats = data.interactionStatistic && data.interactionStatistic.userInteractionCount;
        let rating = data.aggregateRating && data.aggregateRating.ratingValue;
        let remarks = [duration(data.duration || ''), rating ? rating + '%' : '', stats ? stats + ' views' : ''].filter(Boolean).join(' · ');
        let content = [];
        if (data.uploadDate) content.push('日期：' + String(data.uploadDate).slice(0, 10));
        if (data.description) content.push(text(data.description));
        VOD = {
            vod_name: title || 'PornOne',
            vod_pic: decode(thumbnails[thumbnails.length - 1] || ''),
            vod_remarks: remarks || 'PornOne',
            vod_content: content.join('\n'),
            vod_play_from: html ? 'PornOne' : '',
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
        function absolute(s) { let value = decode(s).trim(); return value.indexOf('//') === 0 ? 'https:' + value : (value.indexOf('/') === 0 ? HOST + value : value); }
        function detailUrl(s) {
            let value = absolute(s), cut = value.search(/[?#]/);
            if (cut >= 0) value = value.slice(0, cut);
            return /^https:\/\/pornone\.com\/[^/?#]+\/[^/?#]+\/\d+\/$/i.test(value) ? value : '';
        }
        function cards(html) {
            let list = [], seen = {}, re = /<a\b([^>]*\bclass=["'][^"']*\bvideocard\b[^"']*["'][^>]*)>([\s\S]*?)<\/a>/ig, match;
            while ((match = re.exec(html || ''))) {
                let href = match[1].match(/\bhref=["']([^"']+)["']/i), block = match[2];
                let id = href ? detailUrl(href[1]) : '';
                if (!id || seen[id]) continue;
                let image = block.match(/<img[^>]+(?:data-src|src)=["'](https?:\/\/[^"']+\/t\/[^"']+)["'][^>]*>/i);
                let title = block.match(/class=["'][^"']*\bvideotitle\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
                let alt = image ? image[0].match(/\balt=["']([^"']*)["']/i) : null;
                let duration = block.match(/class=["'][^"']*\bdurlabel\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
                let name = text(title ? title[1] : (alt ? alt[1] : ''));
                if (!name || !image) continue;
                seen[id] = 1;
                list.push({title: name, pic_url: absolute(image[1]), desc: duration ? text(duration[1]) : 'PornOne', url: id});
            }
            return list;
        }
        let page = Math.max(1, parseInt(MY_PAGE, 10) || 1), query = encodeURIComponent(String(KEY || '').trim());
        let url = HOST + '/search/' + (page > 1 ? page : '') + '?q=' + query;
        setResult(cards(request(url) || '').slice(0, rule.limit));
    `
};
