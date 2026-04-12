import type { CircuitState, MatrixGateType } from '../stores';
import type { CanonicalUnitaryGate, CircuitIR, CircuitOperation, UnitaryOperation } from './schema';

const MATRIX_GATE_MAP: Record<MatrixGateType, CanonicalUnitaryGate> = {
    X: 'x',
    Y: 'y',
    Z: 'z',
    H: 'h',
    S: 's',
    T: 't',
}

export function fromCircuitState(circuitState: CircuitState): CircuitIR {
    const { numQubits, gates, qubitLabels } = circuitState;

    const maxColumn = gates.length ? Math.max(...gates.map(g => g.columnIndex)) : -1;
    const operations: CircuitOperation[] = [];

    for (let column = 0; column <= maxColumn; column++) {

        const colGates = gates.filter(g => g.columnIndex === column);
        const controlGates = colGates.filter(g => g.gateType === 'CONTROL');
        const nonControlGates = colGates.filter(g => g.gateType !== 'CONTROL');
        const controlsByTarget = new Map<number, number[]>();

        for (const ctrl of controlGates) {
            const targets: number[] = Array.isArray(ctrl.targetQubits)
                ? ctrl.targetQubits
                : typeof ctrl.targetQubit === 'number'
                    ? [ctrl.targetQubit]
                    : [];

            for (const target of targets) {
                const arr = controlsByTarget.get(target) ?? [];
                arr.push(ctrl.qubit);
                controlsByTarget.set(target, arr);
            }
        }

        const controlledTargets = new Set<number>();

        for (const [targetQubit, controls] of controlsByTarget.entries()) {
            const targetGate = nonControlGates.find(g => g.qubit === targetQubit);
            if (!targetGate) {
                throw new Error(`Invalid circuit: no target gate found at column ${column} for controlled target qubit ${targetQubit}`);
            }
            controlledTargets.add(targetQubit);

            operations.push({
                id: crypto.randomUUID(),
                kind: 'unitary',
                gate: MATRIX_GATE_MAP[targetGate.gateType as MatrixGateType],
                targets: [targetQubit],
                controls: [...controls].sort((a, b) => a - b),
                params: [],
                column,
            } satisfies UnitaryOperation);
        }

        for (const gate of nonControlGates) {
            if (controlledTargets.has(gate.qubit)) continue; // already handled as a controlled gate

            operations.push({
                id: crypto.randomUUID(),
                kind: 'unitary',
                gate: MATRIX_GATE_MAP[gate.gateType as MatrixGateType],
                targets: [gate.qubit],
                controls: [],
                params: [],
                column,
            } satisfies UnitaryOperation);
        }
    }

    return {
        version: '1.0',
        registers: {
            q: numQubits,
            c: 0,
        },
        qubitLabels:
            qubitLabels && qubitLabels.length === numQubits
                ? qubitLabels
                : Array.from({ length: numQubits }, (_, i) => `q${i}`),
        operations,
    };
}
