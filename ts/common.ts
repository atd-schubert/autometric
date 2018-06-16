import { Counter, CounterConfiguration, Registry, Summary, SummaryConfiguration } from "prom-client";

export interface IAutometricCreateOptions {
    labels?: {[name: string]: string};
    registers?: Registry[];
}
export interface IAutometricCallOptions {
    labels?: {[name: string]: string};
}

export const autometricRegister: Registry = new Registry();

export const metrics = {
    counter: new Counter({
        help: `Autometric counter for the total amount of created counters`,
        name: "autometric_counters_total",
        registers: [autometricRegister],
    }),
    registry: new Counter({
        help: `Autometric counter for the total amount of created registers`,
        name: "autometric_registers_total",
        registers: [autometricRegister],
    }),
    summary: new Counter({
        help: `Autometric counter for the total amount of created summaries`,
        name: "autometric_summaries_total",
        registers: [autometricRegister],
    }),
};

export function createCounter(options: CounterConfiguration) {
    metrics.counter.inc();
    return new Counter(options);
}
export function createSummary(options: SummaryConfiguration) {
    metrics.summary.inc();
    return new Summary(options);
}
export function createRegistry() {
    metrics.registry.inc();
    return new Registry();
}
