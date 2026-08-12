<script context="module" lang="ts">
	// SVG ids are document-global and several spheres share one page (one per
	// wire plus the overall one), so each instance needs its own gradient id.
	let instanceCount = 0;
</script>

<script lang="ts">
	import type { BlochVector } from '$lib/quantum/bloch';
	import Icon from '@iconify/svelte';

	export let vector: BlochVector;
	export let size = 150;
	export let showDetails = true;
	export let showAxisLabels = false;
	// Orbit control is opt-in. The board renders one small sphere per qubit
	// (WireBloch); those are static decorations that must not swallow pointer
	// events meant for the wires underneath.
	export let interactive = false;

	const uid = `bloch-${(instanceCount++).toString(36)}`;

	$: CENTER = size / 2;
	// The ball fills 80% of its box. The remaining 10% a side is what the axis
	// labels need: they sit at LABEL_RADIUS·R, and orthographic projection caps a
	// unit vector's on-screen reach at exactly R, so the furthest a label can
	// travel at any camera angle is LABEL_RADIUS·R + half its own text.
	$: R = size * 0.4;

	// Orthographic projection of a unit sphere seen from elevation θ above the
	// equatorial plane, at azimuth α around it:
	//   screen right = −sinα·x + cosα·y
	//   screen up    = −sinθ·(cosα·x + sinα·y) + cosθ·z
	// Every mark is derived from these two angles, which is what keeps the axes,
	// the equator and the outline in agreement: the equator projects to an ellipse
	// with semi-axes R and |sinθ|·R (so the ±x/±y tips land exactly on it), and the
	// poles land at cosθ·R — just inside the outline, as orthographic projection
	// of a sphere requires.
	//
	// `right` and `up` complete an orthonormal frame with the view direction
	//   view = right × up = (cosθ·cosα, cosθ·sinα, sinθ)
	// which points at the camera. A point's dot product with `view` is therefore
	// its depth, positive toward the viewer — that is what `depthOf` returns and
	// what decides which half of every mark is drawn behind the ball.
	const DEFAULT_ELEVATION = Math.asin(0.35);
	const DEFAULT_AZIMUTH = (20 * Math.PI) / 180;
	// Stop just shy of the poles: at exactly ±90° the azimuth becomes degenerate
	// (the equator collapses to a line) and dragging feels stuck.
	const MAX_ELEVATION = (85 * Math.PI) / 180;

	let elevation = DEFAULT_ELEVATION;
	let azimuth = DEFAULT_AZIMUTH;

	// Bundled into one object so the reactive statements below list `cam` as a
	// dependency — same reason `centre`/`radius` are passed in rather than closed
	// over: a value only referenced inside the function body wouldn't be tracked.
	$: cam = {
		sinTilt: Math.sin(elevation),
		cosTilt: Math.cos(elevation),
		sinAz: Math.sin(azimuth),
		cosAz: Math.cos(azimuth)
	};
	type Camera = typeof cam;

	// Labels sit just outside the silhouette; >1 pushes them out, <1 pulls them in.
	const LABEL_RADIUS = 1.12;

	const AXES = [
		{ name: 'x', dir: [1, 0, 0] },
		{ name: 'y', dir: [0, 1, 0] },
		{ name: 'z', dir: [0, 0, 1] }
	] as const;

	function clamp(n: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, n));
	}

	function project(x: number, y: number, z: number, centre: number, radius: number, c: Camera) {
		const right = -c.sinAz * x + c.cosAz * y;
		const up = -c.sinTilt * (c.cosAz * x + c.sinAz * y) + c.cosTilt * z;
		return { x: centre + right * radius, y: centre - up * radius };
	}

	function depthOf(x: number, y: number, z: number, c: Camera): number {
		return c.cosTilt * (c.cosAz * x + c.sinAz * y) + c.sinTilt * z;
	}

	$: tip = project(vector.x, vector.y, vector.z, CENTER, R, cam);
	$: centerPoint = project(0, 0, 0, CENTER, R, cam);
	$: vectorBehind = depthOf(vector.x, vector.y, vector.z, cam) < 0;

	// Each axis splits into two halves at the origin. Which half points away from
	// the camera depends on where the camera is, so it has to be computed rather
	// than assumed — the negative half is only the far one while the camera stays
	// in the +x+y+z octant, which it no longer does once you can orbit it.
	$: axisHalves = AXES.flatMap(({ name, dir }) =>
		[1, -1].map((sign) => {
			const [x, y, z] = [dir[0] * sign, dir[1] * sign, dir[2] * sign];
			return {
				key: `${name}${sign > 0 ? '+' : '-'}`,
				end: project(x, y, z, CENTER, R, cam),
				behind: depthOf(x, y, z, cam) < 0
			};
		})
	);

	$: axisLabels = AXES.map(({ name, dir }) => ({
		name,
		at: project(
			dir[0] * LABEL_RADIUS,
			dir[1] * LABEL_RADIUS,
			dir[2] * LABEL_RADIUS,
			CENTER,
			R,
			cam
		),
		behind: depthOf(dir[0], dir[1], dir[2], cam) < 0
	}));

	// The equator's near/far split happens where its depth crosses zero. On the
	// equator (cos t, sin t, 0) the depth is cosθ·cos(t−α) and the projection is
	// (sin(t−α), −sinθ·cos(t−α)), so the two zero-crossings are exactly the
	// ellipse's left and right extremes — the split is always the horizontal
	// diameter, and the far half is whichever arc bulges away from the camera:
	// the upper one while the camera is above the equatorial plane, lower below.
	$: equatorRy = R * Math.abs(cam.sinTilt);
	$: farSweep = cam.sinTilt >= 0 ? 1 : 0;
	$: equatorFar = arcPath(CENTER, R, equatorRy, farSweep);
	$: equatorNear = arcPath(CENTER, R, equatorRy, 1 - farSweep);

	function arcPath(centre: number, rx: number, ry: number, sweep: number): string {
		return `M ${centre - rx} ${centre} A ${rx} ${ry} 0 0 ${sweep} ${centre + rx} ${centre}`;
	}

	// Kept close to proportional: a fixed floor that is too high is what pushes
	// labels past the edge on the smallest spheres, where the margin is tightest.
	$: labelFont = Math.max(7, size * 0.055);
	$: coordText = `x=${vector.x.toFixed(2)} y=${vector.y.toFixed(2)} z=${vector.z.toFixed(2)}`;

	// ── Orbit control ────────────────────────────────────────────────────
	let dragging = false;
	let lastX = 0;
	let lastY = 0;

	function startDrag(e: PointerEvent) {
		if (!interactive) return;
		dragging = true;
		lastX = e.clientX;
		lastY = e.clientY;
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		e.preventDefault();
	}

	function onDrag(e: PointerEvent) {
		if (!dragging) return;
		// One sphere-width of travel sweeps 180°, so the point under the cursor
		// tracks the pointer roughly 1:1. Both signs are chosen so the surface
		// follows the drag: increasing α slides world features left, and
		// increasing θ lifts the camera, which pushes the north pole down.
		const perPx = Math.PI / Math.max(1, size);
		azimuth -= (e.clientX - lastX) * perPx;
		elevation = clamp(elevation + (e.clientY - lastY) * perPx, -MAX_ELEVATION, MAX_ELEVATION);
		lastX = e.clientX;
		lastY = e.clientY;
	}

	function endDrag(e: PointerEvent) {
		if (!dragging) return;
		dragging = false;
		try {
			(e.currentTarget as Element).releasePointerCapture(e.pointerId);
		} catch {
			/* pointer may already be released */
		}
	}

	function resetCamera() {
		if (!interactive) return;
		elevation = DEFAULT_ELEVATION;
		azimuth = DEFAULT_AZIMUTH;
	}

	// Drives the reset button's disabled state. Azimuth is unbounded (it keeps
	// accumulating as you spin), so compare it modulo a full turn rather than
	// against the raw default — otherwise spinning back round leaves the button
	// live at a view that is already the default one.
	const TAU = Math.PI * 2;
	$: azimuthOffset = (((azimuth - DEFAULT_AZIMUTH) % TAU) + TAU) % TAU;
	$: cameraMoved =
		Math.abs(elevation - DEFAULT_ELEVATION) > 1e-6 ||
		Math.min(azimuthOffset, TAU - azimuthOffset) > 1e-6;

	function onKey(e: KeyboardEvent) {
		if (!interactive) return;
		const STEP = Math.PI / 24; // 7.5°
		if (e.key === 'ArrowLeft') azimuth += STEP;
		else if (e.key === 'ArrowRight') azimuth -= STEP;
		else if (e.key === 'ArrowUp')
			elevation = clamp(elevation - STEP, -MAX_ELEVATION, MAX_ELEVATION);
		else if (e.key === 'ArrowDown')
			elevation = clamp(elevation + STEP, -MAX_ELEVATION, MAX_ELEVATION);
		else if (e.key === 'Home') resetCamera();
		else return;
		e.preventDefault();
	}
