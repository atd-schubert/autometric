import { NextFunction } from "express";
import { IncomingMessage, ServerResponse } from "http";
import perfNow from "performance-now";
import { Registry } from "prom-client";
import {createCounter, createRegistry, createSummary, IAutometricCallOptions, IAutometricCreateOptions} from "./common";

export interface ICreateAutometricMiddlewareOptions extends IAutometricCreateOptions {
    rewriteLabels?: (
        currentLabels: {[name: string]: string},
        createOptions: ICreateAutometricMiddlewareOptions,
        callOptions: {
            request: IncomingMessage,
            response: ServerResponse,
        },
    ) => {[name: string]: string};
    addMethodLabel?: boolean;
    addStatusCodeLabel?: boolean;
    addClosedByLabel?: boolean;
}

export interface IAutometricMiddlewareObject {
    readonly register: Registry;
    readonly prefix: string;
    readonly labels: {[name: string]: string};
    readonly createMiddleware: (baseOptions?: IAutometricCallOptions) =>
        (request: IncomingMessage, response: ServerResponse, next: NextFunction) => void;
}

export function createAutometricMiddleware(
    name: string,
    baseOptions: ICreateAutometricMiddlewareOptions = {},
): IAutometricMiddlewareObject {
    const register: Registry = createRegistry();
    const { labels = {}, registers = [] } = baseOptions;
    registers.push(register);

    baseOptions.rewriteLabels = baseOptions.rewriteLabels || ((passLabels) => passLabels as any);
    const metrics = {
        calls: createCounter({
            help: `Autometric Counter for requests on the "${ name }" Route`,
            name: name + "_calls_total",
            registers,
        }),
        durations: createSummary({
            help: `Autometric Summary for the durations on the "${ name }" Route`,
            name: name + "_durations_ms",
            registers,
        }),
        fails: createCounter({
            help: `Autometric Counter for unsuccessfully respond requests of the "${ name }" Route`,
            name: name + "_fails_total",
            registers,
        }),
        incomingThroughput: createSummary({
            help: `Autometric Summary for the incoming throughput in bytes of the "${ name }" Route`,
            name: name + "_incoming_bytes",
            registers,
        }),
        outgoingThroughput: createSummary({
            help: `Autometric Summary for the outgoing throughput in bytes of the "${ name }" Route`,
            name: name + "_outgoing_bytes",
            registers,
        }),
        successes: createCounter({
            help: `Autometric Counter for successfully respond requests of the "${ name }" Route`,
            name: name + "_successes_total",
            registers,
        }),
    };

    return {
        createMiddleware(options: IAutometricCallOptions = {}) {
            return (request: IncomingMessage, response: ServerResponse, next: NextFunction): void => {
                const startTimestamp: number = perfNow();
                const startDate = new Date();
                let closed: boolean = false;
                let currentLabels: {[name: string]: string} = {...labels, ...options.labels};
                if ((request as any /* Express response */ ).method && baseOptions.addMethodLabel) {
                    currentLabels.method = (request as any).method;
                }
                metrics.calls.inc(currentLabels, 1, startDate);

                function closeConnection() {
                    const stopTimestamp = perfNow();
                    const endDate = new Date();
                    if (closed) {
                        return;
                    }
                    // Safty goes first and first come - first service. Sometimes close get called multiple times,
                    // or finish and time.
                    closed = true;
                    if (baseOptions.addStatusCodeLabel) {
                        currentLabels.statusCode = response.statusCode.toString();
                    }
                    currentLabels = baseOptions.rewriteLabels!(currentLabels, baseOptions, {request, response});

                    metrics.durations.observe(currentLabels, stopTimestamp - startTimestamp);
                    if (response.statusCode >= 400) {
                        metrics.fails.inc(currentLabels, 1, endDate);
                    } else {
                        metrics.successes.inc(currentLabels, 1, endDate);
                    }

                    metrics.incomingThroughput.observe(currentLabels, request.socket.bytesRead);
                    metrics.outgoingThroughput.observe(currentLabels, request.socket.bytesWritten);
                }

                response.on("finish", () => {
                    if (baseOptions.addClosedByLabel) {
                        currentLabels.closedBy = "server";
                    }
                    closeConnection();
                });
                response.on("close", () => {
                    if (baseOptions.addClosedByLabel) {
                        currentLabels.closedBy = "client";
                    }
                    closeConnection();
                });
                next();
            };
        },
        labels,
        prefix: name,
        register,
    };
}
