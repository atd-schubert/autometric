import perfNow from "performance-now";
import { Registry } from "prom-client";
import {
    createCounter,
    createRegistry,
    createSummary,
    IAutometricCallOptions,
    IAutometricCreateOptions,
} from "./common";

export interface ICreateAutometricPromiseOptions extends IAutometricCreateOptions {
    promise?: PromiseConstructorLike;
}

export interface IAutometricPromiseOptions extends IAutometricCallOptions {
    /**
     * A callback function to convert the labels after getting the result
     *
     * *Note: The result is the value from a resolved promise and also the error of a rejected!*
     */
    rewriteLabels?: (
        currentLabels: {[name: string]: string},
        result: any,
        createOptions: ICreateAutometricPromiseOptions,
        callOptions: IAutometricPromiseOptions,
    ) => {[name: string]: string};
    noStatusLabel?: boolean;
}

export interface IAutometricPromiseLike<T> extends PromiseLike<T> {}
export interface IAutometricPromiseLikeConstructor extends PromiseConstructor {
    readonly register: Registry;
    readonly prefix: string;
    readonly labels: {[name: string]: string};
    new<T>(): IAutometricPromiseLike<T>;
}

export function createAutometricPromise(
    name: string,
    baseOptions: ICreateAutometricPromiseOptions = {},
): IAutometricPromiseLikeConstructor {
    const register = createRegistry();
    const { registers = [] } = baseOptions;
    registers.push(register);

    const metrics = {
        calls: createCounter({
            help: `Autometric Counter for calls of the "${ name }" Promise`,
            name: name + "_calls_total",
            registers,
        }),
        durations: createSummary({
            help: `Autometric Summary for the durations of the "${ name }" Promise`,
            name: name + "_durations_ms",
            registers,
        }),
    };

    baseOptions.promise = baseOptions.promise || Promise;

    return class AutometricPromise<T> extends baseOptions.promise<T> implements IAutometricPromiseLike<T> {
        public static readonly register: Registry = register;
        public static readonly prefix: string = name;
        public static readonly labels: {[name: string]: string} = baseOptions.labels || {};
        public static all = Promise.all;
        public static race = Promise.race;
        public static reject = Promise.reject;
        public static resolve = Promise.resolve;

        constructor(
            executor: (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void,
            options: IAutometricPromiseOptions = {},
        ) {
            const startTimestamp = perfNow();
            const startDate = new Date();
            options.labels = options.labels || {};
            options.rewriteLabels = options.rewriteLabels || ((passLabels) => passLabels as any);
            let currentLabels: {[name: string]: string} = {...AutometricPromise.labels, ...options.labels};
            metrics.calls.inc(currentLabels, 1, startDate);

            super((resolve, reject) => {
                const intResolve: (value?: T | PromiseLike<T>) => void = (result) => {
                    const endTimestamp = perfNow();
                    if (!options.noStatusLabel) {
                        currentLabels = { ...currentLabels, status: "resolve" };
                    }
                    currentLabels = options.rewriteLabels!(currentLabels, result, baseOptions, options);
                    metrics.durations.observe(currentLabels, endTimestamp - startTimestamp);
                    resolve(result);
                };
                const intReject: (reason?: any) => void = (reason) => {
                    const endTimestamp = perfNow();
                    if (!options.noStatusLabel) {
                        currentLabels = { ...currentLabels, status: "reject" };
                    }
                    currentLabels = options.rewriteLabels!(currentLabels, reason, baseOptions, options);
                    metrics.durations.observe(currentLabels, endTimestamp - startTimestamp);
                    reject(reason);
                };
                executor(intResolve, intReject);
            });
        }
    } as any;

}
