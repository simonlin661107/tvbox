var rule = {
    title: 'XNXX',
    host: 'https://www.xnxx.com',
    homeUrl: '/best',
    searchUrl: '/search/**',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://www.xnxx.com/'
    },
    timeout: 10000,
    class_name: '熱門&今日精選&亞洲&日本&中文&素人&MILF',
    class_url: 'hits&todays-selection&search/asian_woman&search/japanese&search/%E4%B8%AD%E6%96%87&search/amateur&search/milf',
    limit: 50,
    searchable: 1,
    quickSearch: 1,
    filterable: 0,
    play_parse: true,
    lazy: String.raw`js:
        function decodeUrl(s) {
            let value = (s || '').trim();
            try { value = JSON.parse('"' + value + '"'); } catch (e) {}
            return value.replace(/&amp;/g, '&');
        }
        function direct(url, referer) {
            return {
                jx: 0,
                parse: 0,
                url: url,
                header: JSON.stringify({
                    'user-agent': rule.headers['User-Agent'],
                    'referer': referer || HOST + '/',
                    'origin': HOST,
                    'accept': '*/*'
                })
            };
        }
        let parts = input.split('@@');
        let target = parts[0];
        let detail = parts.length > 1 ? decodeURIComponent(parts.slice(1).join('@@')) : '';
        if (/^https?:\/\//.test(target) && target.indexOf('/video-') < 0) {
            input = direct(target, detail);
        } else if (/^https?:\/\//.test(target)) {
            detail = target;
            let html = request(detail) || '';
            let hls = html.match(/html5player\.setVideoHLS\('([^']+)'\);/);
            let high = html.match(/html5player\.setVideoUrlHigh\('([^']+)'\);/);
            let low = html.match(/html5player\.setVideoUrlLow\('([^']+)'\);/);
            let picked = decodeUrl(hls ? hls[1] : (high ? high[1] : (low ? low[1] : '')));
            input = picked ? direct(picked, detail) : {
                jx: 0,
                parse: 1,
                url: detail,
                header: JSON.stringify({
                    'user-agent': rule.headers['User-Agent'],
                    'referer': HOST + '/'
                })
            };
        }
    `,
    推荐: String.raw`js:
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
            let blocks = (html || '').split(/<div\s+id=["'](?:video_[^"']+|video-thumb-[^"']+)["'][^>]*>/i);
            for (let i = 1; i < blocks.length; i++) {
                let block = blocks[i].slice(0, 8000);
                let link = block.match(/<a[^>]+href=["'](\/video-[a-z0-9]+\/[^"']*)["'][^>]*>/i);
                if (!link) continue;
                let id = absolute(link[1]);
                if (seen[id]) continue;
                let title = '';
                let titleLink = block.match(/<a[^>]+class=["'][^"']*\btitle\b[^"']*["'][^>]+title=["']([^"']*)["']/i)
                    || block.match(/<a[^>]+href=["']\/video-[^"']+["'][^>]+title=["']([^"']*)["']/i);
                if (titleLink) title = text(titleLink[1]);
                if (!title) {
                    let titleBody = block.match(/<a[^>]+class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
                    if (titleBody) title = text(titleBody[1]);
                }
                if (!title) continue;
                let image = block.match(/<img[^>]+data-src=["']([^"']+)["']/i)
                    || block.match(/<img[^>]+data-sfwthumb=["']([^"']+)["']/i);
                if (!image) {
                    let src = block.match(/<img[^>]+src=["']([^"']+)["']/i);
                    if (src && !/(?:lightbox-)?blank\.gif/i.test(src[1])) image = src;
                }
                let metadata = block.match(/<(?:p|div)[^>]+class=["'][^"']*\bmetadata\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:p|div)>/i);
                seen[id] = 1;
                list.push({
                    vod_id: id,
                    vod_name: title,
                    vod_pic: image ? absolute(image[1]) : '',
                    vod_remarks: metadata ? text(metadata[1]).replace(/\s+/g, ' · ') : 'XNXX'
                });
            }
            return list;
        }
        VODS = parseCards(request(HOST + '/hits')).slice(0, rule.limit);
    `,
    一级: String.raw`js:
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
            let blocks = (html || '').split(/<div\s+id=["'](?:video_[^"']+|video-thumb-[^"']+)["'][^>]*>/i);
            for (let i = 1; i < blocks.length; i++) {
                let block = blocks[i].slice(0, 8000);
                let link = block.match(/<a[^>]+href=["'](\/video-[a-z0-9]+\/[^"']*)["'][^>]*>/i);
                if (!link) continue;
                let id = absolute(link[1]);
                if (seen[id]) continue;
                let title = '';
                let titleLink = block.match(/<a[^>]+class=["'][^"']*\btitle\b[^"']*["'][^>]+title=["']([^"']*)["']/i)
                    || block.match(/<a[^>]+href=["']\/video-[^"']+["'][^>]+title=["']([^"']*)["']/i);
                if (titleLink) title = text(titleLink[1]);
                if (!title) {
                    let titleBody = block.match(/<a[^>]+class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
                    if (titleBody) title = text(titleBody[1]);
                }
                if (!title) continue;
                let image = block.match(/<img[^>]+data-src=["']([^"']+)["']/i)
                    || block.match(/<img[^>]+data-sfwthumb=["']([^"']+)["']/i);
                if (!image) {
                    let src = block.match(/<img[^>]+src=["']([^"']+)["']/i);
                    if (src && !/(?:lightbox-)?blank\.gif/i.test(src[1])) image = src;
                }
                let metadata = block.match(/<(?:p|div)[^>]+class=["'][^"']*\bmetadata\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:p|div)>/i);
                seen[id] = 1;
                list.push({vod_id: id, vod_name: title, vod_pic: image ? absolute(image[1]) : '', vod_remarks: metadata ? text(metadata[1]).replace(/\s+/g, ' · ') : 'XNXX'});
            }
            return list;
        }
        let page = parseInt(MY_PAGE, 10) || 1;
        let url = HOST + '/' + (MY_CATE || 'hits') + (page > 1 ? '/' + (page - 1) : '');
        VODS = parseCards(request(url)).slice(0, rule.limit);
    `,
    二级: String.raw`js:
        function text(s) {
            let value = s || '';
            try { value = JSON.parse('"' + value + '"'); } catch (e) {}
            return value.replace(/<[^>]+>/g, ' ').replace(/&#0*39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
        }
        function url(s) {
            let value = (s || '').trim();
            try { value = JSON.parse('"' + value + '"'); } catch (e) {}
            return value.replace(/&amp;/g, '&');
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
        let tm = html.match(/html5player\.setVideoTitle\('([\s\S]*?)'\);/);
        let title = tm ? text(tm[1]) : meta(html, 'og:title');
        if (!title) title = text(pdfh(html, 'title&&Text').replace(/\s*-\s*XNXX\.COM.*$/i, ''));
        let pm = html.match(/html5player\.setThumbUrl\('([^']+)'\);/) || html.match(/html5player\.setThumbUrl169\('([^']+)'\);/);
        let pic = pm ? url(pm[1]) : meta(html, 'og:image');
        let content = meta(html, 'og:description') || meta(html, 'description');
        let seconds = parseInt(meta(html, 'og:duration'), 10) || 0;
        let remark = seconds ? Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0') : 'XNXX';
        let plays = [];
        let seen = {};
        function push(label, value) {
            let media = url(value);
            if (!media || seen[media]) return;
            seen[media] = 1;
            plays.push(label + '$' + media + '@@' + encodeURIComponent(input));
        }
        let hls = html.match(/html5player\.setVideoHLS\('([^']+)'\);/);
        let high = html.match(/html5player\.setVideoUrlHigh\('([^']+)'\);/);
        let low = html.match(/html5player\.setVideoUrlLow\('([^']+)'\);/);
        if (hls) push('HLS', hls[1]);
        if (high) push('MP4-High', high[1]);
        if (low) push('MP4-Low', low[1]);
        if (!plays.length) plays.push((title || '播放') + '$' + input);
        VOD = {
            vod_name: title || 'XNXX',
            vod_pic: pic,
            vod_remarks: remark,
            vod_content: content,
            vod_play_from: 'XNXX',
            vod_play_url: plays.join('#')
        };
    `,
    搜索: String.raw`js:
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
            let blocks = (html || '').split(/<div\s+id=["'](?:video_[^"']+|video-thumb-[^"']+)["'][^>]*>/i);
            for (let i = 1; i < blocks.length; i++) {
                let block = blocks[i].slice(0, 8000);
                let link = block.match(/<a[^>]+href=["'](\/video-[a-z0-9]+\/[^"']*)["'][^>]*>/i);
                if (!link) continue;
                let id = absolute(link[1]);
                if (seen[id]) continue;
                let title = '';
                let titleLink = block.match(/<a[^>]+class=["'][^"']*\btitle\b[^"']*["'][^>]+title=["']([^"']*)["']/i)
                    || block.match(/<a[^>]+href=["']\/video-[^"']+["'][^>]+title=["']([^"']*)["']/i);
                if (titleLink) title = text(titleLink[1]);
                if (!title) {
                    let titleBody = block.match(/<a[^>]+class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
                    if (titleBody) title = text(titleBody[1]);
                }
                if (!title) continue;
                let image = block.match(/<img[^>]+data-src=["']([^"']+)["']/i)
                    || block.match(/<img[^>]+data-sfwthumb=["']([^"']+)["']/i);
                if (!image) {
                    let src = block.match(/<img[^>]+src=["']([^"']+)["']/i);
                    if (src && !/(?:lightbox-)?blank\.gif/i.test(src[1])) image = src;
                }
                let metadata = block.match(/<(?:p|div)[^>]+class=["'][^"']*\bmetadata\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:p|div)>/i);
                seen[id] = 1;
                list.push({vod_id: id, vod_name: title, vod_pic: image ? absolute(image[1]) : '', vod_remarks: metadata ? text(metadata[1]).replace(/\s+/g, ' · ') : 'XNXX'});
            }
            return list;
        }
        let page = parseInt(MY_PAGE, 10) || 1;
        let url = HOST + '/search/' + encodeURIComponent((KEY || '').trim()) + (page > 1 ? '/' + (page - 1) : '');
        VODS = parseCards(request(url)).slice(0, rule.limit);
    `
};
