<script lang="ts">
	import type { BlochVector } from '$lib/quantum/bloch';

	export let vector: BlochVector;
	export let size = 150;
	export let showDetails = true;
	export let showAxisLabels = false;
	$: CENTER = size / 2;
	$: R = size * 0.35;

	function project(x: number, y: number, z: number) {
		const px = CENTER + x * 0.9 * R - y * 0.45 * R;
		const py = CENTER - z * 0.95 * R + y * 0.28 * R;
		return { x: px, y: py };
	}

	$: tip = project(vector.x, vector.y, vector.z);
	$: centerPoint = project(0, 0, 0);
	$: plusX = project(1, 0, 0);
	$: plusY = project(0, 1, 0);
	$: plusZ = project(0, 0, 1);
	$: minusX = project(-1, 0, 0);
	$: minusY = project(0, -1, 0);
	$: minusZ = project(0, 0, -1);
	// Radius at which axis labels sit. <1 keeps them inside the sphere outline,
	// >1 pushes them outside it. Scales with size automatically via project().
	const LABEL_RADIUS = 0.82;
	$: xLabel = project(LABEL_RADIUS, 0, 0);
	$: yLabel = project(0, LABEL_RADIUS, 0);
	$: zLabel = project(0, 0, LABEL_RADIUS);
	$: labelFont = Math.max(8, size * 0.06);
	$: coordText = `x=${vector.x.toFixed(2)} y=${vector.y.toFixed(2)} z=${vector.z.toFixed(2)}`;
</script>

<div class="bloch-card">
	<svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
		{#if showAxisLabels}
			<text
				x={xLabel.x}
				y={xLabel.y}
				font-size={labelFont}
				text-anchor="middle"
				dominant-baseline="middle"
				class="axis-label">+x</text
			>
			<text
				x={yLabel.x}
				y={yLabel.y}
				font-size={labelFont}
				text-anchor="middle"
				dominant-baseline="middle"
				class="axis-label">+y</text
			>
			<text
				x={zLabel.x}
				y={zLabel.y}
				font-size={labelFont}
				text-anchor="middle"
				dominant-baseline="middle"
				class="axis-label">+z</text
			>
		{/if}

		<circle cx={CENTER} cy={CENTER} r={R} class="sphere" />
		<ellipse cx={CENTER} cy={CENTER} rx={R} ry={R * 0.35} class="equator" />

		<line x1={minusZ.x} y1={minusZ.y} x2={plusZ.x} y2={plusZ.y} class="axis" />
		<line x1={minusX.x} y1={minusX.y} x2={plusX.x} y2={plusX.y} class="axis" />
		<line x1={minusY.x} y1={minusY.y} x2={plusY.x} y2={plusY.y} class="axis" />

		<line x1={centerPoint.x} y1={centerPoint.y} x2={tip.x} y2={tip.y} class="vector" />

		<circle cx={tip.x} cy={tip.y} r={Math.max(2.5, size * 0.02)} class="tip" />
		<circle cx={centerPoint.x} cy={centerPoint.y} r={Math.max(1.5, size * 0.016)} class="origin" />
	</svg>

	{#if showDetails}
		<div class="coords">{coordText}</div>
		<div class="purity">|r|={vector.magnitude.toFixed(2)}</div>
	{/if}
</div>

<style>
	.bloch-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		background: transparent;
	}
	.sphere {
		fill: var(--color-surface);
		border-color: var(--color-secondary-2);
		stroke: var(--color-secondary-2);
		stroke-width: 2;
	}
	.equator {
		fill: none;
		stroke: var(--color-line);
		stroke-width: 1;
		stroke-dasharray: 3 3;
	}
	.axis {
		stroke: var(--color-line);
		stroke-width: 1;
	}
	.vector {
		stroke: var(--color-ternary-1);
		stroke-width: 2;
	}
	.tip {
		fill: var(--color-ternary-1);
	}
	.origin {
		fill: var(--color-line);
	}
	.coords,
	.purity {
		font-size: 0.75rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		color: var(--color-text);
	}
	.axis-label {
		fill: var(--color-line);
		font-weight: 700;
		pointer-events: none;
	}
</style>
