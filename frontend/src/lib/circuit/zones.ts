import { get } from 'svelte/store';
import type { CircuitIR, CircuitZone } from '../IR/schema';
import { circuitIR } from '../IR/stores';
import { MAX_ZONE_NAME } from '../IR/validate';
import { selectedGateIds } from './selection';
import { showNotification } from '../utils/notificationUtils';

/**
 * Zones: named stages of a circuit, such as "Oracle" or "Diffuser". A zone is
 * a range of columns across every qubit (see CircuitZone). It only labels the
 * circuit; the simulation never reads it.
 */

// The colour of each zone, by its place from left to right. Hues that read on
// both themes; the board mixes them with transparency.
export const ZONE_COLORS = ['#8b5cf6', '#14b8a6', '#f59e0b', '#0ea5e9', '#f43f5e', '#84cc16'];

export function zonesOf(ir: CircuitIR): CircuitZone[] {
	return [...(ir.zones ?? [])].sort((a, b) => a.startColumn - b.startColumn);
}

// The zone that covers a column, if there is one.
export function zoneAt(ir: CircuitIR, column: number): CircuitZone | undefined {
	return ir.zones?.find((z) => z.startColumn <= column && column <= z.endColumn);
}

// The widest a name tag may grow, in pixels, and how many rows of tags the
// board makes room for before it starts cutting long names short.
export const MAX_TAG_WIDTH = 240;
export const MAX_TAG_ROWS = 3;

/**
 * Where each zone's name tag goes. A tag starts at its zone's left edge and is
 * as wide as its name, so a one-column zone still shows its whole name. When
 * a tag would run into the one before it, it moves down a row. `width(zone)`
 * says how wide a tag needs to be, in pixels; the board measures the text.
 */
export function layoutZoneTags(
	zones: CircuitZone[],
	columnWidth: number,
	width: (zone: CircuitZone) => number
): { row: Map<string, number>; rows: number } {
	const rowEnds: number[] = []; // where the last tag on each row ends
	const row = new Map<string, number>();
	for (const zone of zones) {
		const left = zone.startColumn * columnWidth;
		const right = left + Math.min(MAX_TAG_WIDTH, width(zone));
		let r = rowEnds.findIndex((end) => end + 4 <= left);
		if (r === -1) r = rowEnds.length < MAX_TAG_ROWS ? rowEnds.length : MAX_TAG_ROWS - 1;
		rowEnds[r] = right;
		row.set(zone.id, r);
	}
	return { row, rows: rowEnds.length };
}

function setZones(update: (zones: CircuitZone[]) => CircuitZone[]) {
	circuitIR.update((ir) => {
		const zones = update(ir.zones ?? []);
		// Leave the field out when there are no zones, so a circuit without zones
		// looks exactly as it did before zones existed.
		const { zones: _old, ...rest } = ir;
		return zones.length ? { ...rest, zones } : rest;
	});
}

/**
 * Makes a zone over the columns of the selected gates, from the first to the
 * last. Returns the new zone's id, so the board can open its name for typing,
 * or null (after telling the user why) when no zone was made.
 */
export function createZoneFromSelection(): string | null {
	const ir = get(circuitIR);
	const ids = get(selectedGateIds);
	const columns = ir.operations.filter((op) => ids.has(op.id)).map((op) => op.column);
	if (columns.length === 0) {
		showNotification(
			'Select the gates of one part of the circuit first, then press Zone.',
			'error',
			4000
		);
		return null;
	}
	const startColumn = Math.min(...columns);
	const endColumn = Math.max(...columns);
	const clash = (ir.zones ?? []).find(
		(z) => startColumn <= z.endColumn && z.startColumn <= endColumn
	);
	if (clash) {
		showNotification(
			`Those columns overlap the zone "${clash.name || 'Untitled'}". Zones cannot overlap.`,
			'error',
			4000
		);
		return null;
	}
	const zone: CircuitZone = {
		id: crypto.randomUUID(),
		name: `Zone ${(ir.zones?.length ?? 0) + 1}`,
		startColumn,
		endColumn
	};
	setZones((zones) => [...zones, zone]);
	selectedGateIds.set(new Set());
	return zone.id;
}

export function renameZone(id: string, name: string): void {
	const clean = name.trim().slice(0, MAX_ZONE_NAME);
	setZones((zones) => zones.map((z) => (z.id === id ? { ...z, name: clean } : z)));
}

export function removeZone(id: string): void {
	setZones((zones) => zones.filter((z) => z.id !== id));
}
