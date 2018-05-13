import { Counter, Registry, Summary } from "prom-client";
import {PassThrough, TransformCallback} from "stream";
import { IAutometricCallOptions, IAutometricCreateOptions } from "./common";

export interface IAutometricStreamOptions extends IAutometricCallOptions {
    /**
     * A callback function to convert the labels after getting the result
     *
     * *Note: The result is the value from a resolved promise and also the error of a rejected!*
     */
    rewriteLabels?: (
        currentLabels: {[name: string]: string},
        chunk: any,
        encoding: any,
        createOptions: IAutometricCreateOptions,
        callOptions: IAutometricStreamOptions,
    ) => {[name: string]: string};
}

export interface IAutometricStreamPipeConstructor {
    readonly register: Registry;
    readonly prefix: string;
    readonly labels: {[name: string]: string};
    new(options?: IAutometricStreamOptions): PassThrough;
}

export function createAutometricStreamPipe(
    name: string, baseOptions: IAutometricCreateOptions = {},
): IAutometricStreamPipeConstructor {
    const register: Registry = new Registry();
    const metrics = {
        chunkSizes: new Summary({
            help: `Autometric Summary for the chunk-size of the "${ name }" Stream`,
            name: name + "_chunk_sizes",
            registers: [register],
        }),
        durations: new Summary({
            help: `Autometric Summary for the durations of the "${ name }" Promise`,
            name: name + "_durations",
            registers: [register],
        }),
        emits: new Counter({
            help: `Autometric Counter for emitted Streams of "${ name }"`,
            name: name + "_emits",
            registers: [register],
        }),
        ends: new Counter({
            help: `Autometric Counter for ended Streams of "${ name }"`,
            name: name + "_ends",
            registers: [register],
        }),
        incomingChunks: new Counter({
            help: `Autometric Counter for incoming chunks of "${ name }"`,
            name: name + "_incoming_chunks",
            registers: [register],
        }),
        nonEmits: new Counter({
            help: `Autometric Counter for Streams of "${ name }" without emitting data`,
            name: name + "_non_emits",
            registers: [register],
        }),
        numChunks: new Summary({
            help: `Autometric Summary for the number of chunks of the "${ name }" Promise`,
            name: name + "_num_chunks",
            registers: [register],
        }),
        throughput: new Summary({
            help: `Autometric Summary for the throughput in bytes of the "${ name }" Promise`,
            name: name + "_throughput",
            registers: [register],
        }),
    };

    return class AutometricStreamPassThrough extends PassThrough {
        public static readonly register: Registry = register;
        public static readonly prefix: string = name;
        public static readonly labels: {[name: string]: string} = baseOptions.labels || {};

        constructor(options: IAutometricStreamOptions = {}) {
            options.labels = options.labels || {};
            options.rewriteLabels = options.rewriteLabels || ((passLabels) => passLabels as any);
            let currentLabels: {[name: string]: string} = {...AutometricStreamPassThrough.labels, ...options.labels};
            let firstChunk = false;
            let throughput: number = 0;
            let chunks: number = 0;
            let startDate: Date = new Date(); // set already now a value to prevent bugs with non-emitting streams

            const transform = (chunk: any, encoding: string, callback: TransformCallback) => {
                chunks += 1;
                currentLabels = options.rewriteLabels!(currentLabels, chunk, encoding, baseOptions, options);
                metrics.incomingChunks.inc(currentLabels, 1, new Date());
                if (!firstChunk) {
                    firstChunk = true;
                    startDate = new Date();
                    metrics.emits.inc(currentLabels as any, 1, startDate);
                }
                if (chunk instanceof Buffer || typeof chunk === "string") {
                    metrics.chunkSizes.observe(currentLabels as any, chunk.length);
                    throughput += chunk.length;
                }
                callback(undefined, chunk);
            };
            super({
                transform,
            });

            this.on("end", () => {
                const endDate = new Date();
                if (!firstChunk) {
                    metrics.nonEmits.inc(currentLabels as any, 1, endDate);
                }
                metrics.ends.inc(currentLabels as any, 1, endDate);
                metrics.durations.observe(currentLabels as any, endDate.getTime() - startDate.getTime());
                metrics.throughput.observe(currentLabels as any, throughput);
                metrics.numChunks.observe(currentLabels as any, chunks);
            });
        }
    };
}
