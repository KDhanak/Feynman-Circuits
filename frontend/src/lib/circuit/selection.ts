import { writable, get } from 'svelte/store';
import { removeGate } from '$lib/circuit/dragDropUtils';

export const selectedGateIds = writable(new Set<string>());
export const isDragSelecting = writable(false);
export const dragStart = writable<{ x: number; y: number } | null>(null);
export const dragCurrent = writable<{ x: number; y: number } | null>(null);

const _gateRectCache = new Map<string, DOMRect>();
let _dragRafId: number | null = null;

export function handleGateSelection(gateId: string, event: MouseEvent) {
	if (event.ctrlKey || event.metaKey) {
		selectedGateIds.update((ids) => {
			const next = new Set(ids);
			if (next.has(gateId)) next.delete(gateId);
			else next.add(gateId);
			return next;
		});
	} else {
		selectedGateIds.set(new Set([gateId]));
	}
}

// Mobile: every tap toggles the gate in/out of the selection (no modifier key).
export function toggleGateSelection(gateId: string) {
	selectedGateIds.update((ids) => {
		const next = new Set(ids);
		if (next.has(gateId)) next.delete(gateId);
		else next.add(gateId);
		return next;
	});
}

export function clearSelection() {
	selectedGateIds.set(new Set());
}

export function deleteSelectedGates() {
	get(selectedGateIds).forEach((gateId) => removeGate(gateId));
	selectedGateIds.set(new Set());
}

export function handleBoardMouseDown(e: MouseEvent) {
	const target = e.target as HTMLElement;
	// Only start a selection on empty board space, never when the press starts on
	// a gate, a wire, or a qubit label. We use closest('.gate') (instead of checking
	// classList) so it also works when the press lands on something inside a gate:
	// the X-gate <svg>, the swap <span>, or the control/anti-control dot. Those used
	// to get through and create a fake selection box while the gate was being dragged.
	if (
		target.closest('.gate') ||
		target.classList.contains('wire-container') ||
		target.classList.contains('qubit-label')
	)
		return;

	isDragSelecting.set(true);
	dragStart.set({ x: e.clientX, y: e.clientY });
	dragCurrent.set({ x: e.clientX, y: e.clientY });

	_gateRectCache.clear();
	document.querySelectorAll('[data-gate-id]').forEach((gate) => {
		const gateId = gate.getAttribute('data-gate-id');
		if (gateId) _gateRectCache.set(gateId, (gate as HTMLElement).getBoundingClientRect());
	});

	// Listen for the drag on the whole window, not just the board. That way the box
	// keeps following the pointer even when it leaves the board (e.g. dragging down
	// into the results panel). A listener on the board stopped firing there, so the
	// box froze until the pointer came back (the "laggy vertical catch-up" bug).
	window.addEventListener('mousemove', handleBoardMouseMove);
	window.addEventListener('mouseup', handleBoardMouseUp);
}

export function handleBoardMouseMove(e: MouseEvent) {
	if (!get(isDragSelecting) || !get(dragStart)) return;
	if (_dragRafId !== null) cancelAnimationFrame(_dragRafId);
	_dragRafId = requestAnimationFrame(() => {
		dragCurrent.set({ x: e.clientX, y: e.clientY });
		_dragRafId = null;
	});
}

export function handleBoardMouseUp(e: MouseEvent) {
	const selecting = get(isDragSelecting);
	const start = get(dragStart);
	const current = get(dragCurrent);

	if (!selecting || !start || !current) {
		_resetDrag();
		return;
	}

	const minX = Math.min(start.x, current.x);
	const maxX = Math.max(start.x, current.x);
	const minY = Math.min(start.y, current.y);
	const maxY = Math.max(start.y, current.y);

	if (maxX - minX < 5 || maxY - minY < 5) {
		if (!(e.ctrlKey || e.metaKey)) clearSelection();
		_resetDrag();
		return;
	}

	const selectedInDrag = new Set<string>();
	_gateRectCache.forEach((rect, gateId) => {
		if (rect.right > minX && rect.left < maxX && rect.bottom > minY && rect.top < maxY) {
			selectedInDrag.add(gateId);
		}
	});

	if (e.ctrlKey || e.metaKey) {
		selectedGateIds.update((ids) => {
			const next = new Set(ids);
			selectedInDrag.forEach((id) => next.add(id));
			return next;
		});
	} else {
		selectedGateIds.set(selectedInDrag);
	}

	_resetDrag();
}

export function cancelDrag() {
	_resetDrag();
}

function _resetDrag() {
	if (_dragRafId !== null) {
		cancelAnimationFrame(_dragRafId);
		_dragRafId = null;
	}
	isDragSelecting.set(false);
	dragStart.set(null);
	dragCurrent.set(null);
	_gateRectCache.clear();
	window.removeEventListener('mousemove', handleBoardMouseMove);
	window.removeEventListener('mouseup', handleBoardMouseUp);
}
