package com.fongmi.android.tv.server.process;

import android.text.TextUtils;

import com.fongmi.android.tv.App;
import com.fongmi.android.tv.api.SiteApi;
import com.fongmi.android.tv.api.config.VodConfig;
import com.fongmi.android.tv.bean.Config;
import com.fongmi.android.tv.bean.Result;
import com.fongmi.android.tv.bean.Site;
import com.fongmi.android.tv.impl.Callback;
import com.fongmi.android.tv.impl.ParseCallback;
import com.fongmi.android.tv.player.ParseJob;
import com.fongmi.android.tv.model.SearchTask;
import com.fongmi.android.tv.server.impl.Process;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import fi.iki.elonen.NanoHTTPD;
import fi.iki.elonen.NanoHTTPD.IHTTPSession;
import fi.iki.elonen.NanoHTTPD.Response;

/**
 * 除錯用：直接呼叫目前已載入設定中的站點爬蟲，供自動化驗證點播源。
 * GET /spider?do=load&url=...            載入點播設定並回傳站點清單
 * GET /spider?do=sites                   列出目前站點
 * GET /spider?do=home&key=...
 * GET /spider?do=category&key=...&tid=...&pg=1&ext={json}
 * GET /spider?do=detail&key=...&id=...
 * GET /spider?do=play&key=...&flag=...&id=...
 * GET /spider?do=search&key=...&wd=...&quick=false
 * 共同參數 timeout（秒，預設 30）
 */
public class SpiderTest implements Process {

    private static final ExecutorService EXECUTOR = Executors.newCachedThreadPool();

    @Override
    public boolean isRequest(IHTTPSession session, String url) {
        return url.startsWith("/spider");
    }

    @Override
    public Response doResponse(IHTTPSession session, String url, Map<String, String> files) {
        Map<String, String> params = session.getParms();
        String action = params.get("do");
        int timeout = parseInt(params.get("timeout"), 30);
        long start = System.currentTimeMillis();
        JsonObject out = new JsonObject();
        try {
            String body;
            if ("load".equals(action)) body = load(params.get("url"), timeout);
            else if ("sites".equals(action)) body = sites();
            else if ("parse".equals(action)) body = parse(params, timeout);
            else body = run(() -> call(action, params), timeout);
            out.addProperty("ok", true);
            out.add("result", safeParse(body));
        } catch (Throwable e) {
            Throwable cause = e.getCause() != null ? e.getCause() : e;
            out.addProperty("ok", false);
            out.addProperty("error", cause.getClass().getSimpleName() + ": " + cause.getMessage());
        }
        out.addProperty("ms", System.currentTimeMillis() - start);
        return NanoHTTPD.newFixedLengthResponse(Response.Status.OK, "application/json; charset=utf-8", out.toString());
    }

    private String call(String action, Map<String, String> params) throws Exception {
        String key = params.get("key");
        switch (String.valueOf(action)) {
            case "home":
                return SiteApi.homeContent(VodConfig.get().getSite(key)).toString();
            case "category":
                HashMap<String, String> extend = new HashMap<>();
                String ext = params.get("ext");
                if (!TextUtils.isEmpty(ext)) {
                    JsonObject obj = JsonParser.parseString(ext).getAsJsonObject();
                    for (String k : obj.keySet()) extend.put(k, obj.get(k).getAsString());
                }
                return SiteApi.categoryContent(key, params.get("tid"), def(params.get("pg"), "1"), true, extend).toString();
            case "detail":
                return SiteApi.detailContent(key, params.get("id")).toString();
            case "play":
                return SiteApi.playerContent(key, params.get("flag"), params.get("id")).toString();
            case "search":
                Site site = VodConfig.get().getSite(key);
                return SearchTask.create(site, params.get("wd"), "true".equals(params.get("quick")), def(params.get("pg"), "1")).call().toString();
            default:
                throw new IllegalArgumentException("unknown do=" + action);
        }
    }

    /**
     * 先 playerContent，若需解析（parse=1 / jx=1）則以播放器相同邏輯執行 ParseJob（WebView 嗅探或解析介面）。
     */
    private String parse(Map<String, String> params, int timeout) throws Exception {
        String key = params.get("key");
        Result result = SiteApi.playerContent(key, params.get("flag"), params.get("id"));
        result.setKey(key);
        JsonObject out = new JsonObject();
        out.addProperty("needParse", result.needParse());
        out.addProperty("useParse", result.shouldUseParse());
        out.addProperty("raw", result.getRealUrl());
        if (!result.needParse()) {
            out.addProperty("url", result.getRealUrl());
            out.add("header", App.gson().toJsonTree(result.getHeader()));
            return out.toString();
        }
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String[]> ref = new AtomicReference<>();
        AtomicReference<Map<String, String>> hdr = new AtomicReference<>();
        AtomicReference<ParseJob> job = new AtomicReference<>();
        App.post(() -> job.set(ParseJob.create(new ParseCallback() {
            @Override
            public void onParseSuccess(Map<String, String> headers, String url, String from) {
                ref.set(new String[]{url, from});
                hdr.set(headers);
                latch.countDown();
            }

            @Override
            public void onParseError() {
                latch.countDown();
            }
        }).start(result, result.shouldUseParse())));
        boolean finished = latch.await(timeout, TimeUnit.SECONDS);
        App.post(() -> {
            if (job.get() != null) job.get().stop();
        });
        if (!finished) throw new Exception("parse timeout");
        if (ref.get() == null) throw new Exception("parse error");
        out.addProperty("url", ref.get()[0]);
        out.addProperty("from", ref.get()[1]);
        out.add("header", App.gson().toJsonTree(hdr.get() == null ? new HashMap<>() : hdr.get()));
        return out.toString();
    }

    private String load(String url, int timeout) throws Exception {
        if (TextUtils.isEmpty(url)) throw new IllegalArgumentException("url is empty");
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String> error = new AtomicReference<>();
        App.post(() -> VodConfig.load(Config.find(url, 0).save(), new Callback() {
            @Override
            public void success() {
                latch.countDown();
            }

            @Override
            public void error(String msg) {
                error.set(msg);
                latch.countDown();
            }
        }));
        if (!latch.await(Math.max(timeout, 60), TimeUnit.SECONDS)) throw new Exception("load timeout");
        if (error.get() != null) throw new Exception("load error: " + error.get());
        return sites();
    }

    private String sites() {
        JsonArray array = new JsonArray();
        for (Site site : VodConfig.get().getSites()) {
            JsonObject item = new JsonObject();
            item.addProperty("key", site.getKey());
            item.addProperty("name", site.getName());
            item.addProperty("type", site.getType());
            item.addProperty("api", site.getApi());
            array.add(item);
        }
        return array.toString();
    }

    private String run(Callable<String> callable, int timeout) throws Exception {
        Future<String> future = EXECUTOR.submit(callable);
        try {
            return future.get(timeout, TimeUnit.SECONDS);
        } finally {
            future.cancel(true);
        }
    }

    private static com.google.gson.JsonElement safeParse(String body) {
        try {
            return JsonParser.parseString(body);
        } catch (Exception e) {
            return new com.google.gson.JsonPrimitive(body);
        }
    }

    private static String def(String value, String def) {
        return TextUtils.isEmpty(value) ? def : value;
    }

    private static int parseInt(String value, int def) {
        try {
            return Integer.parseInt(value);
        } catch (Exception e) {
            return def;
        }
    }
}
