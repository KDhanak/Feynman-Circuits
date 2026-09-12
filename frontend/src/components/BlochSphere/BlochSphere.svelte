<script context="module" lang="ts">
	// SVG ids are shared across the whole page, and one page has several spheres
	// (one per wire plus the overall one), so each sphere needs its own gradient id.
	let instanceCount = 0;
</script>

<script lang="ts">
	import type { BlochVector } from '$lib/quantum/bloch';
	import Icon from '@iconify/svelte';

	export let vector: BlochVector;
	export let size = 150;
	export let showDetails = true;
	export let showAxisLabels = false;
	// Rotating the sphere is off unless it is turned on. The board draws one small
	// sphere per qubit (WireBloch). Those are just pictures, and they must not block
	// mouse or touch events meant for the wires under them.
	export let interactive = false;

	const uid = `bloch-${(instanceCount++).toString(36)}`;

	$: CENTER = size / 2;
	// The ball fills 80% of its box. The other 10% on each side is room for the
	// axis labels: they sit at LABEL_RADIUS·R, and with orthographic projection a
	// unit vector never reaches further than R on screen. So the furthest a label
	// can go, from any camera angle, is LABEL_RADIUS·R plus half its own text.
	$: R = size * 0.4;

	// Orthographic projection (a flat view with no perspective) of a unit sphere,
	// seen from height angle θ above the equator, turned by angle α around it:
	//   screen right = −sinα·x + cosα·y
	//   screen up    = −sinθ·(cosα·x + sinα·y) + cosθ·z
	// Everything drawn comes from these two angles, which is what keeps the axes,
	// the equator and the outline lined up: the equator becomes an ellipse with
	// half-widths R and |sinθ|·R (so the ±x/±y tips land exactly on it), and the
	// poles land at cosθ·R, just inside the outline, as they should.
	//
	// `right`, `up` and the view direction are three directions at right angles
	// to each other:
	//   view = right × up = (cosθ·cosα, cosθ·sinα, sinθ)
	// which points at the camera. So a point's dot product with `view` is its
	// depth, positive towards the viewer. That is what `depthOf` returns, and it
	// decides which half of each line is drawn behind the ball.
	const DEFAULT_ELEVATION = Math.asin(0.35);
	const DEFAULT_AZIMUTH = (20 * Math.PI) / 180;
	// Stop just before the poles: at exactly ±90° the turning angle stops meaning
	// anything (the equator squashes into a line) and dragging feels stuck.
	const MAX_ELEVATION = (85 * Math.PI) / 180;

	let elevation = DEFAULT_ELEVATION;
	let azimuth = DEFAULT_AZIMUTH;

	// Put into one object so the reactive statements below depend on `cam`. It is
	// the same reason `centre`/`radius` are passed in as arguments: Svelte doesn't
	// track a value that is only used inside the function body.
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

	// Each axis is split into two halves at the centre. Which half points away from
	// the camera depends on where the camera is, so we must work it out, not guess.
	// The negative half is only the far one while the camera stays in the +x+y+z
	// corner, and that is no longer true once you can rotate the sphere.
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

	// The equator is split into near and far halves where its depth becomes zero.
	// On the equator (cos t, sin t, 0) the depth is cosθ·cos(t−α) and the projection
	// is (sin(t−α), −sinθ·cos(t−α)), so the two zero points are exactly the ellipse's
	// far left and far right. So the split is always the horizontal line through the
	// middle, and the far half is the arc that bulges away from the camera: the top
	// one while the camera is above the equator, the bottom one when it is below.
	$: equatorRy = R * Math.abs(cam.sinTilt);
	$: farSweep = cam.sinTilt >= 0 ? 1 : 0;
	$: equatorFar = arcPath(CENTER, R, equatorRy, farSweep);
	$: equatorNear = arcPath(CENTER, R, equatorRy, 1 - farSweep);

	function arcPath(centre: number, rx: number, ry: number, sweep: number): string {
		return `M ${centre - rx} ${centre} A ${rx} ${ry} 0 0 ${sweep} ${centre + rx} ${centre}`;
	}

	// Kept close to proportional: a minimum size that is too big pushes the labels
	// past the edge on the smallest spheres, where there is the least room.
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
		// Dragging one sphere-width turns it 180°, so the point under the cursor
		// follows the pointer about 1:1. Both signs are chosen so the surface moves
		// with the drag: a bigger α slides things left, and a bigger θ raises the
		// camera, which pushes the north pole down.
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

	// Decides if the reset button is disabled. The turning angle has no limit (it
	// keeps growing as you spin), so we compare it after removing full turns, not
	// against the raw default. Otherwise, after spinning all the way round, the
	// button would stay on even though the view is already the default one.
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
		The sphere keeps role="img" instead of a widget role: rotating it shows
		nothing that the text below doesn't already say (the same x/y/z and |r|
		are printed exactly), so it is a picture with a handy drag gesture, not a
		control. You can still reach it with the keyboard, and its aria-label says
		so, which is what the accessibility rules are there to protect.
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
				<!-- The off-centre bright spot looks like a light shining from the top
				     left, which is what makes a flat circle look like a ball. The light
				     stays in the same place on screen while the camera turns, like it would in a room. -->
				<radialGradient id="{uid}-shade" cx="50%" cy="50%" r="50%" fx="32%" fy="28%">
					<stop offset="0%" stop-color="var(--color-surface)" stop-opacity="0.62" />
					<stop offset="55%" stop-color="var(--color-surface)" stop-opacity="0.45" />
					<stop offset="100%" stop-color="var(--color-secondary-2)" stop-opacity="0.4" />
				</radialGradient>
			</defs>

			<!-- Painter's algorithm (draw from back to front). Everything on the far side of
			     the ball is drawn first, so the see-through shell fades it. That is what
			     shows depth. Near-side lines are drawn on top of the shell at full strength. -->
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

			<!-- The ball: a shaded, see-through shell over the far-side lines. -->
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

			<!-- Labels go last: they sit outside the outline so nothing covers them,
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
			<!-- Placed in the empty top-right corner: the ball only reaches 35% of the
			     box, and the axis labels sit on the axes, never on the diagonal. -->
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
		<!-- One line instead of two: the row this is in has limited height,
		     and the saved line gives the ball more room. -->
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
	/* An `outline` on an SVG element is always drawn as a rectangle
	   (`border-radius` does not round it), so a focus ring here would draw a
	   square box over the sphere. So focus is shown on the outline circle
	   instead, which is already round.

	   The circle is NOT called `.outline` on purpose: that is a Tailwind v4
	   utility class (`outline-style: solid; outline-width: 1px`), and the global
	   Tailwind rule matched the class as well as our scoped one, which drew a
	   black rectangle around the ball. Scoped styles do not protect a component
	   from clashing with utility class names. Only using a name that Tailwind
	   does not use does. */
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
	/* Everything on the far side of the ball: dashed and dimmed, on top of the
	   fading that the see-through shell already adds. */
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
