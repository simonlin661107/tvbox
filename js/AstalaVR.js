var rule = {
    title: 'AstalaVR',
    host: 'https://astalavr.com',
    homeUrl: '/videos',
    url: '/videos/fyclass?page=fypage',
    searchUrl: '/search/**',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://astalavr.com/'
    },
    timeout: 20000,
    class_name: '最新&熱門&最佳&趨勢&正在觀看&最長&日本&巨乳&知名女優',
    class_url: 'latest&popular&best&trending&being-watched&longest&cat:japanese-VR&cat:big-tits-VR&cat:pornstar-VR',
    limit: 24,
    searchable: 1,
    quickSearch: 1,
    filterable: 0,
    play_parse: true,
    lazy: String.raw`js:
        function getHtml(url) {
            let html = request(url);
            if (!html || html.indexOf('cf-mitigated') > -1 || html.indexOf('<title>Just a moment') > -1) {
                html = render(url, rule.headers, rule.timeout);
            }
            return html || '';
        }
        function decodeUrl(s) {
            return (s || '').replace(/&amp;/g, '&').trim();
        }
        if (/^https?:\/\//.test(input) && input.indexOf('/videos/') > -1) {
            let detail = input;
            let html = getHtml(detail);
            let sources = [];
            let seen = {};
            let re = /<source[^>]+src=["']([^"']+)["'][^>]*?(?:quality=["']([^"']*)["'])?[^>]*>/ig;
            let match;
            while ((match = re.exec(html))) {
                let url = decodeUrl(match[1]);
                if (url && !seen[url]) {
                    seen[url] = 1;
                    sources.push({url: url, quality: (match[2] || '').trim()});
                }
            }
            sources.sort(function (a, b) {
                let aq = parseInt(a.quality, 10) || 0;
                let bq = parseInt(b.quality, 10) || 0;
                return aq - bq;
            });
            let selected = sources[0];
            if (selected) {
                input = {
                    jx: 0,
                    parse: 0,
                    url: selected.url,
                    fallbackUrl: detail,
                    header: JSON.stringify({
                        'user-agent': rule.headers['User-Agent'],
                        'referer': HOST + '/',
                        'origin': HOST,
                        'accept': '*/*'
                    })
                };
            } else {
                input = {jx: 1, parse: 1, url: detail};
            }
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
            return (s || '').replace(/<[^>]+>/g, ' ').replace(/&#0*39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
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
            let blocks = html.match(/<a[^>]+class=["'][^"']*video-item[^"']*["'][\s\S]*?<\/a>/ig) || [];
            blocks.forEach(function (block) {
                let link = block.match(/href=["']([^"']+)["']/i);
                let name = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
                let pic = block.match(/<img[^>]+src=["']([^"']+)["']/i);
                let duration = block.match(/<div[^>]+class=["'][^"']*text-white[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
                let views = block.match(/<span[^>]*>([^<]*views)<\/span>/i);
                let id = link ? absolute(link[1]) : '';
                let title = name ? text(name[1]) : '';
                if (!id || !title || seen[id] || !/\/videos\/[A-Za-z0-9]{5}\//.test(id)) return;
                seen[id] = 1;
                list.push({
                    vod_id: id,
                    vod_name: title,
                    vod_pic: pic ? absolute(pic[1]) : '',
                    vod_remarks: [duration ? text(duration[1]) : '', views ? text(views[1]) : ''].filter(Boolean).join(' · ') || 'AstalaVR'
                });
            });
            return list;
        }
        VODS = parseCards(getHtml(HOST + '/videos')).slice(0, rule.limit);
    `,
    一级: String.raw`js:
        function getHtml(url) {
            let html = request(url);
            if (!html || html.indexOf('cf-mitigated') > -1 || html.indexOf('<title>Just a moment') > -1) html = render(url, rule.headers, rule.timeout);
            return html || '';
        }
        function text(s) {
            return (s || '').replace(/<[^>]+>/g, ' ').replace(/&#0*39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
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
            let blocks = html.match(/<a[^>]+class=["'][^"']*video-item[^"']*["'][\s\S]*?<\/a>/ig) || [];
            blocks.forEach(function (block) {
                let link = block.match(/href=["']([^"']+)["']/i);
                let name = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
                let pic = block.match(/<img[^>]+src=["']([^"']+)["']/i);
                let duration = block.match(/<div[^>]+class=["'][^"']*text-white[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
                let views = block.match(/<span[^>]*>([^<]*views)<\/span>/i);
                let id = link ? absolute(link[1]) : '';
                let title = name ? text(name[1]) : '';
                if (!id || !title || seen[id] || !/\/videos\/[A-Za-z0-9]{5}\//.test(id)) return;
                seen[id] = 1;
                list.push({vod_id: id, vod_name: title, vod_pic: pic ? absolute(pic[1]) : '', vod_remarks: [duration ? text(duration[1]) : '', views ? text(views[1]) : ''].filter(Boolean).join(' · ') || 'AstalaVR'});
            });
            return list;
        }
        let page = parseInt(MY_PAGE, 10) || 1;
        let path = MY_CATE || 'latest';
        let url = path.indexOf('cat:') === 0 ? HOST + '/categories/' + encodeURIComponent(path.slice(4)) : HOST + '/videos' + (path === 'latest' ? '' : '/' + path);
        if (page > 1) url += '?page=' + page;
        VODS = parseCards(getHtml(url)).slice(0, rule.limit);
    `,
    二级: String.raw`js:
        function getHtml(url) {
            let html = request(url);
            if (!html || html.indexOf('cf-mitigated') > -1 || html.indexOf('<title>Just a moment') > -1) html = render(url, rule.headers, rule.timeout);
            return html || '';
        }
        function text(s) {
            return (s || '').replace(/<[^>]+>/g, ' ').replace(/&#0*39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
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
        let title = meta(html, 'og:title') || text((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [,'AstalaVR'])[1]);
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
        VOD = {
            vod_name: title || 'AstalaVR',
            vod_pic: pic,
            vod_remarks: duration || 'AstalaVR',
            vod_content: content,
            vod_play_from: html ? 'AstalaVR' : '',
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
            return (s || '').replace(/<[^>]+>/g, ' ').replace(/&#0*39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
        }
        function absolute(s) {
            let value = (s || '').replace(/&amp;/g, '&').trim();
            if (!value) return '';
            if (value.indexOf('/') === 0) return HOST + value;
            return value;
        }
        function parseCards(html) {
            let list = [];
            let seen = {};
            let blocks = html.match(/<a[^>]+class=["'][^"']*video-item[^"']*["'][\s\S]*?<\/a>/ig) || [];
            blocks.forEach(function (block) {
                let link = block.match(/href=["']([^"']+)["']/i);
                let name = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
                let pic = block.match(/<img[^>]+src=["']([^"']+)["']/i);
                let duration = block.match(/<div[^>]+class=["'][^"']*text-white[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
                let id = link ? absolute(link[1]) : '';
                let title = name ? text(name[1]) : '';
                if (!id || !title || seen[id] || !/\/videos\/[A-Za-z0-9]{5}\//.test(id)) return;
                seen[id] = 1;
                list.push({vod_id: id, vod_name: title, vod_pic: pic ? absolute(pic[1]) : '', vod_remarks: duration ? text(duration[1]) : 'AstalaVR'});
            });
            return list;
        }
        let keyword = (KEY || '').trim();
        let page = parseInt(MY_PAGE, 10) || 1;
        let url = HOST + '/search/' + encodeURIComponent(keyword).replace(/%20/g, '+') + (page > 1 ? '?page=' + page : '');
        let list = parseCards(getHtml(url));
        if (keyword) {
            let lower = keyword.toLowerCase();
            list = list.filter(function (item) { return item.vod_name.toLowerCase().indexOf(lower) > -1; });
        }
        VODS = list.slice(0, rule.limit);
    `
};
