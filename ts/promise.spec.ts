import { expect } from "chai";
import { Counter, Summary } from "prom-client";
import { createAutometricPromise, IAutometricPromiseLikeConstructor } from "./";

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
                expect(AutometricPromise.register.getSingleMetric(name + "_calls")).instanceOf(Counter);
            });
            it("should have the durations summary in the register", () => {
                expect(AutometricPromise.register.getSingleMetric(name + "_durations")).instanceOf(Summary);
            });
            it("should have the resolves counter in the register", () => {
                expect(AutometricPromise.register.getSingleMetric(name + "_resolves")).instanceOf(Counter);
            });
            it("should have the rejects counter in the register", () => {
                expect(AutometricPromise.register.getSingleMetric(name + "_rejects")).instanceOf(Counter);
            });
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
            expect((AutometricPromise.register.getSingleMetric(name + "_calls") as any).get().values[0].value).equal(1);
        });
        it("should count rejects", () => {
            new AutometricPromise((resolve, reject) => {
                reject(new Error("Expected behavior"));
            }).catch(() => {
                // everything OK...
            });
            expect(
                (AutometricPromise.register.getSingleMetric(name + "_rejects") as any).get().values[0].value,
            ).equal(1);
        });
        it("should count resolves", () => {
            AutometricPromise.register.getSingleMetric(name + "_resolves").reset();
            new AutometricPromise((resolve) => {
                resolve(true);
            });
            expect(
                (AutometricPromise.register.getSingleMetric(name + "_resolves") as any).get().values[0].value,
            ).equal(1);
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
                const values: any[] = (AutometricPromise.register.getSingleMetric(name + "_durations") as any)
                    .get().values;
                expect(
                    values[values.length - 2].value,
                ).greaterThan(99).lessThan(110);
            });
        });
    });
});