</script>

<div class="bloch-card">
	<div class="sphere-wrap">
		<!--
		The sphere stays role="img" rather than claiming a widget role: rotating it
		conveys nothing the text below doesn't already state (the same x/y/z and
		|r| are printed verbatim), so it is a graphic with a convenience gesture,
		not a control. It is still reachable by keyboard with an aria-label that
		says so, which is what the interaction rules are protecting.
	-->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_no_noninteractive_tabindex -->
		<svg
			viewBox={`0 0 ${size} ${size}`}
			width={size}
			height={size}
			role="img"
			aria-label={interactive
				? 'Bloch sphere. Drag or use the arrow keys to rotate the view.'
				: 'Bloch sphere'}
			tabindex={interactive ? 0 : -1}
			class:interactive
			class:dragging
			on:pointerdown={startDrag}
			on:pointermove={onDrag}
			on:pointerup={endDrag}
			on:pointercancel={endDrag}
			on:dblclick={resetCamera}
			on:keydown={onKey}
		>
			<defs>
				<!-- Off-centre focal point reads as a light source above and to the
			     left, which is what turns a flat disc into a ball. The light stays
			     put in screen space while the camera orbits, as it would in a room. -->
				<radialGradient id="{uid}-shade" cx="50%" cy="50%" r="50%" fx="32%" fy="28%">
					<stop offset="0%" stop-color="var(--color-surface)" stop-opacity="0.62" />
					<stop offset="55%" stop-color="var(--color-surface)" stop-opacity="0.45" />
					<stop offset="100%" stop-color="var(--color-secondary-2)" stop-opacity="0.4" />
				</radialGradient>
			</defs>

			<!-- Painter's algorithm. Everything on the far side of the ball is drawn
		     first so the translucent shell washes it out, which is what makes the
		     depth read; near-side marks go on top of the shell at full strength. -->
			<g class="behind">
				{#each axisHalves.filter((a) => a.behind) as axis (axis.key)}
					<line
						x1={centerPoint.x}
						y1={centerPoint.y}
						x2={axis.end.x}
						y2={axis.end.y}
						class="axis"
					/>
				{/each}
				<path d={equatorFar} class="equator" />
				{#if vectorBehind}
					<line x1={centerPoint.x} y1={centerPoint.y} x2={tip.x} y2={tip.y} class="vector" />
					<circle cx={tip.x} cy={tip.y} r={Math.max(2.5, size * 0.02)} class="tip" />
				{/if}
			</g>

			<!-- The ball: a shaded, translucent shell over the far-side marks. -->
			<circle cx={CENTER} cy={CENTER} r={R} fill="url(#{uid}-shade)" />
			<circle cx={CENTER} cy={CENTER} r={R} class="silhouette" />

			<!-- Near side -->
			{#each axisHalves.filter((a) => !a.behind) as axis (axis.key)}
				<line x1={centerPoint.x} y1={centerPoint.y} x2={axis.end.x} y2={axis.end.y} class="axis" />
			{/each}
			<path d={equatorNear} class="equator" />
			<circle
				cx={centerPoint.x}
				cy={centerPoint.y}
				r={Math.max(1.5, size * 0.016)}
				class="origin"
			/>
			{#if !vectorBehind}
				<line x1={centerPoint.x} y1={centerPoint.y} x2={tip.x} y2={tip.y} class="vector" />
				<circle cx={tip.x} cy={tip.y} r={Math.max(2.5, size * 0.02)} class="tip" />
			{/if}

			<!-- Labels last: they sit outside the outline so nothing occludes them,
		     but the ones on the far side are dimmed to match their axis. -->
			{#if showAxisLabels}
				{#each axisLabels as label (label.name)}
					<text
						x={label.at.x}
						y={label.at.y}
						font-size={labelFont}
						text-anchor="middle"
						dominant-baseline="middle"
						class="axis-label"
						class:behind={label.behind}>+{label.name}</text
					>
				{/each}
			{/if}
		</svg>
		{#if interactive}
			<!-- Sits in the empty top-right corner: the ball only reaches 35% of the
			     box and the axis labels land on the axes, never the diagonal. -->
			<button
				type="button"
				class="reset-btn"
				on:click={resetCamera}
				disabled={!cameraMoved}
				title="Reset the view to its default angle"
				aria-label="Reset sphere orientation"
			>
				<Icon icon="ph:arrow-counter-clockwise-bold" width="14" height="14" />
			</button>
		{/if}
	</div>

	{#if showDetails}
		<!-- One line rather than two: the row this sits in is height-constrained,
		     and the reclaimed line goes to the ball. -->
		<div class="readout">
			{coordText}<span class="purity">|r|={vector.magnitude.toFixed(2)}</span>
		</div>
	{/if}
</div>

<style>
	.bloch-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		background: transparent;
	}
	.sphere-wrap {
		position: relative;
		line-height: 0;
	}
	svg {
		outline: none;
	}
	.reset-btn {
		position: absolute;
		top: 0;
		right: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4px;
		border-radius: 4px;
		border: none;
		background: transparent;
		color: var(--color-muted);
		cursor: pointer;
		opacity: 0.65;
		transition:
			opacity 0.15s,
			color 0.15s;
	}
	.reset-btn:hover:not(:disabled) {
		opacity: 1;
		color: var(--color-ternary-1);
	}
	.reset-btn:disabled {
		opacity: 0.25;
		cursor: default;
	}
	.reset-btn:focus-visible {
		outline: 2px solid var(--color-ternary-1);
		outline-offset: 1px;
	}
	svg.interactive {
		cursor: grab;
		/* Without this a vertical drag scrolls the page on touch instead of
		   rotating the sphere. */
		touch-action: none;
	}
	svg.interactive.dragging {
		cursor: grabbing;
	}
	/* An `outline` on an SVG element always paints as a rectangle — `border-radius`
	   does not clip it — so a focus ring here draws a square box across the sphere.
	   Focus is shown on the silhouette circle instead, which is already round.

	   The circle is deliberately NOT called `.outline`: that is a Tailwind v4
	   utility (`outline-style: solid; outline-width: 1px`), and the global rule
	   matched the class alongside the scoped one, boxing the ball in a black
	   rectangle. Scoped styles do not shield a component from utility-class
	   collisions — only a name Tailwind does not claim does. */
	svg.interactive:focus-visible .silhouette {
		stroke: var(--color-ternary-1);
		stroke-width: 3;
	}
	.silhouette {
		fill: none;
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
	/* Everything on the far side of the ball, dashed and dimmed on top of the
	   wash the translucent shell already applies. */
	.behind {
		opacity: 0.55;
	}
	.behind .axis,
	.behind .equator {
		stroke-dasharray: 2 3;
	}
	.readout {
		font-size: 0.75rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		color: var(--color-text);
		white-space: nowrap;
	}
	.purity {
		margin-left: 0.6em;
	}
	.axis-label {
		fill: var(--color-line);
		font-weight: 700;
		pointer-events: none;
	}
	text.axis-label.behind {
		opacity: 0.45;
	}
</style>
