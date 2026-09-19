import { describe, it, expect } from 'vitest';
import {
	DEFAULT_DRAFT,
	MAX_ERRORS,
	MAX_ROUNDS,
	displayRound,
	sortedErrors,
	toggleError,
	withRounds,
	wouldAdd
} from '$lib/qec/draft';
import type { InjectedError, Pauli } from '$lib/qec/schema';

const err = (qubit: number, pauli: Pauli, round: number): InjectedError => ({
	qubit,
	pauli,
	round
});

describe('toggleError (what a click on a data qubit does)', () => {
	it('adds an error to an empty ledger', () => {
		expect(toggleError([], 4, 'X', 0)).toEqual([err(4, 'X', 0)]);
	});

	it('removes it when the same Pauli is clicked again', () => {
		expect(toggleError([err(4, 'X', 0)], 4, 'X', 0)).toEqual([]);
	});

	it('replaces the Pauli when a different one is clicked', () => {
		expect(toggleError([err(4, 'X', 0)], 4, 'Z', 0)).toEqual([err(4, 'Z', 0)]);
	});

	it('keeps the same qubit in different rounds as separate errors', () => {
		expect(toggleError([err(4, 'X', 0)], 4, 'X', 1)).toEqual([err(4, 'X', 0), err(4, 'X', 1)]);
	});

	it('stops at the backend limit', () => {
		const full = Array.from({ length: MAX_ERRORS }, (_, i) => err(i % 9, 'X', Math.floor(i / 9)));
		expect(toggleError(full, 0, 'X', 14)).toHaveLength(MAX_ERRORS);
	});

	it('still lets you remove an error when the ledger is full', () => {
		const full = Array.from({ length: MAX_ERRORS }, (_, i) => err(i % 9, 'X', Math.floor(i / 9)));
		expect(toggleError(full, 0, 'X', 0)).toHaveLength(MAX_ERRORS - 1);
	});

	it('does not change the array it was given', () => {
		const before = [err(4, 'X', 0)];
		toggleError(before, 4, 'X', 0);
		expect(before).toEqual([err(4, 'X', 0)]);
	});
});

describe('wouldAdd', () => {
	it('is true only for a qubit and round with no error yet', () => {
		expect(wouldAdd([err(4, 'X', 0)], 4, 0)).toBe(false);
		expect(wouldAdd([err(4, 'X', 0)], 4, 1)).toBe(true);
	});
});

describe('withRounds', () => {
	it('drops errors placed in rounds that no longer exist', () => {
		const draft = { ...DEFAULT_DRAFT, rounds: 5, errors: [err(4, 'X', 1), err(2, 'Z', 4)] };
		expect(withRounds(draft, 3).errors).toEqual([err(4, 'X', 1)]);
	});

	it('pulls the chosen round back inside the new range', () => {
		expect(withRounds({ ...DEFAULT_DRAFT, rounds: 5, round: 4 }, 2).round).toBe(1);
	});

	it('clamps the number of rounds to what the backend accepts', () => {
		expect(withRounds(DEFAULT_DRAFT, 0).rounds).toBe(1);
		expect(withRounds(DEFAULT_DRAFT, 99).rounds).toBe(MAX_ROUNDS);
	});
});

describe('ledger display', () => {
	it('orders errors by round, then by qubit', () => {
		expect(sortedErrors([err(8, 'X', 1), err(4, 'Z', 0), err(2, 'X', 1)])).toEqual([
			err(4, 'Z', 0),
			err(2, 'X', 1),
			err(8, 'X', 1)
		]);
	});

	it('shows rounds counted from 1 while the API counts from 0', () => {
		expect(displayRound(0)).toBe(1);
	});
});
