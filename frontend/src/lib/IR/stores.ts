import { writable } from "svelte/store";
import type { CircuitIR } from "./schema";

export const circuitIR = writable<CircuitIR>({
    version: '1.0',
    registers: {
        q: 1,
        c: 0
    },
    qubitLabels: ['q0'],
    operations: []
});
