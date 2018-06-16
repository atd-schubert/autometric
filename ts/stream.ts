import perfNow from "performance-now";
import { Registry } from "prom-client";
import { PassThrough, TransformCallback } from "stream";
import {
    createCounter,
    createRegistry,
    createSummary,
    IAutometricCallOptions,
    IAutometricCreateOptions,
} from "./common";

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
    const register = createRegistry();
    const { registers = [] } = baseOptions;
    registers.push(register);

    const metrics = {
        chunkSizes: createSummary({
            help: `Autometric Summary for the chunk-size of the "${ name }" Stream`,
            name: name + "_chunk_sizes_bytes",
            registers,
        }),
        durations: createSummary({
            help: `Autometric Summary for the durations of the "${ name }" Stream`,
            name: name + "_durations_ms",
            registers,
        }),
        elapsedTime: createSummary({
            help: `Autometric Summary for the elapsed time between emitted chunks of the "${ name }" Stream`,
            name: name + "_elapsed_time_ms",
            registers,
        }),
        ends: createCounter({
            help: `Autometric Counter for ended Streams of "${ name }"`,
            name: name + "_ends_total",
            registers,
        }),
        nonEmits: createCounter({
            help: `Autometric Counter for Streams of "${ name }" without emitting data`,
            name: name + "_non_emits_total",
            registers,
        }),
        throughput: createSummary({
            help: `Autometric Summary for the throughput in bytes of the "${ name }" Stream`,
            name: name + "_throughput_bytes",
            registers,
        }),
    };

    return class AutometricStreamPassThrough extends PassThrough {
        public static readonly register: Registry = register;
        public static readonly prefix: string = name;
        public static readonly labels: {[name: string]: string} = baseOptions.labels || {};

        constructor(options: IAutometricStreamOptions = {}) {
            let firstTimestamp: number = perfNow(); // set already now a value to prevent bugs with non-emitting streams
            options.labels = options.labels || {};
            options.rewriteLabels = options.rewriteLabels || ((passLabels) => passLabels as any);
            let currentLabels: {[name: string]: string} = {...AutometricStreamPassThrough.labels, ...options.labels};
            let firstChunk = false;
            let throughput: number = 0;
            let previousTimestamp: number;

            const transform = (chunk: any, encoding: string, callback: TransformCallback) => {
                const startTimestamp = perfNow();

                currentLabels = options.rewriteLabels!(currentLabels, chunk, encoding, baseOptions, options);

                if (firstChunk) {
                    metrics.elapsedTime.observe(currentLabels, startTimestamp - previousTimestamp);
                } else {
                    firstChunk = true;
                    firstTimestamp = startTimestamp;
                }

                if (chunk instanceof Buffer || typeof chunk === "string") {
                    metrics.chunkSizes.observe(currentLabels, chunk.length);
                    throughput += chunk.length;
                } else {
                    metrics.chunkSizes.observe(currentLabels, 1);
                    throughput += 1;
                }

                previousTimestamp = perfNow();
                callback(undefined, chunk);
            };
            super({
                objectMode: true,
                transform,
            });

            this.on("end", () => {
                const endTimestamp = perfNow();
                const endDate = new Date();
                if (!firstChunk) {
                    metrics.nonEmits.inc(currentLabels, 1, endDate);
                }
                metrics.ends.inc(currentLabels, 1, endDate);
                metrics.durations.observe(currentLabels, endTimestamp - firstTimestamp);
                metrics.throughput.observe(currentLabels, throughput);
            });
        }
    };
}
