import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$lib/utils/notificationUtils', () => ({ showNotification: vi.fn() }));

import { showNotification } from '$lib/utils/notificationUtils';
import { QEC_LOGICAL_QUBITS, qecMode, qubitLimit } from '$lib/qec/stores';
import { MAX_QUBITS } from '$lib/utils/constants';
import { circuitIR } from '$lib/IR/stores';
import { applyBellPairPreset, toggleQecMode } from '$lib/circuit/circuitActions';

function useQubits(n: number) {
	circuitIR.update((ir) => ({
		...ir,
		registers: { ...ir.registers, q: n },
		qubitLabels: Array.from({ length: n }, (_, i) => `Qubit ${i}`),
		operations: []
	}));
}

beforeEach(() => {
	qecMode.set(false);
	useQubits(1);
	vi.mocked(showNotification).mockReset();
});

describe('qubit limit', () => {
	it('is the normal maximum outside QEC mode', () => {
		expect(get(qubitLimit)).toBe(MAX_QUBITS);
	});

	it('is one logical qubit in QEC mode', () => {
		qecMode.set(true);
		expect(get(qubitLimit)).toBe(QEC_LOGICAL_QUBITS);
		expect(QEC_LOGICAL_QUBITS).toBe(1);
	});
});

describe('Bell Pair in QEC mode', () => {
	it('adds nothing and says why', () => {
		qecMode.set(true);
		applyBellPairPreset();
		expect(get(circuitIR).registers.q).toBe(1);
		expect(get(circuitIR).operations).toHaveLength(0);
		expect(showNotification).toHaveBeenCalledWith(expect.stringMatching(/two qubits/), 'error');
	});
});

describe('entering QEC mode', () => {
	it('keeps extra qubits but warns about them', () => {
		useQubits(3);
		toggleQecMode();
		expect(get(qecMode)).toBe(true);
		expect(get(circuitIR).registers.q).toBe(3);
		expect(showNotification).toHaveBeenCalledWith(expect.stringMatching(/3 qubits/), 'error', 5000);
	});

	it('stays quiet when the circuit already fits', () => {
		toggleQecMode();
		expect(get(qecMode)).toBe(true);
		expect(showNotification).not.toHaveBeenCalled();
	});
});
