# autometric

[![Build Status](https://travis-ci.org/atd-schubert/autometric.svg?branch=develop)](https://travis-ci.org/atd-schubert/autometric)
[![Coverage Status](https://coveralls.io/repos/github/atd-schubert/autometric/badge.svg?branch=develop)](https://coveralls.io/github/atd-schubert/autometric?branch=develop)

The aim of this module is to collect metrics automatically with the
[`prom-client`](https://www.npmjs.com/package/prom-client) on different asynchronous execution pattern. It is written in
TypeScript and includes its type definitions, of course. It uses `prom-client` as peer dependency, so don't forget to
add it to your module!

*This module is in development. Currently supported are Promises, connect-like middlewares and a pass-through stream.
The goal is to enhance the module with support for child-processes and observables patterns in future releases.*

## How to use

First you have to install this library from npm:

```bash
npm install --save autometric
# OR
yarn add autometric
```

### Promises
TypeScript:
```typescript
import { createAutometricPromise, IAutometricPromiseOptions, ICreateAutometricPromiseOptions } from "autometric";

const AutometricPromise = createAutometricPromise("my_metric_promise", {labels: {labels: "are-optional"}});
// function to change the labels after getting the result
const rewriteLabels = (
    currentLabels: {[name: string]: string},
    result: boolean | Error, // according to the generic type of the Promise or the Error from the reject
    createOptions: ICreateAutometricPromiseOptions,
    callOptions: IAutometricPromiseOptions,
) => {
    if (result === true) {
        return { ...currentLabels, status: "success" };
    }
    if (result instanceof Error && result.message === "Value is smaller the 1%") {
        return { ...currentLabels, status: "error" };
    }
    return currentLabels;
};
// options are optional
const options = { labels: { additional: "add-additional-labels", labels: "or-overwrite-them" }, rewriteLabels };

new AutometricPromise<boolean>((resolve, reject) => {
    setTimeout(() => {
        const random = Math.random() > 0.5;
        if (random < 0.01) {
            return reject(new Error("Value is smaller the 1%"));
        }
        resolve(Math.random() > 0.5);
    }, 100);
}, options);
```

JavaScript:

```js
import { createAutometricPromise } from "autometric";

const AutometricPromise = createAutometricPromise("my_metric_promise", {labels: {labels: "are-optional"}});
// function to change the labels after getting the result
const rewriteLabels = (currentLabels, result, createOptions, callOptions) => {
    if (result === true) {
        return { ...currentLabels, status: "success" };
    }
    if (result instanceof Error && result.message === "Value is smaller the 1%") {
        return { ...currentLabels, status: "error" };
    }
    return currentLabels;
};
// options are optional
const options = { labels: { additional: "add-additional-labels", labels: "or-overwrite-them" }, rewriteLabels };

new AutometricPromise<boolean>((resolve, reject) => {
    setTimeout(() => {
        const random = Math.random() > 0.5;
        if (random < 0.01) {
            return reject(new Error("Value is smaller the 1%"));
        }
        resolve(Math.random() > 0.5);
    }, 100);
}, options);
```

The promise of autometric will collect the following metrics:

* `name + "_calls_total"` as Counter: counts Promises that start its execution.
* `name + "_durations_ms"` as Summary: summary over the duration from execution start until it resolves or rejects.
It will add a status (success / fail) to the metric as long as not disabled via the `noStatusLabel` option.

### With the pass-through stream

TypeScript:

```typescript
import { createAutometricStreamPipe, IAutometricCreateOptions, IAutometricStreamOptions } from "autometric";
import { createReadStream, createWriteStream } from "fs";

const AutometricPipe = createAutometricStreamPipe("my_metric_stream", {labels: {labels: "are-optional"}});
// function to change the labels after getting a chunk
const rewriteLabels = (
    currentLabels: {[name: string]: string},
    chunk: Buffer,
    encoding: string,
    createOptions: IAutometricCreateOptions,
    callOptions: IAutometricStreamOptions,
) => {
    return {...currentLabels, encoding};
};
// options are optional
const options = { labels: { additional: "add-additional-labels", labels: "or-overwrite-them" }, rewriteLabels };

const metricsPipe = new AutometricPipe(options);

const reader = createReadStream("path/to/read");
const writer = createWriteStream("path/to/write");

reader.pipe(metricsPipe).pipe(writer);
```

JavaScript:

```js
import { createAutometricStreamPipe } from "autometric";
import { createReadStream, createWriteStream } from "fs";

const AutometricPipe = createAutometricStreamPipe("my_metric_stream", {labels: {labels: "are-optional"}});
// function to change the labels after getting a chunk
const rewriteLabels = (currentLabels, chunk, encoding, createOptions, callOptions) => {
    return {...currentLabels, encoding};
};
// options are optional
const options = { labels: { additional: "add-additional-labels", labels: "or-overwrite-them" }, rewriteLabels };

const metricsPipe = new AutometricPipe(options);

const reader = createReadStream("path/to/read");
const writer = createWriteStream("path/to/write");

reader.pipe(metricsPipe).pipe(writer);
```

The pass-through pipe of autometric will collect the following metrics:

* `name + "_chunk_sizes_bytes"` as Summary: summary over the size in bytes of a chunk (only for strings or Buffers)
* `name + "_durations_ms"` as Summary: summary over the duration from the first chunk until the end event.
* `name + "_elapsed_time_ms"` as Summary: Time between emits of chunks
* `name + "_ends_total"` as Counter: counts streams that ends
* `name + "_non_emits_total"` as Counter: counts streams that ends without emitting any data
* `name + "_throughput_bytes"` as Summary: a summary over the processed bytes in one stream

### Connect-like middlware

*This middleware is build for express, but it should also work with other connect-like middlewares*

TypeScript:

```typescript
import { createAutometricMiddleware } from "autometric";
import * as express from "express";
const app = express();


const middlewareObject = createAutometricMiddleware("my_metric_middleware", {labels: {labels: "are-optional"}});
// function to change the labels after getting a chunk
const rewriteLabels = (currentLabels, chunk, encoding, createOptions, callOptions) => {
    return {...currentLabels, encoding};
};
// options are optional
const options = {
    labels: {
        additional: "add-additional-labels",
        labels: "or-overwrite-them",
        service: "user-auth",
    },
    rewriteLabels,
};

app.get("/api/user", middlewareObject.createMiddleware(options), (req, res) => {
    // ...
});

```

JavaScript:

```js
const { createAutometricMiddleware } = require("autometric");
const express = require("express");
const app = express();


const middlewareObject = createAutometricMiddleware("my_metric_middleware", {labels: {labels: "are-optional"}});
// function to change the labels after getting a chunk
const rewriteLabels = (currentLabels, chunk, encoding, createOptions, callOptions) => {
    return {...currentLabels, encoding};
};
// options are optional
const options = {
    labels: {
        additional: "add-additional-labels",
        labels: "or-overwrite-them",
        service: "user-auth",
    },
    rewriteLabels,
};

app.get("/api/user", middlewareObject.createMiddleware(options), (req, res) => {
    // ...
});

```

### Get the metrics

This module uses the `prom-client` as peer dependency. To get all metrics - including foreign ones - you can use the
`prom-client` register like that:

```typescript
import { createServer } from "http";
import { register } from "prom-client";

createServer((req, res) => {
    res.writeHead(200, register.contentType);
    res.end(register.metrics());
}).listen(9000);
```

You can also take the static property `register` of the resulting classes to output only the specific metrics, or merge
them with other registers:

```js
AutometricPromise.register.metrics();
// OR
AutometricStreamPassThrough.register.metrics();
// OR
middlewareObject.register.metrics();
```

### Meta metrics from autometric

Autometric also collects metrics from the creation of Autometric metrics collectors. You can access them like this:

```typescript
import { autometricRegister } from "autometric";
autometricRegister.metrics();
```

## Scripts Tasks

Scripts registered in package.json:

* `transpile`: Transpile TypeScript Code to JavaScript
* `dist`: Make a ready for distribution version
* `lint`: Use the linter for TypeScript Code
* `test`: Run software- and coverage-tests in node.
* `doc`: Build the API documentation.

*Every command is also available as dockerized version, by prefixing `docker:` (ex.: `docker:lint`)*

## License

This library is released under the [ISC License](LICENSE).

## Links

* [GitHub](https://github.com/atd-schubert/autometric)
* [NPM](https://www.npmjs.com/package/autometric)
