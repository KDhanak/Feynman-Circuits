import type { InjectedError, Pauli } from './schema';

// The same limits as backend/qec/serializers.py. The backend is what really
// enforces them. These copies only stop the UI from building a request that
// it already knows will be rejected.
export const MAX_ROUNDS = 15;
export const MAX_ERRORS = 20;

/**
 * The experiment the user is setting up, before it is run. `pauli` and `round`
 * are the current choices in the controls: they decide what a click on a
 * data qubit places. `errors` is the injection ledger.
 */
export interface QecDraft {
	rounds: number;
	pauli: Pauli;
	round: number;
	errors: InjectedError[];
}

export const DEFAULT_DRAFT: QecDraft = { rounds: 3, pauli: 'X', round: 0, errors: [] };

/**
 * What a click on a data qubit does, for the chosen Pauli and round:
 * - no error on that qubit in that round: add one
 * - the same Pauli is already there: remove it, so a second click undoes the first
 * - a different Pauli is there: replace it
 *
 * Only one error per qubit per round. Two Paulis on the same qubit in the same
 * round just multiply into a third one (X then Z is Y), and it is clearer to
 * place that third one directly.
 */
export function toggleError(
	errors: InjectedError[],
	qubit: number,
	pauli: Pauli,
	round: number
): InjectedError[] {
	const i = errors.findIndex((e) => e.qubit === qubit && e.round === round);
	if (i >= 0) {
		if (errors[i].pauli === pauli) return errors.filter((_, j) => j !== i);
		return errors.map((e, j) => (j === i ? { ...e, pauli } : e));
	}
	if (errors.length >= MAX_ERRORS) return errors;
	return [...errors, { qubit, pauli, round }];
}

/** True when a click on this qubit would need a new slot in the ledger. */
export function wouldAdd(errors: InjectedError[], qubit: number, round: number): boolean {
	return !errors.some((e) => e.qubit === qubit && e.round === round);
}

/**
 * Change the number of rounds. Errors placed in rounds that no longer exist
 * are dropped, because the backend would reject them, and the chosen round is
 * pulled back inside the new range.
 */
export function withRounds(draft: QecDraft, rounds: number): QecDraft {
	const n = Math.max(1, Math.min(MAX_ROUNDS, Math.round(rounds)));
	return {
		...draft,
		rounds: n,
		round: Math.min(draft.round, n - 1),
		errors: draft.errors.filter((e) => e.round < n)
	};
}

/** Ledger order: by round, then by qubit. Reads as a timeline. */
export function sortedErrors(errors: InjectedError[]): InjectedError[] {
	return [...errors].sort((a, b) => a.round - b.round || a.qubit - b.qubit);
}

/**
 * Rounds are 0-based in the API (round 0 is the first) but shown from 1 in
 * the UI, because "round 0" reads like a bug to someone learning. This is the
 * only place that conversion happens.
 */
export function displayRound(round: number): number {
	return round + 1;
}

/** 1st, 2nd, 3rd, 4th ... 11th, 12th, 13th. Rounds never go past 15. */
export function ordinal(n: number): string {
	const teen = n % 100 >= 11 && n % 100 <= 13;
	const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10];
	return `${n}${suffix ?? 'th'}`;
}

/**
 * The sentence above the Run button. One fixed template, filled from the three
 * controls: the error type, the round to place it in, and the rounds in the run.
 */
export function describeDraft(draft: QecDraft): string {
	return `The ${draft.pauli} error will be injected in the ${ordinal(displayRound(draft.round))} round out of ${draft.rounds} rounds to selected qubit/s.`;
}
