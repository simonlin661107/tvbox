var rule = {
    title: 'HQPorner',
    host: 'https://m.hqporner.com',
    homeUrl: '/',
    searchUrl: '/?q=**',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://m.hqporner.com/'
    },
    timeout: 20000,
    class_name: '最新&熱門&1080P&4K&亞洲&日本&素人&熟女',
    class_url: 'home&top&category/1080p-porn&category/4k-porn&category/asian&category/japanese-girls-porn&category/amateur&category/milf',
    limit: 40,
    searchable: 1,
    quickSearch: 1,
    filterable: 0,
    play_parse: true,
    lazy: String.raw`js:
        function decode(s) {
            let value = s || '';
            for (let i = 0; i < 3; i++) {
                let next = value.replace(/&amp;/gi, '&').replace(/&quot;|&#0*34;/gi, '"').replace(/&#0*39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&nbsp;/gi, ' ');
                if (next === value) break;
                value = next;
            }
            return value.replace(/\\u002f/gi, '/').replace(/\\\//g, '/').replace(/\\(["'])/g, '$1').replace(/\\\\/g, '\\');
        }
        function absolute(s) {
            let value = decode(s).trim().replace(/[\\"']+$/g, '');
            if (value.indexOf('//') === 0) return 'https:' + value;
            if (value.indexOf('/') === 0) return HOST + value;
            return value;
        }
        function iframe(html) {
            let match = (html || '').match(/<iframe[^>]+src=["']([^"']*mydaddy\.cc\/video\/[^"']+)["']/i);
            return match ? absolute(match[1]) : '';
        }
        function quality(s) {
            let values = String(s || '').match(/(?:^|[^0-9])(2160|1440|1080|720|480|360|240)(?:p|[^0-9]|$)/ig) || [];
            let best = 0;
            values.forEach(function (value) {
                let number = parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
                if (number > best) best = number;
            });
            return best;
        }
        function sources(html) {
            let decoded = decode(html || '');
            let list = [];
            let seen = {};
            let re = /(?:src|href)\s*=\s*["']([^"']+\.mp4(?:\?[^"']*)?)["']/ig;
            let match;
            while ((match = re.exec(decoded))) {
                let media = absolute(match[1]);
                if (!/^https:\/\/[^/]*(?:mydaddy\.cc|bigcdn\.cc)\//i.test(media) || seen[media]) continue;
                let context = decoded.slice(Math.max(0, match.index - 120), Math.min(decoded.length, re.lastIndex + 160));
                seen[media] = 1;
                let mediaQuality = quality(media);
                list.push({url: media, quality: mediaQuality || quality(context)});
            }
            list.sort(function (a, b) { return b.quality - a.quality; });
            return list;
        }
        let detail = input;
        let embed = '';
        let media = '';
        if (/^https?:\/\/[^/]*hqporner\.com\/hdporn\//i.test(detail)) {
            let html = request(detail) || '';
            embed = iframe(html);
        } else if (/^https?:\/\/mydaddy\.cc\/video\//i.test(detail)) {
            embed = detail;
        } else if (/^https?:\/\//i.test(detail)) {
            media = detail;
        }
        if (embed && !media) {
            let response = req(embed, {headers: {
                'User-Agent': rule.headers['User-Agent'],
                'Referer': /^https?:\/\/[^/]*hqporner\.com\//i.test(detail) ? detail : HOST + '/'
            }});
            let list = sources(response.content || '');
            if (list.length) media = list[0].url;
        }
        if (media) {
            input = {
                jx: 0,
                parse: 0,
                url: media,
                fallbackUrl: embed || detail,
                header: JSON.stringify({
                    'user-agent': rule.headers['User-Agent'],
                    'referer': embed || detail,
                    'origin': embed ? embed.match(/^https?:\/\/[^/]+/i)[0] : HOST,
                    'accept': '*/*'
                })
            };
        } else {
            input = {
                jx: 0,
                parse: 1,
                url: embed || detail,
                fallbackUrl: embed || detail,
                header: JSON.stringify({
                    'user-agent': rule.headers['User-Agent'],
                    'referer': detail || HOST + '/'
                })
            };
        }
    `,
    推荐: String.raw`js:
        function decode(s) {
            let value = s || '';
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
            let blocks = (html || '').split(/<div[^>]+class=["'][^"']*\bimg-container\b[^"']*["'][^>]*>/i);
            for (let i = 1; i < blocks.length; i++) {
                let block = blocks[i].slice(0, 5000);
                let link = block.match(/<a[^>]+href=["'](\/hdporn\/\d+-[^"']+\.html)["']/i);
                let image = block.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/i);
                let alt = image ? image[0].match(/alt=["']([^"']*)["']/i) : null;
                let heading = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
                let duration = block.match(/<span[^>]+class=["'][^"']*\bmeta_data\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
                let id = link ? absolute(link[1]) : '';
                let title = text(alt ? alt[1] : (heading ? heading[1] : ''));
                if (!id || !title || !image || seen[id]) continue;
                seen[id] = 1;
                list.push({vod_id: id, vod_name: title, vod_pic: absolute(image[1]), vod_remarks: duration ? text(duration[1]) : 'HQPorner'});
            }
            return list;
        }
        VODS = parseCards(request(HOST + '/') || '').slice(0, rule.limit);
    `,
    一级: String.raw`js:
        function decode(s) {
            let value = s || '';
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
            let blocks = (html || '').split(/<div[^>]+class=["'][^"']*\bimg-container\b[^"']*["'][^>]*>/i);
            for (let i = 1; i < blocks.length; i++) {
                let block = blocks[i].slice(0, 5000);
                let link = block.match(/<a[^>]+href=["'](\/hdporn\/\d+-[^"']+\.html)["']/i);
                let image = block.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/i);
                let alt = image ? image[0].match(/alt=["']([^"']*)["']/i) : null;
                let heading = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
                let duration = block.match(/<span[^>]+class=["'][^"']*\bmeta_data\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
                let id = link ? absolute(link[1]) : '';
                let title = text(alt ? alt[1] : (heading ? heading[1] : ''));
                if (!id || !title || !image || seen[id]) continue;
                seen[id] = 1;
                list.push({vod_id: id, vod_name: title, vod_pic: absolute(image[1]), vod_remarks: duration ? text(duration[1]) : 'HQPorner'});
            }
            return list;
        }
        let page = parseInt(MY_PAGE, 10) || 1;
        let category = MY_CATE || 'home';
        let path = '';
        if (category === 'home') path = page > 1 ? '/hdporn/' + page : '/';
        else if (category === 'top') path = '/top' + (page > 1 ? '/' + page : '');
        else path = '/' + category + (page > 1 ? '/' + page : '');
        VODS = parseCards(request(HOST + path) || '').slice(0, rule.limit);
    `,
    二级: String.raw`js:
        function decode(s) {
            let value = s || '';
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
        function meta(html, key) {
            let re = new RegExp('<meta[^>]+(?:property|name)=["\\\']' + key + '["\\\'][^>]+content=["\\\']([^"\\\']*)["\\\']', 'i');
            let match = html.match(re);
            if (!match) {
                re = new RegExp('<meta[^>]+content=["\\\']([^"\\\']*)["\\\'][^>]+(?:property|name)=["\\\']' + key + '["\\\']', 'i');
                match = html.match(re);
            }
            return match ? text(match[1]) : '';
        }
        let html = request(input) || '';
        let heading = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        let titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        let title = text(heading ? heading[1] : (titleTag ? titleTag[1] : '')).replace(/\s*-\s*HQporner\.com\s*$/i, '');
        let content = meta(html, 'description');
        let duration = '';
        let durationMatch = content.match(/(?:duration is\s*)?([0-9]+\s*min(?:ute)?s?\s*[0-9]+\s*sec(?:ond)?s?)/i) || html.match(/<span[^>]+class=["'][^"']*\bmeta_data\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
        if (durationMatch) duration = text(durationMatch[1]);
        let embedMatch = html.match(/<iframe[^>]+src=["']([^"']*mydaddy\.cc\/video\/[^"']+)["']/i);
        let pic = '';
        if (embedMatch) {
            let embed = absolute(embedMatch[1]);
            let response = req(embed, {headers: {'User-Agent': rule.headers['User-Agent'], 'Referer': input}});
            let poster = (response.content || '').match(/poster=\\?["']([^"']+)["']/i);
            if (poster) pic = absolute(poster[1].replace(/\\+$/g, ''));
        }
        VOD = {
            vod_name: title || 'HQPorner',
            vod_pic: pic,
            vod_remarks: duration || 'HQPorner',
            vod_content: content,
            vod_play_from: html ? 'HQPorner' : '',
            vod_play_url: html ? (title || '播放') + '$' + input : ''
        };
    `,
    搜索: String.raw`js:
        function decode(s) {
            let value = s || '';
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
            let blocks = (html || '').split(/<div[^>]+class=["'][^"']*\bimg-container\b[^"']*["'][^>]*>/i);
            for (let i = 1; i < blocks.length; i++) {
                let block = blocks[i].slice(0, 5000);
                let link = block.match(/<a[^>]+href=["'](\/hdporn\/\d+-[^"']+\.html)["']/i);
                let image = block.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/i);
                let alt = image ? image[0].match(/alt=["']([^"']*)["']/i) : null;
                let heading = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
                let duration = block.match(/<span[^>]+class=["'][^"']*\bmeta_data\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
                let id = link ? absolute(link[1]) : '';
                let title = text(alt ? alt[1] : (heading ? heading[1] : ''));
                if (!id || !title || !image || seen[id]) continue;
                seen[id] = 1;
                list.push({title: title, pic_url: absolute(image[1]), desc: duration ? text(duration[1]) : 'HQPorner', url: id});
            }
            return list;
        }
        let page = parseInt(MY_PAGE, 10) || 1;
        let url = HOST + '/?q=' + encodeURIComponent((KEY || '').trim()) + (page > 1 ? '&p=' + page : '');
        setResult(parseCards(request(url) || '').slice(0, rule.limit));
    `
};
