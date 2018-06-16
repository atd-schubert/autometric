import { expect } from "chai";
import { Counter, Summary } from "prom-client";
import { createAutometricPromise, IAutometricPromiseLikeConstructor } from "./";
import {autometricRegister} from "./index";

describe("AutometricPromise", () => {
    describe("creation of the Promise class", () => {
        it("should return an instance of a Promise", () => {
            expect(
                new (createAutometricPromise("instance_of_promise"))<boolean>((resolve) => resolve(true)),
            ).instanceOf(Promise);
        });

        describe("static properties", () => {
            let AutometricPromise: IAutometricPromiseLikeConstructor;
            const name = "static_properties";
            const labels: {[name: string]: string} = {label: "just-a-test"};
            class ExtendedPromsise<T> extends Promise<T> {
                public extendedPromise = true;
            }
            before(() => {
                autometricRegister.getSingleMetric("autometric_counters_total").reset();
                autometricRegister.getSingleMetric("autometric_registers_total").reset();
                autometricRegister.getSingleMetric("autometric_summaries_total").reset();
            });
            before(() => {
                AutometricPromise = createAutometricPromise(name, {
                    labels,
                    promise: ExtendedPromsise as any,
                });
            });
            it("should be an instance of the extended Promise", () => {
                expect(
                    new AutometricPromise<boolean>((resolve) => resolve(true)),
                ).instanceOf(Promise);
            });
            it("should have the name as prefix attribute", () => {
                expect(AutometricPromise.prefix).to.equal(name);
            });
            it("should have the labels as labels attribute", () => {
                expect(AutometricPromise.labels).to.deep.equal(labels);
            });
            it("should have the calls counter in the register", () => {
                expect(AutometricPromise.register.getSingleMetric(name + "_calls_total")).instanceOf(Counter);
            });
            it("should have the durations summary in the register", () => {
                expect(AutometricPromise.register.getSingleMetric(name + "_durations_ms")).instanceOf(Summary);
            });

            it("should count the creation of a counters", () => void expect(
                (autometricRegister.getSingleMetric("autometric_counters_total") as any).get().values[0].value,
            ).equal(1));
            it("should count the creation of a register", () => void expect(
                (autometricRegister.getSingleMetric("autometric_registers_total") as any).get().values[0].value,
            ).equal(1));
            it("should count the creation of a summaries", () => void expect(
                (autometricRegister.getSingleMetric("autometric_summaries_total") as any).get().values[0].value,
            ).equal(1));

            it("should have a static all function", async () => {
                const result = await AutometricPromise.all(
                    [Promise.resolve(true), AutometricPromise.resolve(true)],
                );
                expect(result).deep.equal([true, true]);
            });
            it("should have a static race function", async () => {
                const result = await AutometricPromise.race(
                    [
                        Promise.resolve(true),
                        new Promise((resolve) => { setTimeout(() => { resolve(false); }, 100); }),
                    ],
                );
                expect(result).deep.equal(true);
            });
            it("should have a static resolve function", async () => {
                const result = await AutometricPromise.resolve(true);
                expect(result).deep.equal(true);
            });
            it("should have a static reject function", () => {
                return AutometricPromise
                    .reject(new Error("test"))
                    .then(() => {
                        /* istanbul ignore next */
                        return Promise.reject(new Error("Error not caught"));
                    })
                    .catch((err: Error) => {
                        expect(err.message).equal("test");
                    });
            });
        });
    });
    describe("counters", () => {
        let AutometricPromise: IAutometricPromiseLikeConstructor;
        const name = "counters";
        before(() => {
            AutometricPromise = createAutometricPromise(name);
        });
        it("should count a call", () => {
            /* tslint:disable:no-unused-expression */
            new AutometricPromise(() => {
                // do nothing here...
            });
            expect(
                (AutometricPromise.register.getSingleMetric(name + "_calls_total") as any).get().values[0].value,
            ).equal(1);
        });
        it("should count rejects", (done: MochaDone) => {
            new AutometricPromise((resolve, reject) => {
                reject(new Error("Expected behavior"));
            }).catch(() => {
                expect(
                    (AutometricPromise.register.getSingleMetric(name + "_durations_ms") as any)
                        .get().values
                        .reduce((prev: null | number, elem: any) => {
                            if (elem.metricName === name + "_durations_ms_count") {
                                return elem.value;
                            }
                            return prev;
                        }, null),
                ).equal(1);
                expect(
                    (AutometricPromise.register.getSingleMetric(name + "_durations_ms") as any)
                        .get().values
                        .reduce((prev: null | number, elem: any) => {
                            if (elem.metricName === name + "_durations_ms_count") {
                                return elem.labels;
                            }
                            return prev;
                        }, null),
                ).deep.equal({status: "reject"});
                done();
            });
        });
        it("should count resolves", (done: MochaDone) => {
            AutometricPromise.register.getSingleMetric(name + "_durations_ms").reset();
            (new AutometricPromise((resolve) => {
                resolve(true);
            })).then(() => {
                expect(
                    (AutometricPromise.register.getSingleMetric(name + "_durations_ms") as any)
                        .get().values
                        .reduce((prev: null | number, elem: any) => {
                            if (elem.metricName === name + "_durations_ms_count") {
                                return elem.value;
                            }
                            return prev;
                        }, null),
                ).equal(1);
                expect(
                    (AutometricPromise.register.getSingleMetric(name + "_durations_ms") as any)
                        .get().values
                        .reduce((prev: null | number, elem: any) => {
                            if (elem.metricName === name + "_durations_ms_count") {
                                return elem.labels;
                            }
                            return prev;
                        }, null),
                ).deep.equal({status: "resolve"});
                done();
            });
        });
    });
    describe("summary", () => {
        let AutometricPromise: IAutometricPromiseLikeConstructor;
        const name = "summaries";
        before(() => {
            AutometricPromise = createAutometricPromise(name);
        });

        it("should measure execution duration", () => {
            return new AutometricPromise((resolve) => {
                setTimeout(() => {
                    resolve(true);
                }, 100);
            }).then(() => {
                const values: any[] = (AutometricPromise.register.getSingleMetric(name + "_durations_ms") as any)
                    .get().values;
                expect(
                    values[values.length - 2].value,
                ).greaterThan(99).lessThan(110);
            });
        });
    });
});
