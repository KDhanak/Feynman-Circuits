import type { CircuitIR } from '../IR/schema';
import {
	circuitIR,
	currentCircuitId,
	currentCircuitIsPublic,
	currentCircuitName
} from '../IR/stores';
import { isCircuitSaved, markAsReset, markNameResolved } from './autoSave';
import { resetHistory } from '../IR/history';
import { triggerSimulation } from './dragDropUtils';

export interface ApplyCircuitOptions {
	/** Server id of the circuit, if it is already in the user's library.
	 *  Leave it out for anything that came from outside (a file import, a
	 *  handoff), and a new id will be made instead. */
	id?: string;
	name?: string;
	/** Whether this circuit is already saved on the server. Decides whether the
	 *  button says Save or Rename, and whether auto-save may write to `id`. */
	saved?: boolean;
	/** Whether the signed-in owner has made this circuit public. Defaults to false,
	 *  which is correct for everything that is not the owner's own saved circuit:
	 *  file imports, handoffs, and circuits opened from someone else's link. */
	isPublic?: boolean;
}

/**
 * Puts a circuit on the board.
 *
 * Everything that loads a circuit goes through here (the library, the JSON /
 * OpenQASM / Qiskit importers, and circuits opened from a share link), because
 * the order of these store updates matters, and if it is wrong nothing warns you.
 *
 * Here is why: `autoSave` listens to `circuitIR` and saves to whatever id
 * `currentCircuitId` holds at that moment. If we set the IR without also
 * setting the right id, the next auto-save would write the *new* circuit over
 * the circuit that was *open before*. So an import that has no server id of its
 * own must take a new id and mark itself as reset before the board changes.
 */
export function applyCircuit(ir: CircuitIR, options: ApplyCircuitOptions = {}): void {
	const { id, name, saved = Boolean(id), isPublic = false } = options;

	// Set the id first: `circuitIR.set` is what wakes up auto-save, so by the time
	// auto-save runs, the id it saves to must already be correct.
	currentCircuitId.set(id ?? crypto.randomUUID());
	if (name !== undefined) currentCircuitName.set(name);

	if (saved) {
		// The name came from the server, so there is no need to pick an "Untitled" name.
		markNameResolved();
	} else {
		// Nothing to save over yet, so keep auto-save off until the user makes a change.
		markAsReset();
	}
	isCircuitSaved.set(saved);
	currentCircuitIsPublic.set(isPublic);

	circuitIR.set(ir);
	// Loading a circuit is not an edit, so the steps of whatever was open before
	// must go away. Otherwise one Ctrl+Z would bring the old circuit back onto
	// the board while the id and name above still belong to this one, and the
	// next auto-save would write the old gates over this circuit.
	resetHistory(ir);
	triggerSimulation(ir);
}
