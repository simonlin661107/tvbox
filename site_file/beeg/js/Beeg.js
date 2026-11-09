var rule = {
    title: 'Beeg',
    host: 'https://beeg.com',
    homeUrl: '/',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://beeg.com/'
    },
    timeout: 20000,
    class_name: '最新&Anal&日本&亞洲女孩&MILF&素人&1080P&4K&Lesbian&POV',
    class_url: 'index&anal&japanese&asiangirl&milf&amateurgirl&1080p&4k&lesbian&pov',
    limit: 40,
    searchable: 0,
    quickSearch: 0,
    filterable: 0,
    play_parse: true,
    lazy: String.raw`js:
        function fileId(value) {
            let inputValue = String(value || '').trim();
            if (/^\d+$/.test(inputValue)) return inputValue;
            let match = inputValue.match(/\/embed\/0(\d+)(?:[/?#]|$)/i)
                || inputValue.match(/\/-0(\d+)(?:[/?#]|$)/i)
                || inputValue.match(/\/(\d+)(?:[/?#]|$)/i);
            return match ? match[1] : '';
        }
        function object(value) { return value && typeof value === 'object' ? value : {}; }
        function detail(value) {
            if (Array.isArray(value)) {
                for (let i = 0; i < value.length; i++) {
                    let found = detail(value[i]);
                    if (found.file) return found;
                }
                return {};
            }
            let root = object(value);
            if (root.file) return root;
            let keys = ['data', 'result', 'item'];
            for (let i = 0; i < keys.length; i++) {
                let nested = root[keys[i]];
                if (nested && nested !== value) {
                    let found = detail(nested);
                    if (found.file) return found;
                }
            }
            return {};
        }
        function media(source) {
            let value = String(source || '').trim();
            if (!value) return '';
            if (/^https:\/\//i.test(value)) return value;
            if (value.indexOf('//') === 0) return 'https:' + value;
            return 'https://video.beeg.com/' + value.replace(/^\/+/, '');
        }
        function pick(source) {
            let item = object(source);
            let hls = object(item.hls_resources);
            let hlsTmp = object(item.hls_resources_tmp);
            let resources = object(item.resources);
            return media(hls.fl_cdn_multi || hlsTmp.fl_cdn_multi || item.fallback || resources.fl_cdn_240);
        }
        let directMedia = /^https?:\/\/(?:[^/]+\.)?video\.beeg\.com\//i.test(String(input || ''));
        let id = directMedia ? '' : fileId(input);
        let canonical = id ? HOST + '/-0' + id : String(input || '');
        let embed = id ? HOST + '/embed/0' + id : canonical;
        let playUrl = directMedia ? canonical : '';
        if (id) {
            let response = req('https://store.externulls.com/facts/file/' + id + '?tag=27173', {headers: {
                'User-Agent': rule.headers['User-Agent'],
                'Origin': HOST,
                'Referer': canonical,
                'Accept': 'application/json, text/plain, */*'
            }});
            try {
                let data = detail(JSON.parse(response.content || '{}'));
                playUrl = pick(data.file);
                if (!playUrl) {
                    let facts = Array.isArray(data.fc_facts) ? data.fc_facts : [];
                    for (let i = 0; i < facts.length && !playUrl; i++) playUrl = pick(facts[i]);
                }
            } catch (e) {}
        }
        input = playUrl ? {
            jx: 0,
            parse: 0,
            url: playUrl,
            fallbackUrl: embed,
            header: JSON.stringify({
                'user-agent': rule.headers['User-Agent'],
                'origin': HOST,
                'referer': id ? embed : HOST + '/',
                'accept': '*/*'
            })
        } : {
            jx: 0,
            parse: 1,
            url: embed || HOST + '/',
            fallbackUrl: embed || HOST + '/',
            header: JSON.stringify({
                'user-agent': rule.headers['User-Agent'],
                'referer': canonical || HOST + '/'
            })
        };
    `,
    推荐: String.raw`js:
        function object(value) { return value && typeof value === 'object' ? value : {}; }
        function array(value) {
            if (Array.isArray(value)) return value;
            let root = object(value);
            let keys = ['data', 'items', 'result'];
            for (let i = 0; i < keys.length; i++) if (Array.isArray(root[keys[i]])) return root[keys[i]];
            return [];
        }
        function title(file, id) {
            let data = Array.isArray(file.data) ? file.data : [];
            for (let i = 0; i < data.length; i++) {
                if (String(data[i].cd_column || '').toLowerCase() === 'sf_name' && data[i].cd_value) return String(data[i].cd_value).trim();
            }
            return 'Beeg #' + id;
        }
        function fact(record) {
            let facts = Array.isArray(record.fc_facts) ? record.fc_facts : [];
            for (let i = 0; i < facts.length; i++) if (Array.isArray(facts[i].fc_thumbs) && facts[i].fc_thumbs.length) return facts[i];
            return facts.length ? object(facts[0]) : {};
        }
        function duration(seconds) {
            let value = parseInt(seconds, 10);
            if (!isFinite(value) || value <= 0) return '';
            let hours = Math.floor(value / 3600);
            let minutes = Math.floor(value % 3600 / 60);
            let secs = value % 60;
            return hours ? hours + ':' + String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0') : minutes + ':' + String(secs).padStart(2, '0');
        }
        function quality(file) {
            let height = parseInt(file.fl_height, 10) || 0;
            let width = parseInt(file.fl_width, 10) || 0;
            if (width >= 3800 || height >= 2100) return '4K';
            return height >= 240 ? height + 'P' : '';
        }
        function views(value) {
            let number = parseInt(value, 10);
            if (!isFinite(number) || number <= 0) return '';
            if (number >= 1000000) return (number / 1000000).toFixed(number >= 10000000 ? 0 : 1).replace(/\.0$/, '') + 'M views';
            if (number >= 1000) return (number / 1000).toFixed(number >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'K views';
            return number + ' views';
        }
        function cards(value) {
            let list = [];
            let seen = {};
            array(value).forEach(function (recordValue) {
                let record = object(recordValue);
                let file = object(record.file && typeof record.file === 'object' ? record.file : record);
                let id = String(file.id || '').trim();
                if (!/^\d+$/.test(id) || seen[id]) return;
                let selected = fact(record);
                let thumbs = Array.isArray(selected.fc_thumbs) ? selected.fc_thumbs : [];
                let offset = 0;
                for (let i = 0; i < thumbs.length; i++) {
                    let number = parseInt(thumbs[i], 10);
                    if (isFinite(number) && number >= 0) { offset = number; break; }
                }
                seen[id] = 1;
                let remarks = [duration(file.fl_duration), quality(file), views(selected.fc_st_views)].filter(Boolean).join(' · ');
                list.push({
                    vod_id: HOST + '/-0' + id,
                    vod_name: title(file, id),
                    vod_pic: 'https://thumbs.externulls.com/videos/' + id + '/' + offset + '.webp?w=480',
                    vod_remarks: remarks || 'Beeg'
                });
            });
            return list;
        }
        let response = req('https://store.externulls.com/tag/videos/index?limit=' + rule.limit + '&offset=0', {headers: {
            'User-Agent': rule.headers['User-Agent'], 'Origin': HOST, 'Referer': HOST + '/', 'Accept': 'application/json, text/plain, */*'
        }});
        try { VODS = cards(JSON.parse(response.content || '[]')).slice(0, rule.limit); } catch (e) { VODS = []; }
    `,
    一级: String.raw`js:
        function object(value) { return value && typeof value === 'object' ? value : {}; }
        function array(value) {
            if (Array.isArray(value)) return value;
            let root = object(value);
            let keys = ['data', 'items', 'result'];
            for (let i = 0; i < keys.length; i++) if (Array.isArray(root[keys[i]])) return root[keys[i]];
            return [];
        }
        function title(file, id) {
            let data = Array.isArray(file.data) ? file.data : [];
            for (let i = 0; i < data.length; i++) {
                if (String(data[i].cd_column || '').toLowerCase() === 'sf_name' && data[i].cd_value) return String(data[i].cd_value).trim();
            }
            return 'Beeg #' + id;
        }
        function fact(record) {
            let facts = Array.isArray(record.fc_facts) ? record.fc_facts : [];
            for (let i = 0; i < facts.length; i++) if (Array.isArray(facts[i].fc_thumbs) && facts[i].fc_thumbs.length) return facts[i];
            return facts.length ? object(facts[0]) : {};
        }
        function duration(seconds) {
            let value = parseInt(seconds, 10);
            if (!isFinite(value) || value <= 0) return '';
            let hours = Math.floor(value / 3600);
            let minutes = Math.floor(value % 3600 / 60);
            let secs = value % 60;
            return hours ? hours + ':' + String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0') : minutes + ':' + String(secs).padStart(2, '0');
        }
        function quality(file) {
            let height = parseInt(file.fl_height, 10) || 0;
            let width = parseInt(file.fl_width, 10) || 0;
            if (width >= 3800 || height >= 2100) return '4K';
            return height >= 240 ? height + 'P' : '';
        }
        function views(value) {
            let number = parseInt(value, 10);
            if (!isFinite(number) || number <= 0) return '';
            if (number >= 1000000) return (number / 1000000).toFixed(number >= 10000000 ? 0 : 1).replace(/\.0$/, '') + 'M views';
            if (number >= 1000) return (number / 1000).toFixed(number >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'K views';
            return number + ' views';
        }
        function cards(value) {
            let list = [];
            let seen = {};
            array(value).forEach(function (recordValue) {
                let record = object(recordValue);
                let file = object(record.file && typeof record.file === 'object' ? record.file : record);
                let id = String(file.id || '').trim();
                if (!/^\d+$/.test(id) || seen[id]) return;
                let selected = fact(record);
                let thumbs = Array.isArray(selected.fc_thumbs) ? selected.fc_thumbs : [];
                let offset = 0;
                for (let i = 0; i < thumbs.length; i++) {
                    let number = parseInt(thumbs[i], 10);
                    if (isFinite(number) && number >= 0) { offset = number; break; }
                }
                seen[id] = 1;
                let remarks = [duration(file.fl_duration), quality(file), views(selected.fc_st_views)].filter(Boolean).join(' · ');
                list.push({vod_id: HOST + '/-0' + id, vod_name: title(file, id), vod_pic: 'https://thumbs.externulls.com/videos/' + id + '/' + offset + '.webp?w=480', vod_remarks: remarks || 'Beeg'});
            });
            return list;
        }
        let page = Math.max(1, parseInt(MY_PAGE, 10) || 1);
        let slugs = String(MY_CATE || 'index').split(',').map(function (value) { return encodeURIComponent(value.trim().toLowerCase()); }).filter(Boolean).join(',') || 'index';
        let api = 'https://store.externulls.com/tag/videos/' + slugs + '?limit=' + rule.limit + '&offset=' + ((page - 1) * rule.limit);
        let response = req(api, {headers: {'User-Agent': rule.headers['User-Agent'], 'Origin': HOST, 'Referer': HOST + '/', 'Accept': 'application/json, text/plain, */*'}});
        try { VODS = cards(JSON.parse(response.content || '[]')).slice(0, rule.limit); } catch (e) { VODS = []; }
    `,
    二级: String.raw`js:
        function object(value) { return value && typeof value === 'object' ? value : {}; }
        function fileId(value) {
            let inputValue = String(value || '').trim();
            if (/^\d+$/.test(inputValue)) return inputValue;
            let match = inputValue.match(/\/embed\/0(\d+)(?:[/?#]|$)/i) || inputValue.match(/\/-0(\d+)(?:[/?#]|$)/i) || inputValue.match(/\/(\d+)(?:[/?#]|$)/i);
            return match ? match[1] : '';
        }
        function detail(value) {
            if (Array.isArray(value)) {
                for (let i = 0; i < value.length; i++) { let found = detail(value[i]); if (found.file) return found; }
                return {};
            }
            let root = object(value);
            if (root.file) return root;
            let keys = ['data', 'result', 'item'];
            for (let i = 0; i < keys.length; i++) {
                let nested = root[keys[i]];
                if (nested && nested !== value) { let found = detail(nested); if (found.file) return found; }
            }
            return {};
        }
        function title(file, id) {
            let data = Array.isArray(file.data) ? file.data : [];
            for (let i = 0; i < data.length; i++) if (String(data[i].cd_column || '').toLowerCase() === 'sf_name' && data[i].cd_value) return String(data[i].cd_value).trim();
            return 'Beeg #' + id;
        }
        function fact(data) {
            let facts = Array.isArray(data.fc_facts) ? data.fc_facts : [];
            for (let i = 0; i < facts.length; i++) if (Array.isArray(facts[i].fc_thumbs) && facts[i].fc_thumbs.length) return facts[i];
            return facts.length ? object(facts[0]) : {};
        }
        function duration(seconds) {
            let value = parseInt(seconds, 10);
            if (!isFinite(value) || value <= 0) return '';
            let hours = Math.floor(value / 3600), minutes = Math.floor(value % 3600 / 60), secs = value % 60;
            return hours ? hours + ':' + String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0') : minutes + ':' + String(secs).padStart(2, '0');
        }
        function quality(file) {
            let height = parseInt(file.fl_height, 10) || 0, width = parseInt(file.fl_width, 10) || 0;
            if (width >= 3800 || height >= 2100) return '4K';
            return height >= 240 ? height + 'P' : '';
        }
        function views(value) {
            let number = parseInt(value, 10);
            if (!isFinite(number) || number <= 0) return '';
            if (number >= 1000000) return (number / 1000000).toFixed(number >= 10000000 ? 0 : 1).replace(/\.0$/, '') + 'M views';
            if (number >= 1000) return (number / 1000).toFixed(number >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'K views';
            return number + ' views';
        }
        let id = fileId(input);
        let canonical = id ? HOST + '/-0' + id : String(input || '');
        let data = {};
        if (id) {
            let response = req('https://store.externulls.com/facts/file/' + id + '?tag=27173', {headers: {'User-Agent': rule.headers['User-Agent'], 'Origin': HOST, 'Referer': canonical, 'Accept': 'application/json, text/plain, */*'}});
            try { data = detail(JSON.parse(response.content || '{}')); } catch (e) {}
        }
        let file = object(data.file);
        let selected = fact(data);
        let thumbs = Array.isArray(selected.fc_thumbs) ? selected.fc_thumbs : [];
        let offset = 0;
        for (let i = 0; i < thumbs.length; i++) { let number = parseInt(thumbs[i], 10); if (isFinite(number) && number >= 0) { offset = number; break; } }
        let labels = [], seen = {};
        let tags = Array.isArray(data.tags) ? data.tags : [];
        for (let i = 0; i < tags.length && labels.length < 12; i++) {
            let label = String(tags[i].tg_name || '').trim();
            let key = label.toLowerCase();
            if (label && !seen[key]) { seen[key] = 1; labels.push(label); }
        }
        let meta = [duration(file.fl_duration), quality(file), views(selected.fc_st_views)].filter(Boolean);
        let date = String(selected.fc_created || '').slice(0, 10);
        let content = [];
        if (date) content.push('日期：' + date);
        if (labels.length) content.push('標籤：' + labels.join('、'));
        VOD = {
            vod_name: title(file, id || 'Unknown'),
            vod_pic: id ? 'https://thumbs.externulls.com/videos/' + id + '/' + offset + '.webp?w=480' : '',
            vod_remarks: meta.join(' · ') || 'Beeg',
            vod_content: content.join('\n'),
            vod_play_from: id ? 'Beeg' : '',
            vod_play_url: id ? (title(file, id) || '播放') + '$' + canonical : ''
        };
    `,
    搜索: String.raw`js:
        setResult([]);
    `
};
