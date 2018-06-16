import { autometricRegister, createAutometricMiddleware, createAutometricStreamPipe } from "autometric";
import express from "express";
import { Registry } from "prom-client";
import { createGzip } from "zlib";
const server = express();

import request = require("request");

const register = Registry.merge([autometricRegister]);
const RadioMetricPipe = createAutometricStreamPipe(
    "radio_stream_pipe",
    {
        registers: [register],
    },
);
const CompressionMetricPipe = createAutometricStreamPipe(
    "compression_pipe",
    {
        registers: [register],
    },
);
const autometricRadioMiddlware = createAutometricMiddleware(
    "radio_stream_middleware",
    {
        registers: [register],
    },
);
const autometricCompressMiddlware = createAutometricMiddleware(
    "compression_route",
    {
        registers: [register],
    },
);

server.get("/metrics", (req, res) => {
    res.writeHead(200, register.contentType);
    res.end(register.metrics());
});

server.get(
    "/1live-hq",
    autometricRadioMiddlware.createMiddleware({ labels: { broadcaster: "1-live", quality: "hq" } }),
    (req, res) => {
        res.writeHead(200, {"content-type": "audio/mp3"});
        request("http://wdr-1live-live.icecast.wdr.de/wdr/1live/live/mp3/128/stream.mp3")
            .pipe(new RadioMetricPipe({labels: { broadcaster: "1-live", quality: "hq" }}))
            .pipe(res);
    },
);
server.get(
    "/1live-lq",
    autometricRadioMiddlware.createMiddleware({ labels: { broadcaster: "1-live", quality: "lq" } }),
    (req, res) => {
        res.writeHead(200, {"content-type": "audio/mp3"});
        request("http://wdr-1live-live.icecast.wdr.de/wdr/1live/live/mp3/56/stream.mp3")
            .pipe(new RadioMetricPipe({labels: { broadcaster: "1-live", quality: "lq" }}))
            .pipe(res);
    },
);

server.get(
    "/radio1-hq",
    autometricRadioMiddlware.createMiddleware({ labels: { broadcaster: "radio-1", quality: "hq" } }),
    (req, res) => {
        res.writeHead(200, {"content-type": "audio/mp3"});
        request("http://rbb-radioeins-live.cast.addradio.de/rbb/radioeins/live/mp3/128/stream.mp3")
            .pipe(new RadioMetricPipe({labels: { broadcaster: "radio-1", quality: "hq" }}))
            .pipe(res);
    },
);

server.post("/compress", autometricCompressMiddlware.createMiddleware(), (req, res) => {
    res.writeHead(200, {"content-type": "application/gzip"});
    req
        .pipe(new CompressionMetricPipe({ labels: { state: "uncompressed" } }))
        .pipe(createGzip())
        .pipe(new CompressionMetricPipe({ labels: { state: "compressed" } }))
        .pipe(res);
});

server.listen(9090);
