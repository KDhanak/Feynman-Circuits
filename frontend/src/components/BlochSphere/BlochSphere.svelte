<script lang="ts">
	import type { BlochVector } from '$lib/quantum/bloch';

	export let vector: BlochVector;
	export let size = 150;
	export let showDetails = true;
	export let showAxisLabels = false;
	$: CENTER = size / 2;
	$: R = size * 0.35;

	// Orthographic projection of a unit sphere seen from elevation θ above the
	// equatorial plane, at azimuth α around it:
	//   screen right = −sinα·x + cosα·y
	//   screen up    = −sinθ·(cosα·x + sinα·y) + cosθ·z
	// Every mark is derived from these two angles, which is what keeps the axes,
	// the equator and the outline in agreement: the equator projects to an ellipse
	// with semi-axes R and sinθ·R (so the ±x/±y tips land exactly on it), and the
	// poles land at cosθ·R — just inside the outline, as orthographic projection
	// of a sphere requires. Because the camera sits in the +x+y+z octant, the
	// negative half of each axis is the one pointing away from the viewer.
	const SIN_TILT = 0.35; // sin θ — also the equator ellipse's vertical squash
	const COS_TILT = Math.sqrt(1 - SIN_TILT * SIN_TILT);
	const AZIMUTH = (20 * Math.PI) / 180; // α — swings +x toward the viewer's lower left
	const SIN_AZ = Math.sin(AZIMUTH);
	const COS_AZ = Math.cos(AZIMUTH);

	// Reactive so the projected points follow CENTER/R when `size` changes.
	$: project = (x: number, y: number, z: number) => {
		const right = -SIN_AZ * x + COS_AZ * y;
		const up = -SIN_TILT * (COS_AZ * x + SIN_AZ * y) + COS_TILT * z;
		return { x: CENTER + right * R, y: CENTER - up * R };
	};

	$: tip = project(vector.x, vector.y, vector.z);
	$: centerPoint = project(0, 0, 0);
	// Each axis as a near half (centre → +tip, solid) and a far half (centre →
	// −tip, dashed) so the depth ordering is legible.
	$: axes = [
		{ near: project(1, 0, 0), far: project(-1, 0, 0) },
		{ near: project(0, 1, 0), far: project(0, -1, 0) },
		{ near: project(0, 0, 1), far: project(0, 0, -1) }
	];
	// Labels sit just outside the outline; >1 pushes them out, <1 pulls them in.
	const LABEL_RADIUS = 1.18;
	$: xLabel = project(LABEL_RADIUS, 0, 0);
	$: yLabel = project(0, LABEL_RADIUS, 0);
	$: zLabel = project(0, 0, LABEL_RADIUS);
	$: labelFont = Math.max(8, size * 0.06);
	$: equatorRy = R * SIN_TILT;
	$: coordText = `x=${vector.x.toFixed(2)} y=${vector.y.toFixed(2)} z=${vector.z.toFixed(2)}`;
</script>

<div class="bloch-card">
	<svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
		<circle cx={CENTER} cy={CENTER} r={R} class="sphere" />
		<ellipse cx={CENTER} cy={CENTER} rx={R} ry={equatorRy} class="equator" />

		{#each axes as axis}
			<line
				x1={centerPoint.x}
				y1={centerPoint.y}
				x2={axis.far.x}
				y2={axis.far.y}
				class="axis axis-far"
			/>
			<line
				x1={centerPoint.x}
				y1={centerPoint.y}
				x2={axis.near.x}
				y2={axis.near.y}
				class="axis"
			/>
		{/each}

		<line x1={centerPoint.x} y1={centerPoint.y} x2={tip.x} y2={tip.y} class="vector" />

		<circle cx={tip.x} cy={tip.y} r={Math.max(2.5, size * 0.02)} class="tip" />
		<circle cx={centerPoint.x} cy={centerPoint.y} r={Math.max(1.5, size * 0.016)} class="origin" />

		<!-- Labels last: the sphere's fill is opaque, so anything drawn before it
		     that falls inside the outline gets painted over. -->
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
	/* Half of each axis pointing away from the viewer. */
	.axis-far {
		stroke-dasharray: 2 3;
		opacity: 0.6;
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
