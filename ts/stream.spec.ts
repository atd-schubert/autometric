import { expect } from "chai";
import { Counter, Summary } from "prom-client";
import { PassThrough } from "stream";
import { createAutometricStreamPipe, IAutometricStreamPipeConstructor} from "./";
import {autometricRegister} from "./index";

class Pipe extends PassThrough {
    constructor({objectMode = false}: {objectMode?: boolean} = {}) {
        super({objectMode, transform: (chunk, encoding, next) => { next(undefined, chunk); }});
    }
}

describe("AutometricStream", () => {
    describe("creation of the Pass-Through class", () => {
        it("should return an instance of a Promise", () => {
            expect(
                new (createAutometricStreamPipe("instance_of_pass_through"))(),
            ).instanceOf(PassThrough);
        });

        describe("static properties", () => {
            let AutometricStreamPipe: IAutometricStreamPipeConstructor;
            const name = "static_properties";
            const labels: {[name: string]: string} = {label: "just-a-test"};
            before(() => {
                autometricRegister.getSingleMetric("autometric_counters_total").reset();
                autometricRegister.getSingleMetric("autometric_registers_total").reset();
                autometricRegister.getSingleMetric("autometric_summaries_total").reset();
            });
            before(() => {
                AutometricStreamPipe = createAutometricStreamPipe(name, {
                    labels,
                });
            });

            it("should have the prefix as prefix attribute", () => {
                expect(AutometricStreamPipe.prefix).to.equal(name);
            });
            it("should have the labels as labels attribute", () => {
                expect(AutometricStreamPipe.labels).to.deep.equal(labels);
            });

            it("should have the chunk-sizes summary in the register", () => {
                expect(AutometricStreamPipe.register.getSingleMetric(name + "_chunk_sizes_bytes")).instanceOf(Summary);
            });
            it("should have the durations summary in the register", () => {
                expect(AutometricStreamPipe.register.getSingleMetric(name + "_durations_ms")).instanceOf(Summary);
            });
            it("should have the throughput summary in the register", () => {
                expect(AutometricStreamPipe.register.getSingleMetric(name + "_elapsed_time_ms")).instanceOf(Summary);
            });
            it("should have the ends counter in the register", () => {
                expect(AutometricStreamPipe.register.getSingleMetric(name + "_ends_total")).instanceOf(Counter);

            });
            it("should have the non-emits counter in the register", () => {
                expect(AutometricStreamPipe.register.getSingleMetric(name + "_non_emits_total")).instanceOf(Counter);
            });
            it("should have the throughput summary in the register", () => {
                expect(AutometricStreamPipe.register.getSingleMetric(name + "_throughput_bytes")).instanceOf(Summary);
            });

            it("should count the creation of a counters", () => void expect(
                (autometricRegister.getSingleMetric("autometric_counters_total") as any).get().values[0].value,
            ).equal(2));
            it("should count the creation of a register", () => void expect(
                (autometricRegister.getSingleMetric("autometric_registers_total") as any).get().values[0].value,
            ).equal(1));
            it("should count the creation of a summaries", () => void expect(
                (autometricRegister.getSingleMetric("autometric_summaries_total") as any).get().values[0].value,
            ).equal(4));
        });
    });
    describe("work as a PassThrough stream", () => {
        let AutometricStreamPipe: IAutometricStreamPipeConstructor;
        const name = "as_stream";
        before(() => {
            AutometricStreamPipe = createAutometricStreamPipe(name);
        });
        it("should pass data", (done: MochaDone) => {
            const inPipe = new Pipe();
            const outPipe = new Pipe();
            const autometricStream = new AutometricStreamPipe();
            inPipe.pipe(autometricStream).pipe(outPipe);

            outPipe.once("data", (data: Buffer) => {
                expect(data.toString()).equal("Just a test");
                done();
            });
            inPipe.write("Just a test");
        });
        it("should pass data in object mode", (done: MochaDone) => {
            const inPipe = new Pipe({ objectMode: true });
            const outPipe = new Pipe({ objectMode: true });
            const autometricStream = new AutometricStreamPipe();
            inPipe.pipe(autometricStream).pipe(outPipe);

            outPipe.once("data", (data: Buffer) => {
                expect(data).deep.equal({ message: "Just a test"});
                done();
            });
            inPipe.write({ message: "Just a test"} );
        });
    });
    describe("counters", () => {
        let AutometricStreamPipe: IAutometricStreamPipeConstructor;
        const name = "counters";
        before(() => {
            AutometricStreamPipe = createAutometricStreamPipe(name);
        });

        it("should count an emitted chunk", () => {
            AutometricStreamPipe.register.getSingleMetric(name + "_chunk_sizes_bytes").reset();
            const inPipe = new Pipe();
            const outPipe = new Pipe();
            const autometricStream = new AutometricStreamPipe();
            inPipe.pipe(autometricStream).pipe(outPipe);

            outPipe.on("data", () => {
                // do nothing, just consume...
            });
            inPipe.write("Just a test");

            expect((AutometricStreamPipe.register.getSingleMetric(name + "_chunk_sizes_bytes") as any)
                .get().values.reduce((prev: null | number, elem: any) => {
                    /* istanbul ignore if */
                    if (prev) {
                        return prev;
                    }
                    if (elem.metricName === name + "_chunk_sizes_bytes_count") {
                        return elem.value;
                    }
                }, null)).equal(1);
        });

        it("should summarize the chunk sizes", () => {
            AutometricStreamPipe.register.getSingleMetric(name + "_chunk_sizes_bytes").reset();
            const inPipe = new Pipe();
            const outPipe = new Pipe();
            const autometricStream = new AutometricStreamPipe();
            const testStr: string = "Just a test";
            inPipe.pipe(autometricStream).pipe(outPipe);

            outPipe.on("data", () => {
                // do nothing, just consume...
            });
            inPipe.write(testStr);

            expect((AutometricStreamPipe.register.getSingleMetric(name + "_chunk_sizes_bytes") as any)
                .get().values.reduce((prev: null | number, elem: any) => {
                    if (prev) {
                        return prev;
                    }
                    if (elem.metricName === name + "_chunk_sizes_bytes_sum") {
                        return elem.value;
                    }
                }, null)).equal(testStr.length);
        });
        it("should summarize the chunk sizes of strings in object mode", () => {
            AutometricStreamPipe.register.getSingleMetric(name + "_chunk_sizes_bytes").reset();
            const inPipe = new Pipe({ objectMode: true });
            const outPipe = new Pipe({ objectMode: true });
            const autometricStream = new AutometricStreamPipe();
            const testStr: string = "Just a test";
            inPipe.pipe(autometricStream).pipe(outPipe);

            outPipe.on("data", () => {
                // do nothing, just consume...
            });
            inPipe.write(testStr);

            expect((AutometricStreamPipe.register.getSingleMetric(name + "_chunk_sizes_bytes") as any)
                .get().values.reduce((prev: null | number, elem: any) => {
                    if (prev) {
                        return prev;
                    }
                    if (elem.metricName === name + "_chunk_sizes_bytes_sum") {
                        return elem.value;
                    }
                }, null)).equal(testStr.length);
        });
        it("should summarize the chunk sizes of buffers in object mode", () => {
            AutometricStreamPipe.register.getSingleMetric(name + "_chunk_sizes_bytes").reset();
            const inPipe = new Pipe({ objectMode: true });
            const outPipe = new Pipe({ objectMode: true });
            const autometricStream = new AutometricStreamPipe();
            const testBuffer: Buffer = Buffer.from("Just a test");
            inPipe.pipe(autometricStream).pipe(outPipe);

            outPipe.on("data", () => {
                // do nothing, just consume...
            });
            inPipe.write(testBuffer);

            expect((AutometricStreamPipe.register.getSingleMetric(name + "_chunk_sizes_bytes") as any)
                .get().values.reduce((prev: null | number, elem: any) => {
                    if (prev) {
                        return prev;
                    }
                    if (elem.metricName === name + "_chunk_sizes_bytes_sum") {
                        return elem.value;
                    }
                }, null)).equal(testBuffer.length);
        });
        it("should summarize the number of chunks in pure object mode", () => {
            AutometricStreamPipe.register.getSingleMetric(name + "_chunk_sizes_bytes").reset();
            const inPipe = new Pipe({ objectMode: true });
            const outPipe = new Pipe({ objectMode: true });
            const autometricStream = new AutometricStreamPipe();
            const testObj: any = { message: "just a test" };
            inPipe.pipe(autometricStream).pipe(outPipe);

            outPipe.on("data", () => {
                // do nothing, just consume...
            });
            inPipe.write(testObj);
            inPipe.write(testObj);
            inPipe.write(testObj);

            expect((AutometricStreamPipe.register.getSingleMetric(name + "_chunk_sizes_bytes") as any)
                .get().values.reduce((prev: null | number, elem: any) => {
                    if (prev) {
                        return prev;
                    }
                    if (elem.metricName === name + "_chunk_sizes_bytes_sum") {
                        return elem.value;
                    }
                }, null)).equal(3);
        });
        it("should count an end", (done: MochaDone) => {
            AutometricStreamPipe.register.getSingleMetric(name + "_ends_total").reset();
            const inPipe = new Pipe();
            const outPipe = new Pipe();
            const autometricStream = new AutometricStreamPipe();
            inPipe.pipe(autometricStream).pipe(outPipe);
            outPipe.on("data", () => {
                // do nothing, just consume...
            });
            outPipe.on("finish", () => {
                expect((AutometricStreamPipe.register.getSingleMetric(name + "_ends_total") as any)
                    .get().values[0].value).equal(1);
                done();
            });

            inPipe.end("Just a test");
        });
        it("should count a non-emit", (done: MochaDone) => {
            AutometricStreamPipe.register.getSingleMetric(name + "_non_emits_total").reset();
            const inPipe = new Pipe();
            const outPipe = new Pipe();
            const autometricStream = new AutometricStreamPipe();
            inPipe.pipe(autometricStream).pipe(outPipe);
            outPipe.on("data", () => {
                // do nothing, just consume...
            });
            outPipe.on("finish", () => {
                expect((AutometricStreamPipe.register.getSingleMetric(name + "_non_emits_total") as any)
                    .get().values[0].value).equal(1);
                done();
            });

            inPipe.end();
        });

        it("should summarize the elapsed time", (done: MochaDone) => {
            AutometricStreamPipe.register.getSingleMetric(name + "_elapsed_time_ms").reset();
            const inPipe = new Pipe();
            const outPipe = new Pipe();
            const autometricStream = new AutometricStreamPipe();
            inPipe.pipe(autometricStream).pipe(outPipe);
            outPipe.on("data", () => {
                // do nothing, just consume...
            });
            outPipe.on("finish", () => {
                expect((AutometricStreamPipe.register.getSingleMetric(name + "_elapsed_time_ms") as any)
                    .get().values[0].value).above(49);
                expect((AutometricStreamPipe.register.getSingleMetric(name + "_elapsed_time_ms") as any)
                    .get().values[0].value).below(55);
                done();
            });

            const chunks = ["just", "a", "test"];
            const intv: NodeJS.Timer = setInterval(() => {
                if (chunks.length) {
                    inPipe.write(chunks.shift());
                    return;
                }
                inPipe.end();
                clearInterval(intv);
            }, 50);

        });
    });

    describe("summary", () => {
        let AutometricStreamPipe: IAutometricStreamPipeConstructor;
        const name = "summaries";
        before(() => {
            AutometricStreamPipe = createAutometricStreamPipe(name);
        });

        it("should measure execution duration", (done: MochaDone) => {
            AutometricStreamPipe.register.getSingleMetric(name + "_durations_ms").reset();
            const inPipe = new Pipe();
            const outPipe = new Pipe();
            const autometricStream = new AutometricStreamPipe();
            inPipe.pipe(autometricStream).pipe(outPipe);
            outPipe.on("data", () => {
                // do nothing, just consume...
            });

            inPipe.write("test");
            setTimeout(() => {
                inPipe.end();
                setTimeout(() => {
                    const values: any[] = (AutometricStreamPipe.register.getSingleMetric(name + "_durations_ms") as any)
                        .get().values;
                    expect(values[values.length - 2].value).greaterThan(999).lessThan(1010);
                    done();
                }, 10);
            }, 1000);
        });
        it("should measure execution duration after the first chunk", (done: MochaDone) => {
            AutometricStreamPipe.register.getSingleMetric(name + "_durations_ms").reset();
            const inPipe = new Pipe();
            const outPipe = new Pipe();
            const autometricStream = new AutometricStreamPipe();
            inPipe.pipe(autometricStream).pipe(outPipe);
            outPipe.on("data", () => {
                // do nothing, just consume...
            });

            setTimeout(() => {
                inPipe.write("test");
            }, 100);
            setTimeout(() => {
                inPipe.end();
                setTimeout(() => {
                    const values: any[] = (AutometricStreamPipe.register.getSingleMetric(name + "_durations_ms") as any)
                        .get().values;
                    expect(values[values.length - 2].value).greaterThan(890).lessThan(910);
                    done();
                }, 10);
            }, 1000);
        });
        it("should measure the number of chunks in one stream", (done: MochaDone) => {
            AutometricStreamPipe.register.getSingleMetric(name + "_chunk_sizes_bytes").reset();
            const inPipe = new Pipe();
            const outPipe = new Pipe();
            const autometricStream = new AutometricStreamPipe();
            inPipe.pipe(autometricStream).pipe(outPipe);
            outPipe.on("data", () => {
                // do nothing, just consume...
            });

            let nums = 13;
            const intv = setInterval(() => {
                if (nums === 0) {
                    inPipe.end();
                    clearInterval(intv);
                    return;
                }
                nums -= 1;
                inPipe.write("chunk...");
            }, 10);

            outPipe.on("end", () => {
                const values: any[] =
                    (AutometricStreamPipe.register.getSingleMetric(name + "_chunk_sizes_bytes") as any)
                    .get().values;
                expect(values[values.length - 1].value).equal(13);
                done();
            });
        });

        it("should measure the throughput per stream", (done: MochaDone) => {
            AutometricStreamPipe.register.getSingleMetric(name + "_throughput_bytes").reset();
            const inPipe = new Pipe();
            const outPipe = new Pipe();
            const autometricStream = new AutometricStreamPipe();
            inPipe.pipe(autometricStream).pipe(outPipe);
            outPipe.on("data", () => {
                // do nothing, just consume...
            });

            for (let i = 0; i < 13 ; i += 1) {
                inPipe.write("chunk...");
            }
            inPipe.end();

            outPipe.on("end", () => {
                const values: any[] = (AutometricStreamPipe.register.getSingleMetric(name + "_throughput_bytes") as any)
                    .get().values;
                expect(values[values.length - 2].value).equal(13 * 8);
                done();
            });
        });
    });
});
