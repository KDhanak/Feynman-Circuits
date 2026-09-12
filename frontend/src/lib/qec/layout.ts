import type { SurfaceCodeLayout, Check, DataQubit } from './schema';

// Rotated distance-3 surface code: 9 data qubits, 8 ancillas, 1 logical qubit.
//
// Coordinates use the same rules as Stim: data qubits sit where x and y are
// both odd, checks sit where x and y are both even, and y gets bigger going
// down. This way the backend can pass the same numbers straight into
// DETECTOR(x, y, r) lines without converting them. `backend/qec/layout.py` is
// an exact copy of this table, and a test checks that the two stay the same.
//
//        x=0   1   2   3   4   5   6
//  y=0             [X2]
//  y=1        q0   q1       q2
//  y=2   [Z2]    [X0]    [Z0]
//  y=3        q3   q4       q5
//  y=4        [Z1]    [X1]    [Z3]
//  y=5        q6   q7       q8
//  y=6            [X3]

const DATA_QUBITS: DataQubit[] = [
	{ id: 0, x: 1, y: 1 },
	{ id: 1, x: 3, y: 1 },
	{ id: 2, x: 5, y: 1 },
	{ id: 3, x: 1, y: 3 },
	{ id: 4, x: 3, y: 3 },
	{ id: 5, x: 5, y: 3 },
	{ id: 6, x: 1, y: 5 },
	{ id: 7, x: 3, y: 5 },
	{ id: 8, x: 5, y: 5 }
];

// The ancilla order here is the order used everywhere else in the app: the
// backend gives the ancilla qubits the numbers 9 to 16 in exactly this order.
const CHECKS: Check[] = [
	{ id: 'X0', type: 'X', x: 2, y: 2, dataQubits: [0, 1, 3, 4] },
	{ id: 'X1', type: 'X', x: 4, y: 4, dataQubits: [4, 5, 7, 8] },
	{ id: 'X2', type: 'X', x: 4, y: 0, dataQubits: [1, 2] },
	{ id: 'X3', type: 'X', x: 2, y: 6, dataQubits: [6, 7] },
	{ id: 'Z0', type: 'Z', x: 4, y: 2, dataQubits: [1, 2, 4, 5] },
	{ id: 'Z1', type: 'Z', x: 2, y: 4, dataQubits: [3, 4, 6, 7] },
	{ id: 'Z2', type: 'Z', x: 0, y: 2, dataQubits: [0, 3] },
	{ id: 'Z3', type: 'Z', x: 6, y: 4, dataQubits: [5, 8] }
];

export const D3_LAYOUT: SurfaceCodeLayout = {
	distance: 3,
	dataQubits: DATA_QUBITS,
	checks: CHECKS,
	// The logical Z operator acts on the 3 qubits of the top row, and that
	// number (3) is the code distance. Note: the hidden failure is NOT on this
	// row. It is a chain of three X errors down the left column (q0, q3, q6),
	// which fires no detectors but still flips the logical qubit.
	logicalZ: [0, 1, 2]
};

/** Size of the coordinate grid, used to set the size of the SVG viewBox. */
export const LATTICE_EXTENT = { minX: 0, minY: 0, maxX: 6, maxY: 6 };

export function getCheck(id: string): Check | undefined {
	return D3_LAYOUT.checks.find((c) => c.id === id);
}

export function getDataQubit(id: number): DataQubit | undefined {
	return D3_LAYOUT.dataQubits.find((q) => q.id === id);
}

/**
 * Checks whose stabiliser anticommutes with `pauli` on `qubit`. In simple
 * words: the checks that an error there would flip.
 *
 * Z checks catch X errors, X checks catch Z errors, and both kinds catch Y
 * errors. We only use this in the UI (to preview what placing an error would
 * light up). We never use it to work out the real syndrome. Only Stim does that.
 */
export function checksAffectedBy(qubit: number, pauli: 'X' | 'Y' | 'Z'): string[] {
	const detectedBy: CheckTypeFilter = pauli === 'X' ? 'Z' : pauli === 'Z' ? 'X' : 'both';
	return D3_LAYOUT.checks
		.filter((c) => c.dataQubits.includes(qubit))
		.filter((c) => detectedBy === 'both' || c.type === detectedBy)
		.map((c) => c.id);
}

type CheckTypeFilter = 'X' | 'Z' | 'both';
