import type { CircuitIR } from '../IR/schema';
import {
	circuitIR,
	currentCircuitId,
	currentCircuitIsPublic,
	currentCircuitName
} from '../IR/stores';
import { isCircuitSaved, markAsReset, markNameResolved } from './autoSave';
import { triggerSimulation } from './dragDropUtils';

export interface ApplyCircuitOptions {
	/** Server id of the circuit, when it already exists in the user's library.
	 *  Omit for anything that arrived from outside — a file import, a handoff —
	 *  and a fresh id is minted instead. */
	id?: string;
	name?: string;
	/** Whether this circuit already exists server-side. Drives the Save/Rename
	 *  button label and whether auto-save may write to `id`. */
	saved?: boolean;
	/** Whether the signed-in owner has published this circuit. Defaults to false,
	 *  which is right for everything that is not the owner's own saved circuit —
	 *  file imports, handoffs, and circuits opened from someone else's link. */
	isPublic?: boolean;
}

/**
 * Put a circuit on the board.
 *
 * Everything that loads a circuit goes through here — the library, the JSON /
 * OpenQASM / Qiskit importers, and the cross-platform handoff — because the
 * order of these store writes matters and getting it wrong is silent.
 *
 * Specifically: `autoSave` subscribes to `circuitIR` and persists to whatever
 * `currentCircuitId` happens to hold. Setting the IR without also settling the
 * id means the next auto-save writes the *new* circuit over the *previously
 * open* one. So an import with no server identity of its own must claim a fresh
 * id and mark itself reset before the board is touched.
 */
export function applyCircuit(ir: CircuitIR, options: ApplyCircuitOptions = {}): void {
	const { id, name, saved = Boolean(id), isPublic = false } = options;

	// Identity first: `circuitIR.set` is what wakes auto-save up, so by the time
	// it fires the destination must already be correct.
	currentCircuitId.set(id ?? crypto.randomUUID());
	if (name !== undefined) currentCircuitName.set(name);

	if (saved) {
		// Name came from the server, so no need to resolve an "Untitled" one.
		markNameResolved();
	} else {
		// Nothing to overwrite yet — hold auto-save off until the user edits.
		markAsReset();
	}
	isCircuitSaved.set(saved);
	currentCircuitIsPublic.set(isPublic);

	circuitIR.set(ir);
	triggerSimulation(ir);
}
