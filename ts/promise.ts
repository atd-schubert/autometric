import { Counter, Registry, Summary } from "prom-client";
import { IAutometricCallOptions, IAutometricCreateOptions } from "./common";

export interface ICreateAutometricPromiseOptions extends IAutometricCreateOptions {
    labels?: {[name: string]: string};
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
    const register: Registry = new Registry();
    const metrics = {
        calls: new Counter({
            help: `Autometric Counter for calls of the "${ name }" Promise`,
            name: name + "_calls",
            registers: [register],
        }),
        durations: new Summary({
            help: `Autometric Summary for the durations of the "${ name }" Promise`,
            name: name + "_durations",
            registers: [register],
        }),
        rejects: new Counter({
            help: `Autometric Counter for rejects of the "${ name }" Promise`,
            name: name + "_rejects",
            registers: [register],
        }),
        resolves: new Counter({
            help: `Autometric Counter for resolves of the "${ name }" Promise`,
            name: name + "_resolves",
            registers: [register],
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
            const startDate = new Date();
            options.labels = options.labels || {};
            options.rewriteLabels = options.rewriteLabels || ((passLabels) => passLabels as any);
            let currentLabels: {[name: string]: string} = {...AutometricPromise.labels, ...options.labels};
            metrics.calls.inc(currentLabels as any, 1, startDate);

            super((resolve, reject) => {
                const intResolve: (value?: T | PromiseLike<T>) => void = (result) => {
                    const endDate = new Date();
                    currentLabels = options.rewriteLabels!(currentLabels, result, baseOptions, options);
                    metrics.resolves.inc(currentLabels as any, 1, endDate);
                    metrics.durations.observe(currentLabels as any, endDate.getTime() - startDate.getTime());
                    resolve(result);
                };
                const intReject: (reason?: any) => void = (reason) => {
                    const endDate = new Date();
                    currentLabels = options.rewriteLabels!(currentLabels, reason, baseOptions, options);
                    metrics.rejects.inc(currentLabels as any, 1, endDate);
                    metrics.durations.observe(currentLabels as any, endDate.getTime() - startDate.getTime());
                    reject(reason);
                };
                executor(intResolve, intReject);
            });
        }
    } as any;

}
