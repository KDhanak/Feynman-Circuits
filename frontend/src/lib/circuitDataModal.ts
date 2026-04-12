import type { CircuitState, GateType } from '$lib/stores';
import { fromCircuitState } from '$lib/IR/fromCircuitState';

export type DataViewMode = 'json' | 'cir';

export function buildCircuitJson(circuitState: CircuitState) {
	const { numQubits, gates, qubitLabels } = circuitState;

	return {
		numQubits,
		qubitLabels,
		gates: gates.map(({ gateType, qubit, columnIndex, targetQubit, targetQubits }) => ({
			gate: gateType as GateType,
			qubit,
			columnIndex,
			...(gateType === 'CONTROL' && targetQubits && { targetQubits }),
			...(gateType === 'CONTROL' && !targetQubits && targetQubit !== undefined && { targetQubit })
		}))
	};
}

export function buildJsonString(circuitState: CircuitState): string {
	return JSON.stringify(buildCircuitJson(circuitState), null, 2);
}

export function buildCanonicalString(circuitState: CircuitState): string {
	const cir = fromCircuitState(circuitState);
	return typeof cir === 'string' ? cir : JSON.stringify(cir, null, 2);
}
