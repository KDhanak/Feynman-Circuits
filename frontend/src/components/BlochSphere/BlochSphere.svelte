<script lang="ts">
	import type { BlochVector } from '$lib/quantum/bloch';

	export let vector: BlochVector;
	export let label = 'Qubit';
	export let size = 150;
	export let showDetails = true;
	export let showAxisLabels = false;
	export let axisLabelColor = 'rgba(255,255,255,0.8)';

	$: CENTER = size / 2;
	$: R = size * 0.35;

	function project(x: number, y: number, z: number) {
		const px = CENTER + (x - y) * 0.6 * R;
		const py = CENTER - z * 0.95 * R + (x + y) * 0.25 * R;
		return { x: px, y: py };
	}

	$: tip = project(vector.x, vector.y, vector.z);
	$: plusX = project(1, 0, 0);
	$: plusY = project(0, 1, 0);
	$: plusZ = project(0, 0, 1);
	$: coordText = `x=${vector.x.toFixed(2)} y=${vector.y.toFixed(2)} z=${vector.z.toFixed(2)}`;
</script>

<div class="bloch-card">
	<svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
		{#if showAxisLabels}
			<!-- fixed compass-style labels -->
			<text x={CENTER + R + 10} y={CENTER + 4} class="axis-label">+x</text>
			<text x={CENTER - R - 18} y={CENTER + 4} class="axis-label">+y</text>
			<text x={CENTER - 6} y={CENTER - R - 8} class="axis-label">+z</text>
		{/if}

		<circle cx={CENTER} cy={CENTER} r={R} class="sphere" />
		<ellipse cx={CENTER} cy={CENTER} rx={R} ry={R * 0.35} class="equator" />
		<line x1={CENTER} y1={CENTER - R} x2={CENTER} y2={CENTER + R} class="axis" />
		<line
			x1={CENTER - R * 0.85}
			y1={CENTER + R * 0.25}
			x2={CENTER + R * 0.85}
			y2={CENTER - R * 0.25}
			class="axis"
		/>
		<line x1={CENTER} y1={CENTER} x2={tip.x} y2={tip.y} class="vector" />
		<circle cx={tip.x} cy={tip.y} r={Math.max(2.5, size * 0.03)} class="tip" />
		<circle cx={CENTER} cy={CENTER} r={Math.max(1.5, size * 0.016)} class="origin" />
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
		min-width: 100px;
	}
	.sphere {
		fill: #152238;
		border-color: #7e22ce;
		stroke: #7e22ce;
		stroke-width: 3;
	}
	.equator {
		fill: none;
		stroke: rgba(255, 255, 255, 1);
		stroke-width: 1.5;
		stroke-dasharray: 3 3;
	}
	.axis {
		stroke: rgba(255, 255, 255, 1);
		stroke-width: 1.5;
	}
	.vector {
		stroke: #ff204e;
		stroke-width: 2;
	}
	.tip {
		fill: #ff204e;
	}
	.origin {
		fill: rgba(255, 255, 255, 0.8);
	}
	.coords,
	.purity {
		font-size: 0.75rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		opacity: 0.9;
		color: white;
	}
	.axis-label {
		fill: rgba(255, 255, 255, 0.8);
		font-size: 0.7rem;
		font-weight: 700;
		pointer-events: none;
	}
</style>
