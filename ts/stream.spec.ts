import { expect } from "chai";
import { Counter, Summary } from "prom-client";
import { PassThrough } from "stream";
import { createAutometricStreamPipe, IAutometricStreamPipeConstructor} from "./";

class Pipe extends PassThrough {
    constructor() {
        super({transform: (chunk, encoding, next) => { next(undefined, chunk); }});
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
            it("should have the chunk_sizes summary in the register", () => {
                expect(AutometricStreamPipe.register.getSingleMetric(name + "_chunk_sizes")).instanceOf(Summary);
            });
            it("should have the durations summary in the register", () => {
                expect(AutometricStreamPipe.register.getSingleMetric(name + "_durations")).instanceOf(Summary);
            });
            it("should have the emits counter in the register", () => {
                expect(AutometricStreamPipe.register.getSingleMetric(name + "_emits")).instanceOf(Counter);
            });
            it("should have the ends counter in the register", () => {
                expect(AutometricStreamPipe.register.getSingleMetric(name + "_ends")).instanceOf(Counter);
            });
            it("should have the non_emits counter in the register", () => {
                expect(AutometricStreamPipe.register.getSingleMetric(name + "_non_emits")).instanceOf(Counter);
            });
            it("should have the num_chunks summary in the register", () => {
                expect(AutometricStreamPipe.register.getSingleMetric(name + "_num_chunks")).instanceOf(Summary);
            });
            it("should have the throughput summary in the register", () => {
                expect(AutometricStreamPipe.register.getSingleMetric(name + "_throughput")).instanceOf(Summary);
            });
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
    });
    describe("counters", () => {
        let AutometricStreamPipe: IAutometricStreamPipeConstructor;
        const name = "counters";
        before(() => {
            AutometricStreamPipe = createAutometricStreamPipe(name);
        });

        it("should count a emitted chunk", () => {
            AutometricStreamPipe.register.getSingleMetric(name + "_emits").reset();
            const inPipe = new Pipe();
            const outPipe = new Pipe();
            const autometricStream = new AutometricStreamPipe();
            inPipe.pipe(autometricStream).pipe(outPipe);

            outPipe.on("data", () => {
                // do nothing, just consume...
            });
            inPipe.write("Just a test");
            expect((AutometricStreamPipe.register.getSingleMetric(name + "_emits") as any)
                .get().values[0].value).equal(1);
        });
        it("should count an end", (done: MochaDone) => {
            AutometricStreamPipe.register.getSingleMetric(name + "_ends").reset();
            const inPipe = new Pipe();
            const outPipe = new Pipe();
            const autometricStream = new AutometricStreamPipe();
            inPipe.pipe(autometricStream).pipe(outPipe);
            outPipe.on("data", () => {
                // do nothing, just consume...
            });

            inPipe.end("Just a test");
            setTimeout(() => {
                expect((AutometricStreamPipe.register.getSingleMetric(name + "_ends") as any)
                    .get().values[0].value).equal(1);
                done();
            }, 10);
        });
        it("should count a non-emit", (done: MochaDone) => {
            AutometricStreamPipe.register.getSingleMetric(name + "_non_emits").reset();
            const inPipe = new Pipe();
            const outPipe = new Pipe();
            const autometricStream = new AutometricStreamPipe();
            inPipe.pipe(autometricStream).pipe(outPipe);
            outPipe.on("data", () => {
                // do nothing, just consume...
            });

            inPipe.end();

            setTimeout(() => {
                expect((AutometricStreamPipe.register.getSingleMetric(name + "_non_emits") as any)
                    .get().values[0].value).equal(1);
                done();
            }, 10);

        });
    });
    // describe("summary", () => {
    //     let AutometricStreamPipe: IAutometricStreamPipeConstructor;
    //     const name = "summaries";
    //     before(() => {
    //         AutometricStreamPipe = createAutometricStreamPipe(name);
    //     });

    //     it("should measure execution duration", () => {
    //         return new AutometricStreamPipe((resolve) => {
    //             setTimeout(() => {
    //                 resolve(true);
    //             }, 1000);
    //         }).then(() => {
    //             const values: any[] = (AutometricStreamPipe.register.getSingleMetric(name + "_durations") as any)
    //                 .get().values;
    //             expect(
    //                 values[values.length - 2].value,
    //             ).greaterThan(999).lessThan(1010);
    //         });
    //     });
    // });
});
