import { createAutometricStreamPipe } from "autometric";
import { createServer } from "http";
// import { register } from "prom-client";

import request = require("request");

const MetricPipe = createAutometricStreamPipe("radio_stream", {labels: {broadcaster: "1-live"}});
const register = MetricPipe.register;

const server = createServer((req, res) => {
    res.writeHead(200, register.contentType);
    res.end(register.metrics());
    /* tslint:disable:no-console */
    console.log(new Date(), "send metrics...");
});
server.listen(9090);

const hqMetricPipe = new MetricPipe({labels: {quality: "hq", kbps: "128"}});
const hqStream = request("http://wdr-1live-live.icecast.wdr.de/wdr/1live/live/mp3/128/stream.mp3");

const lqMetricPipe = new MetricPipe({labels: {quality: "lq", kbps: "56"}});
const lqStream = request("http://wdr-1live-live.icecast.wdr.de/wdr/1live/live/mp3/56/stream.mp3");

hqStream.pipe(hqMetricPipe).on("data", () => {
  // do nothing, just consume...
});
lqStream.pipe(lqMetricPipe).on("data", () => {
    // do nothing, just consume...
});
