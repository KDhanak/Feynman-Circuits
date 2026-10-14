import { D3_LAYOUT, LATTICE_EXTENT } from './layout';
import type { CheckType, DetectorRef, MatchingEdge, SurfaceCodeLayout } from './schema';

// Turns the decoder's matching (layer 3) into shapes to draw on the lattice.
// Pure geometry in grid units, so the panel only has to scale it to pixels.
//
// Each edge from the backend joins two detection events, or one event and
// the edge of the code. On the lattice that becomes one of three marks:
// - pair:     two different checks. A line between their ancillas.
// - boundary: one check and the edge of the code. A stub out to that edge.
// - time:     the same check in two rounds. On a flat picture both ends sit
//             on the same spot, so it is drawn as a ring around the ancilla.

export interface Point {
	x: number;
	y: number;
}

export type MatchingMark =
	| { kind: 'pair'; from: Point; to: Point; label: string }
	| { kind: 'boundary'; from: Point; to: Point; label: string }
	| { kind: 'time'; at: Point; label: string };

/**
 * The step the backend gives to the last detectors is `rounds`: they compare
 * the final data readout with the last round of checks, so they are not a
 * round of their own.
 */
export function describeRound(round: number, rounds: number): string {
	return round >= rounds ? 'final readout' : `round ${round + 1}`;
}

/**
 * Which way an error chain leaves the code from a check of this type.
 *
 * The two-qubit checks of a type sit on the edges where chains of that kind
 * CANNOT end. Here the two-qubit Z checks (Z2, Z3) are on the left and right,
 * so X-error chains, which Z checks see, end at the top and bottom. This is
 * read from the layout instead of typed in, so it stays right for any layout
 * built the same way.
 */
export function boundaryAxis(type: CheckType, layout: SurfaceCodeLayout = D3_LAYOUT): 'x' | 'y' {
	const edgeChecks = layout.checks.filter((c) => c.type === type && c.dataQubits.length === 2);
	const onLeftOrRight = edgeChecks.some(
		(c) => c.x === LATTICE_EXTENT.minX || c.x === LATTICE_EXTENT.maxX
	);
	return onLeftOrRight ? 'y' : 'x';
}

/** The point on the nearest allowed edge, straight out from the check. */
function boundaryPoint(at: Point, axis: 'x' | 'y'): Point {
	if (axis === 'y') {
		const mid = (LATTICE_EXTENT.minY + LATTICE_EXTENT.maxY) / 2;
		return { x: at.x, y: at.y <= mid ? LATTICE_EXTENT.minY : LATTICE_EXTENT.maxY };
	}
	const mid = (LATTICE_EXTENT.minX + LATTICE_EXTENT.maxX) / 2;
	return { x: at.x <= mid ? LATTICE_EXTENT.minX : LATTICE_EXTENT.maxX, y: at.y };
}

/**
 * The shapes for one decode. Edges that name a check the layout does not have
 * are skipped rather than drawn in the wrong place.
 */
export function matchingMarks(
	matching: MatchingEdge[],
	rounds: number,
	layout: SurfaceCodeLayout = D3_LAYOUT
): MatchingMark[] {
	const checks = new Map(layout.checks.map((c) => [c.id, c]));
	const name = (d: DetectorRef) => `${d.checkId} (${describeRound(d.round, rounds)})`;
	const marks: MatchingMark[] = [];

	for (const edge of matching) {
		const a = checks.get(edge.a.checkId);
		if (!a) continue;
		const from = { x: a.x, y: a.y };

		if (edge.kind === 'boundary') {
			marks.push({
				kind: 'boundary',
				from,
				to: boundaryPoint(from, boundaryAxis(a.type, layout)),
				label: `${name(edge.a)} paired with the edge of the code: an error chain running out to the boundary.`
			});
			continue;
		}

		const b = checks.get(edge.b.checkId);
		if (!b) continue;
		if (a.id === b.id) {
			marks.push({
				kind: 'time',
				at: from,
				label: `${a.id} paired with itself, ${describeRound(edge.a.round, rounds)} and ${describeRound(edge.b.round, rounds)}: a faulty measurement, not an error on a data qubit.`
			});
		} else {
			marks.push({
				kind: 'pair',
				from,
				to: { x: b.x, y: b.y },
				label: `${name(edge.a)} paired with ${name(edge.b)}: one error chain between them.`
			});
		}
	}
	return marks;
}
