<script lang="ts">
	import { tick } from 'svelte';
	import type { UnitaryOperation } from '$lib/IR/schema';
	import { circuitIR } from '$lib/IR/stores';
	import { circuitLayout } from '$lib/stores/uiStores';

	export let boardEl: HTMLDivElement | null = null;

	type Connector = { key: string; left: number; top: number; height: number };
	let connectors: Connector[] = [];
	let rafId: number | null = null;

	// Connector <div>s are absolutely positioned inside boardEl, which is itself
	// the horizontally-scrolling track. getBoundingClientRect gives *visual*
	// coordinates, so we add the scroll offset to convert them into boardEl's
	// content coordinate space — otherwise the lines drift by scrollLeft when the
	// track is scrolled. (boardEl doesn't scroll vertically, so scrollTop is 0.)
	function getCenter(el: Element, boardRect: DOMRect) {
		const r = (el as HTMLElement).getBoundingClientRect();
		const scrollLeft = boardEl?.scrollLeft ?? 0;
		const scrollTop = boardEl?.scrollTop ?? 0;
		return {
			x: r.left - boardRect.left + scrollLeft + r.width / 2,
			y: r.top - boardRect.top + scrollTop + r.height / 2
		};
	}

	function buildConnectors(boardRect: DOMRect): Connector[] {
		if (!boardEl) return [];
		const next: Connector[] = [];

		for (const op of $circuitIR.operations) {
			if (op.kind !== 'unitary') continue;
			const unitOp = op as UnitaryOperation;
			if (unitOp.controls.length === 0 && unitOp.antiControls.length === 0) continue;

			for (const targetQubit of unitOp.targets) {
				const targetEl = boardEl.querySelector(
					`[data-col="${unitOp.column}"][data-qubit="${targetQubit}"]:not([data-type="CONTROL"]):not([data-type="ANTI_CONTROL"])`
				);
				if (!targetEl) continue;
				const t = getCenter(targetEl, boardRect);

				for (const ctrl of unitOp.controls) {
					const controlEl = boardEl.querySelector(
						`[data-col="${unitOp.column}"][data-qubit="${ctrl}"][data-type="CONTROL"]`
					);
					if (!controlEl) continue;
					const c = getCenter(controlEl, boardRect);
					next.push({
						key: `${unitOp.id}-ctrl-${ctrl}-${targetQubit}`,
						left: c.x,
						top: Math.min(c.y, t.y),
						height: Math.abs(c.y - t.y)
					});
				}

				for (const antiCtrl of unitOp.antiControls) {
					const antiControlEl = boardEl.querySelector(
						`[data-col="${unitOp.column}"][data-qubit="${antiCtrl}"][data-type="ANTI_CONTROL"]`
					);
					if (!antiControlEl) continue;
					const c = getCenter(antiControlEl, boardRect);
					next.push({
						key: `${unitOp.id}-antictrl-${antiCtrl}-${targetQubit}`,
						left: c.x,
						top: Math.min(c.y, t.y),
						height: Math.abs(c.y - t.y)
					});
				}
			}
		}

		// SWAP connectors — line between the two × symbols
		for (const op of $circuitIR.operations) {
			if (op.kind !== 'unitary') continue;
			const unitOp = op as UnitaryOperation;
			if (unitOp.gate !== 'swap' || unitOp.targets.length !== 2) continue;
			const [t1, t2] = unitOp.targets;
			const el1 = boardEl.querySelector(
				`[data-col="${unitOp.column}"][data-qubit="${t1}"][data-type="GATE"]`
			);
			const el2 = boardEl.querySelector(
				`[data-col="${unitOp.column}"][data-qubit="${t2}"][data-type="GATE"]`
			);
			if (!el1 || !el2) continue;
			const c1 = getCenter(el1, boardRect);
			const c2 = getCenter(el2, boardRect);
			next.push({
				key: `${unitOp.id}-swap`,
				left: c1.x,
				top: Math.min(c1.y, c2.y),
				height: Math.abs(c1.y - c2.y)
			});
		}

		return next;
	}

	async function recomputeConnectors() {
		await tick();
		await tick();
		if (!boardEl) return;
		connectors = buildConnectors(boardEl.getBoundingClientRect());
	}

	// Exported so the parent's scroll handler can call it synchronously,
	// avoiding a one-frame flicker when the board scrolls.
	export function recomputeConnectorsSync() {
		if (!boardEl) return;
		connectors = buildConnectors(boardEl.getBoundingClientRect());
	}

	function scheduleConnectorRecompute() {
		if (typeof window === 'undefined') return;
		if (rafId !== null) cancelAnimationFrame(rafId);
		rafId = requestAnimationFrame(() => {
			recomputeConnectors();
			rafId = null;
		});
	}

	$: ($circuitIR.operations, $circuitLayout, scheduleConnectorRecompute());
</script>

{#each connectors as line (line.key)}
	<div
		class="absolute w-0.5 bg-ternary-1 pointer-events-none z-10"
		style="left: {line.left}px; top: {line.top}px; height: {line.height}px; transform: translateX(-50%);"
	></div>
{/each}
