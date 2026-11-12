<script context="module" lang="ts">
	// Each sphere on the page needs its own SVG gradient id.
	let instanceCount = 0;
</script>

<script lang="ts">
	import Icon from '@iconify/svelte';
	import type { Complex } from '$lib/quantum/complex';
	import { phaseColor, qspherePoints, type QSpherePoint } from '$lib/quantum/qsphere';
	import {
		DEFAULT_AZIMUTH,
		DEFAULT_ELEVATION,
		MAX_ELEVATION,
		camera,
		depthOf,
		latitudeArcs,
		project
	} from '$lib/quantum/sphereView';
	import { basisLabel } from '$lib/circuit/steps';
	import type { BitOrder } from '$lib/stores/settingsStore';
	import { formatRadiansAsPi } from '$lib/utils/piMath';

	/**
	 * The Q-sphere: the whole state of the register on one sphere, one dot per
	 * basis state (see qsphere.ts for where each dot goes). Dot size is the
	 * probability and dot colour is the phase. It turns like the Bloch sphere:
	 * drag it, use the arrow keys, or double-click to reset.
	 */
	export let state: Complex[];
	export let size = 240;
	export let bitOrder: BitOrder = 'q0-right';

	const uid = `qsphere-${(instanceCount++).toString(36)}`;

	$: n = Math.round(Math.log2(state.length));
	$: CENTER = size / 2;
	// Same ball size as the Bloch sphere, which leaves room round it for labels.
	$: R = size * 0.4;

	let elevation = DEFAULT_ELEVATION;
	let azimuth = DEFAULT_AZIMUTH;
	$: cam = camera(elevation, azimuth);

	$: points = qspherePoints(state);
	// Each label sits just outside its dot. With many dots, only the most likely
	// ones get a label, or the labels would cover each other.
	const MAX_LABELS = 12;
	$: labelled = new Set(
		[...points]
			.sort((a, b) => b.probability - a.probability)
			.slice(0, MAX_LABELS)
			.map((p) => p.index)
	);

	// Where a dot's label goes: past the dot, away from the centre of the
	// picture. A dot at a pole is seen almost head-on, close to the centre, so
	// "away from the centre" means little there; it goes above the north pole
	// and below the south pole instead.
	function labelSpot(at: { x: number; y: number }, z: number, dotR: number, chars: number) {
		let dx = at.x - CENTER;
		let dy = at.y - CENTER;
		const len = Math.hypot(dx, dy);
		if (len < R * 0.3) {
			dx = 0;
			dy = z >= 0 ? -1 : 1;
		} else {
			dx /= len;
			dy /= len;
		}
		const font = Math.max(7, size * 0.045);
		const gap = dotR + font * 0.9;
		// Text is wider than it is tall, so push further sideways than up or down.
		const x = at.x + dx * gap * 1.6;
		const y = at.y + dy * gap;
		// Keep the whole label inside the picture. A monospace character is
		// about 0.6 of the font size wide.
		const half = (chars * font * 0.6) / 2 + 2;
		return {
			x: Math.max(half, Math.min(size - half, x)),
			y: Math.max(font / 2 + 1, Math.min(size - font / 2 - 1, y))
		};
	}

	$: drawn = points
		.map((p) => {
			const at = project(p.x, p.y, p.z, CENTER, R, cam);
			// Area grows with probability, so the radius grows with its square root.
			const r = size * (0.012 + 0.045 * Math.sqrt(p.probability));
			const label = `|${basisLabel(p.index, n, bitOrder)}⟩`;
			return {
				p,
				at,
				r,
				labelAt: labelSpot(at, p.z, r, label.length),
				depth: depthOf(p.x, p.y, p.z, cam),
				color: phaseColor(p.phase),
				label
			};
		})
		// Painter's algorithm: the furthest dot first, so nearer dots cover it.
		.sort((a, b) => a.depth - b.depth);
	$: behind = drawn.filter((d) => d.depth < 0);
	$: inFront = drawn.filter((d) => d.depth >= 0);

	$: centerPoint = project(0, 0, 0, CENTER, R, cam);
	// One faint ring per number of 1s, at the height where those states sit.
	$: rings = Array.from({ length: n + 1 }, (_, w) => 1 - (2 * w) / n)
		.filter((z) => Math.abs(z) < 1)
		.map((z) => latitudeArcs(z, CENTER, R, cam));
	$: poles = [1, -1].map((z) => ({
		z,
		at: project(0, 0, z, CENTER, R, cam),
		behind: depthOf(0, 0, z, cam) < 0
	}));

	$: labelFont = Math.max(7, size * 0.045);

	// The dot under the pointer, or the most likely state when there is none.
	let hovered: number | null = null;
	$: shown =
		points.find((p) => p.index === hovered) ??
		points.reduce<QSpherePoint | null>(
			(best, p) => (!best || p.probability > best.probability + 1e-12 ? p : best),
			null
		);
	$: readout = shown
		? `|${basisLabel(shown.index, n, bitOrder)}⟩  ${(shown.probability * 100).toFixed(1)}%  phase ${formatRadiansAsPi(shown.phase, 1e-3)}`
		: '';

	// The phase legend: a small colour wheel. 0 is on the right and the phase
	// grows anticlockwise, as angles do in maths. CSS conic gradients run
	// clockwise from the start angle, so the stops go the other way round.
	const wheel = `conic-gradient(from 90deg, ${Array.from(
		{ length: 13 },
		(_, k) => `${phaseColor((-k * Math.PI) / 6)} ${k * 30}deg`
	).join(', ')})`;

	// ── Turning the sphere (the same controls as the Bloch sphere) ───────
	let dragging = false;
	let lastX = 0;
	let lastY = 0;

	function clamp(v: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, v));
	}

	function startDrag(e: PointerEvent) {
		dragging = true;
		lastX = e.clientX;
		lastY = e.clientY;
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		e.preventDefault();
	}

	function onDrag(e: PointerEvent) {
		if (!dragging) return;
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
		elevation = DEFAULT_ELEVATION;
		azimuth = DEFAULT_AZIMUTH;
	}

	const TAU = Math.PI * 2;
	$: azimuthOffset = (((azimuth - DEFAULT_AZIMUTH) % TAU) + TAU) % TAU;
	$: cameraMoved =
		Math.abs(elevation - DEFAULT_ELEVATION) > 1e-6 ||
		Math.min(azimuthOffset, TAU - azimuthOffset) > 1e-6;

	function onKey(e: KeyboardEvent) {
		const STEP = Math.PI / 24;
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

	$: ariaLabel = `Q-sphere of ${n} qubits with ${points.length} state${points.length === 1 ? '' : 's'}: ${[
		...points
	]
		.sort((a, b) => b.probability - a.probability)
		.slice(0, 8)
		.map(
			(p) =>
				`${basisLabel(p.index, n, bitOrder)} at ${(p.probability * 100).toFixed(1)} percent, phase ${formatRadiansAsPi(p.phase, 1e-3)}`
		)
		.join('; ')}. Drag or use the arrow keys to rotate the view.`;
</script>

{#snippet dot(d: (typeof drawn)[number])}
	<line
		x1={centerPoint.x}
		y1={centerPoint.y}
		x2={d.at.x}
		y2={d.at.y}
		stroke={d.color}
		class="stem"
	/>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<g
		class="state-dot"
		on:pointerenter={() => (hovered = d.p.index)}
		on:pointerleave={() => (hovered = null)}
	>
		<title
			>{d.label} · {(d.p.probability * 100).toFixed(1)}% · phase {formatRadiansAsPi(
				d.p.phase,
				1e-3
			)}</title
		>
		<circle cx={d.at.x} cy={d.at.y} r={d.r} fill={d.color} class:hovered={hovered === d.p.index} />
	</g>
{/snippet}

<div class="qsphere-card">
	<div class="sphere-wrap">
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_no_noninteractive_tabindex -->
		<svg
			viewBox={`0 0 ${size} ${size}`}
			width={size}
			height={size}
			role="img"
			aria-label={ariaLabel}
			tabindex="0"
			class:dragging
			on:pointerdown={startDrag}
			on:pointermove={onDrag}
			on:pointerup={endDrag}
			on:pointercancel={endDrag}
			on:dblclick={resetCamera}
			on:keydown={onKey}
		>
			<defs>
				<radialGradient id="{uid}-shade" cx="50%" cy="50%" r="50%" fx="32%" fy="28%">
					<stop offset="0%" stop-color="var(--color-sphere-core)" stop-opacity="0.5" />
					<stop offset="55%" stop-color="var(--color-sphere-core)" stop-opacity="0.35" />
					<stop offset="100%" stop-color="var(--color-secondary-2)" stop-opacity="0.15" />
				</radialGradient>
			</defs>

			<!-- Far side first, so the see-through shell fades it. -->
			<g class="behind">
				{#each rings as ring (ring.z)}
					<path d={ring.far} class="ring" />
				{/each}
			</g>
			<!-- Dots behind the ball are faded less than the rings: they are the data. -->
			<g class="behind-dots">
				{#each behind as d (d.p.index)}
					{@render dot(d)}
				{/each}
			</g>

			<circle cx={CENTER} cy={CENTER} r={R} fill="url(#{uid}-shade)" />
			<circle cx={CENTER} cy={CENTER} r={R} class="silhouette" />

			{#each rings as ring (ring.z)}
				<path d={ring.near} class="ring" />
			{/each}
			{#each poles as pole (pole.z)}
				<circle
					cx={pole.at.x}
					cy={pole.at.y}
					r={Math.max(1.5, size * 0.008)}
					class="pole"
					class:behind={pole.behind}
				/>
			{/each}
			<circle
				cx={centerPoint.x}
				cy={centerPoint.y}
				r={Math.max(1.5, size * 0.012)}
				class="origin"
			/>
			{#each inFront as d (d.p.index)}
				{@render dot(d)}
			{/each}

			<!-- Labels last, so no dot covers them. -->
			{#each drawn.filter((d) => labelled.has(d.p.index)) as d (d.p.index)}
				<text
					x={d.labelAt.x}
					y={d.labelAt.y}
					font-size={labelFont}
					text-anchor="middle"
					dominant-baseline="middle"
					class="state-label"
					class:behind={d.depth < 0}>{d.label}</text
				>
			{/each}
		</svg>

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

		<div class="phase-legend" aria-hidden="true">
			<div class="wheel" style="background: {wheel}"></div>
			<span class="tick right">0</span>
			<span class="tick top">π/2</span>
			<span class="tick left">π</span>
			<span class="tick bottom">-π/2</span>
		</div>
	</div>

	<div class="readout">{readout}</div>
</div>

<style>
	.qsphere-card {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.sphere-wrap {
		position: relative;
		line-height: 0;
	}
	svg {
		outline: none;
		cursor: grab;
		/* Without this a vertical drag scrolls the page on touch instead of turning the sphere. */
		touch-action: none;
	}
	svg.dragging {
		cursor: grabbing;
	}
	svg:focus-visible .silhouette {
		stroke: var(--color-ternary-1);
		stroke-width: 3;
	}
	.silhouette {
		fill: none;
		stroke: color-mix(in srgb, var(--color-secondary-2) 55%, var(--color-border-strong));
		stroke-width: 1.5;
	}
	.ring {
		fill: none;
		stroke: var(--color-subtle);
		stroke-width: 1;
		stroke-dasharray: 3 3;
		opacity: 0.7;
	}
	.behind {
		opacity: 0.5;
	}
	.behind-dots {
		opacity: 0.8;
	}
	.pole,
	.origin {
		fill: var(--color-line);
	}
	.pole.behind {
		opacity: 0.4;
	}
	.stem {
		stroke-width: 1.5;
		stroke-linecap: round;
		opacity: 0.85;
	}
	.state-dot circle {
		stroke: var(--color-surface);
		stroke-width: 1;
		transition: r 0.15s;
	}
	.state-dot circle.hovered {
		stroke: var(--color-text);
		stroke-width: 1.5;
	}
	.state-label {
		fill: var(--color-text);
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-weight: 600;
		pointer-events: none;
	}
	text.state-label.behind {
		opacity: 0.5;
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
	/* The phase wheel sits in the bottom-left corner, which the ball leaves empty. */
	.phase-legend {
		position: absolute;
		left: 14px;
		bottom: 14px;
		width: 26px;
		height: 26px;
		line-height: 1;
	}
	.wheel {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		/* A hole in the middle turns the disc into a ring. */
		mask: radial-gradient(circle, transparent 38%, #000 40%);
	}
	.tick {
		position: absolute;
		font-size: 0.55rem;
		color: var(--color-muted);
		white-space: nowrap;
	}
	.tick.right {
		left: 100%;
		top: 50%;
		transform: translate(3px, -50%);
	}
	.tick.left {
		right: 100%;
		top: 50%;
		transform: translate(-3px, -50%);
	}
	.tick.top {
		bottom: 100%;
		left: 50%;
		transform: translate(-50%, -2px);
	}
	.tick.bottom {
		top: 100%;
		left: 50%;
		transform: translate(-50%, 2px);
	}
	.readout {
		font-size: 0.75rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		color: var(--color-text);
		white-space: pre;
		min-height: 1.2em;
	}
</style>
