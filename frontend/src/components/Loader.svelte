<script lang="ts">
	/**
	 * The one loading mark the whole app uses.
	 *
	 * It is a phasor: a dot going round a circle at a steady rate, with its own
	 * path trailing behind it. That is what a phase does in this app, so the
	 * busiest little piece of UI still says something true. Everything else here
	 * is kept plain on purpose: one SVG, no JavaScript timer, and the colour is
	 * taken from the text around it, so it is purple on brand buttons and green
	 * in QEC mode without being told.
	 */

	// 'sm' sits inside a line of text, 'md' inside a panel, 'lg' fills a page.
	// A number is also allowed when something in between is needed.
	export let size: 'sm' | 'md' | 'lg' | number = 'sm';

	// What the wait is for, read out by screen readers: "Running the experiment".
	// Leave it empty when nearby text already says it, and the mark is then
	// hidden from screen readers instead of repeating that text.
	export let label = '';

	const SIZES = { sm: 14, md: 28, lg: 48 };
	$: px = typeof size === 'number' ? size : SIZES[size];

	// The ring is drawn at r = 9 in a 24-wide box, so its length is 2*pi*9.
	// The dashes below are lengths along that ring, not angles.
	const LENGTH = 56.55;
	const HEAD = 18;
	const TAIL = 34;
</script>

<svg
	viewBox="0 0 24 24"
	width={px}
	height={px}
	fill="none"
	class="phase-ring shrink-0"
	role={label ? 'status' : undefined}
	aria-label={label || undefined}
	aria-hidden={label ? undefined : 'true'}
>
	<!-- The path the dot travels. Faint: it is context, not the moving part. -->
	<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.4" opacity="0.18" />

	<g class="phase-ring-spin">
		<!-- Two arcs behind the dot, the longer one fainter, which reads as one
		     trail fading out. A real fade would need a gradient around a circle,
		     which SVG cannot do without a lot more code. -->
		<circle
			cx="12"
			cy="12"
			r="9"
			stroke="currentColor"
			stroke-width="2.4"
			stroke-linecap="round"
			stroke-dasharray="{TAIL} {LENGTH - TAIL}"
			stroke-dashoffset={TAIL}
			opacity="0.25"
		/>
		<circle
			cx="12"
			cy="12"
			r="9"
			stroke="currentColor"
			stroke-width="2.4"
			stroke-linecap="round"
			stroke-dasharray="{HEAD} {LENGTH - HEAD}"
			stroke-dashoffset={HEAD}
			opacity="0.75"
		/>
		<!-- The dot itself, at the leading end of the trail. -->
		<circle cx="21" cy="12" r="2.4" fill="currentColor" />
	</g>
</svg>

<style>
	.phase-ring-spin {
		transform-box: fill-box;
		transform-origin: center;
		animation: phase-ring-turn 0.9s linear infinite;
	}

	@keyframes phase-ring-turn {
		to {
			transform: rotate(360deg);
		}
	}

	/* Some people get motion sick from spinning UI, and the browser tells us so.
	   The mark then stops turning and breathes instead: still clearly "working",
	   with nothing going round. */
	@media (prefers-reduced-motion: reduce) {
		.phase-ring-spin {
			animation: phase-ring-breathe 2.2s ease-in-out infinite;
		}

		@keyframes phase-ring-breathe {
			0%,
			100% {
				opacity: 0.35;
			}
			50% {
				opacity: 1;
			}
		}
	}
</style>
