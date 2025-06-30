<script>
	import { circuit, toggleMode } from '$lib/stores';
	import { resetCircuit } from '$lib/simulator';

	let id = 'toggle';
	let labelOn = "|𝛙<sub class='text-ternary-1'>n</sub>⟩";
	let labelOff = '|𝛙⟩';

	$: checked = $circuit.numQubits > 1;

	function handleToggle() {
		toggleMode(2);
		resetCircuit();
	}
</script>

<label for={id} class="inline-flex items-center cursor-pointer">
	<input type="checkbox" {id} bind:checked class="sr-only peer" on:change={handleToggle} />
	<div
		class="relative w-11 h-6 border border-secondary-2 peer-checked:border-ternary-1 peer-checked:bg-secondary-4 bg-secondary-1 peer-focus:outline-none rounded-full peer-checked:after:translate-x-full after:absolute after:top-[1px] after:start-[2px] after:rounded-full after:h-5 after:w-5 after:transition-all after:bg-secondary-4 after:border after:border-secondary-3 peer-checked:after:border-secondary-3 peer-checked:after:bg-secondary-1"
	></div>
	<span class="ms-3 text-sm font-medium text-secondary-1 min-w-[50px]">
		{@html checked ? labelOn : labelOff}
	</span>
</label>
