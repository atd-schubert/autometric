import { expect } from "chai";
import freeport from "freeport";
import {createServer, IncomingMessage, Server, ServerResponse} from "http";
import { Counter, Summary } from "prom-client";
import request from "request-promise";
import { autometricRegister, createAutometricMiddleware, IAutometricMiddlewareObject } from "./";

describe("AutometricMiddleware", () => {
    const requestResponseMock: any = {
        on(name: string, callback: () => void) { callback(); },
        method: "GET",
        socket: {
            bytesRead: 111,
            bytesWritten: 333,
        },
        statusCode: 200,
    };

    describe("creation of the middleware object", () => {
        let middlewareObject: IAutometricMiddlewareObject;
        const prefix: string = "instance_of_middleware";
        const labels: { [name: string]: string } = { test: "OK" };

        before(() => {
            autometricRegister.getSingleMetric("autometric_counters_total").reset();
            autometricRegister.getSingleMetric("autometric_registers_total").reset();
            autometricRegister.getSingleMetric("autometric_summaries_total").reset();
        });
        before(() => {
            middlewareObject = createAutometricMiddleware(prefix, { labels });
        });

        it("should have a metrics register", () => void expect(middlewareObject.register).instanceOf(Object));
        it("should have the prefix", () => void expect(middlewareObject.prefix).equal(prefix));
        it("should have the labels object", () => void expect(middlewareObject.labels).deep.equal(labels));
        it("should return a middleware function", () =>
            void expect(middlewareObject.createMiddleware()).instanceOf(Function),
        );

        it("should count the creation of a counters", () => void expect(
            (autometricRegister.getSingleMetric("autometric_counters_total") as any).get().values[0].value,
        ).equal(3));
        it("should count the creation of a register", () => void expect(
            (autometricRegister.getSingleMetric("autometric_registers_total") as any).get().values[0].value,
        ).equal(1));
        it("should count the creation of a summaries", () => void expect(
            (autometricRegister.getSingleMetric("autometric_summaries_total") as any).get().values[0].value,
        ).equal(3));

        it("should have the calls_total Counter in the register", () => {
            expect(middlewareObject.register.getSingleMetric(prefix + "_calls_total")).instanceOf(Counter);
        });
        it("should have the durations_ms Summary in the register", () => {
            expect(middlewareObject.register.getSingleMetric(prefix + "_durations_ms")).instanceOf(Summary);
        });
        it("should have the fails_total Counter in the register", () => {
            expect(middlewareObject.register.getSingleMetric(prefix + "_fails_total")).instanceOf(Counter);
        });
        it("should have the incoming_bytes Summary in the register", () => {
            expect(middlewareObject.register.getSingleMetric(prefix + "_incoming_bytes")).instanceOf(Summary);
        });
        it("should have the outgoing_bytes Summary in the register", () => {
            expect(middlewareObject.register.getSingleMetric(prefix + "_outgoing_bytes")).instanceOf(Summary);
        });
        it("should have the successes_total Counter in the register", () => {
            expect(middlewareObject.register.getSingleMetric(prefix + "_successes_total")).instanceOf(Counter);
        });
    });
    describe("work as a middleware", () => {
        let middlewareObject: IAutometricMiddlewareObject;
        const prefix: string = "instance_of_middleware";
        const labels: { [name: string]: string } = { test: "OK" };

        before(() => {
            middlewareObject = createAutometricMiddleware(prefix, { labels });
        });

        it("should pass to next", (done: MochaDone) => {
            middlewareObject.createMiddleware()(requestResponseMock, requestResponseMock, () => done());
        });
    });
    describe("counters", () => {
        describe("calls", () => {
            let middlewareObject: IAutometricMiddlewareObject;
            const prefix: string = "calls_total_counters";
            before(() => {
                middlewareObject = createAutometricMiddleware(prefix, {
                    addMethodLabel: true,
                    addStatusCodeLabel: true,
                });
            });

            before((done: MochaDone) => {
                middlewareObject.createMiddleware()(requestResponseMock, requestResponseMock, done);
            });
            it("should count a number of calls of the middleware", () => {
                expect((middlewareObject.register.getSingleMetric(prefix + "_calls_total") as any)
                    .get().values[1].value).equal(1);
            });
            it("should have the given method", () => {
                expect((middlewareObject.register.getSingleMetric(prefix + "_calls_total") as any)
                    .get().values[1].labels.method).equal("GET");
            });
            it("should have the given status code", () => {
                expect((middlewareObject.register.getSingleMetric(prefix + "_calls_total") as any)
                    .get().values[1].labels.statusCode).equal("200");
            });
        });
        describe("fails", () => {
            let middlewareObject: IAutometricMiddlewareObject;
            const prefix: string = "fails_total_counters";
            before(() => {
                middlewareObject = createAutometricMiddleware(prefix, {
                    addMethodLabel: true,
                    addStatusCodeLabel: true,
                });
            });

            before((done: MochaDone) => {
                middlewareObject.createMiddleware()(
                    requestResponseMock,
                    {
                        ...requestResponseMock,
                        statusCode: 500,
                    },
                    done,
                );
            });
            it("should count a number of calls of the middleware", () => {
                expect((middlewareObject.register.getSingleMetric(prefix + "_fails_total") as any)
                    .get().values[1].value).equal(1);
            });
            it("should have the given method", () => {
                expect((middlewareObject.register.getSingleMetric(prefix + "_fails_total") as any)
                    .get().values[1].labels.method).equal("GET");
            });
            it("should have the given status code", () => {
                expect((middlewareObject.register.getSingleMetric(prefix + "_fails_total") as any)
                    .get().values[1].labels.statusCode).equal("500");
            });
        });
        // describe("bytes incoming", () => {});
        // describe("bytes outgoing", () => {});
        describe("successes", () => {
            let middlewareObject: IAutometricMiddlewareObject;
            const prefix: string = "success_total_counters";
            before(() => {
                middlewareObject = createAutometricMiddleware(prefix, {
                    addMethodLabel: true,
                    addStatusCodeLabel: true,
                });
            });

            before((done: MochaDone) => {
                middlewareObject.createMiddleware()(requestResponseMock, requestResponseMock, done);
            });
            it("should count a number of calls of the middleware", () => {
                expect((middlewareObject.register.getSingleMetric(prefix + "_successes_total") as any)
                    .get().values[1].value).equal(1);
            });
            it("should have the given method", () => {
                expect((middlewareObject.register.getSingleMetric(prefix + "_successes_total") as any)
                    .get().values[1].labels.method).equal("GET");
            });
            it("should have the given status code", () => {
                expect((middlewareObject.register.getSingleMetric(prefix + "_successes_total") as any)
                    .get().values[1].labels.statusCode).equal("200");
            });
        });
    });
    describe("integration test", () => {
        context("success", () => {
            let port: number;
            let server: Server;
            let middlewareObject: IAutometricMiddlewareObject;
            const prefix: string = "int_success";

            before(() => {
                middlewareObject = createAutometricMiddleware(prefix, {
                    addClosedByLabel: true,
                    addMethodLabel: true,
                    addStatusCodeLabel: true,
                });
            });
            after((done: MochaDone) => {
                server.close(done);
            });

            before((done: MochaDone) => {
                freeport((err: Error, result: number) => {
                    port = result;
                    server = createServer((req: IncomingMessage, res: ServerResponse) => {
                        middlewareObject.createMiddleware()(req, res, () => {
                            res.writeHead(200);
                            res.end("Test-Response");
                        });
                    });
                    server.listen(port, done);
                });
            });
            before(() => Promise.all([
                request("http://localhost:" + port + "/andsix"),
                request("http://localhost:" + port),
                request("http://localhost:" + port),
                request("http://localhost:" + port),
                request("http://localhost:" + port),
                request("http://localhost:" + port),
                request("http://localhost:" + port),
                request("http://localhost:" + port),
                request("http://localhost:" + port),
                request("http://localhost:" + port),
            ]));

            it("it should count a call", () => {
                expect((middlewareObject.register.getSingleMetric(prefix + "_calls_total") as any)
                    .get().values.map((value: any) => value.value).reduce((p: number, c: number) => p + c, 0))
                    .equal(10);
            });
            it("it should count the success", () => {
                expect((middlewareObject.register.getSingleMetric(prefix + "_successes_total") as any)
                    .get().values.map((value: any) => value.value).reduce((p: number, c: number) => p + c, 0))
                    .equal(10);
            });
            it("it should count the fails", () => {
                expect((middlewareObject.register.getSingleMetric(prefix + "_fails_total") as any)
                    .get().values.map((value: any) => value.value).reduce((p: number, c: number) => p + c, 0))
                    .equal(0);
            });
            it("it should summarize the incoming bytes", () => {
                expect((middlewareObject.register.getSingleMetric(prefix + "_incoming_bytes") as any)
                    .hashMap["closedBy:server,method:GET,statusCode:200"].sum)
                    .equal(606);
            });
            it("it should summarize the outgoing bytes", () => {
                expect((middlewareObject.register.getSingleMetric(prefix + "_outgoing_bytes") as any)
                    .hashMap["closedBy:server,method:GET,statusCode:200"].sum)
                    .equal(1260);
            });
        });
        context("fail", () => {
            let port: number;
            let server: Server;
            let middlewareObject: IAutometricMiddlewareObject;
            const prefix: string = "int_fails";

            before(() => {
                middlewareObject = createAutometricMiddleware(prefix, {
                    addClosedByLabel: true,
                    addMethodLabel: true,
                    addStatusCodeLabel: true,
                });
            });
            after((done: MochaDone) => {
                server.close(done);
            });

            before((done: MochaDone) => {
                freeport((err: Error, result: number) => {
                    port = result;
                    server = createServer((req: IncomingMessage, res: ServerResponse) => {
                        middlewareObject.createMiddleware()(req, res, () => {
                            res.writeHead(500);
                            res.end("Test-Response");
                        });
                    });
                    server.listen(port, done);
                });
            });
            before(() => Promise.all([
                request("http://localhost:" + port),
                request("http://localhost:" + port),
                request("http://localhost:" + port),
            ]).catch(() => { /* do nothing */ }));

            it("it should count a call", () => {
                expect((middlewareObject.register.getSingleMetric(prefix + "_calls_total") as any)
                    .get().values.map((value: any) => value.value).reduce((p: number, c: number) => p + c, 0))
                    .equal(3);
            });
            it("it should count the success", () => {
                expect((middlewareObject.register.getSingleMetric(prefix + "_successes_total") as any)
                    .get().values.map((value: any) => value.value).reduce((p: number, c: number) => p + c, 0))
                    .equal(0);
            });
            it("it should count the fails", () => {
                expect((middlewareObject.register.getSingleMetric(prefix + "_fails_total") as any)
                    .get().values.map((value: any) => value.value).reduce((p: number, c: number) => p + c, 0))
                    .equal(3);
            });
            it("it should count the incoming bytes", () => {
                expect((middlewareObject.register.getSingleMetric(prefix + "_incoming_bytes") as any)
                    .hashMap["closedBy:server,method:GET,statusCode:500"].sum)
                    .equal(180);
            });
            it("it should count the outgoing bytes", () => {
                expect((middlewareObject.register.getSingleMetric(prefix + "_outgoing_bytes") as any)
                    .hashMap["closedBy:server,method:GET,statusCode:500"].sum)
                    .equal(435);
            });
        });
    });
});
