/**
 * The product tour: five coach marks covering where things are and what this
 * editor does that a notebook doesn't.
 *
 * It has to land for two very different readers — someone who already knows what
 * a Hadamard does and is asking "is this worth switching to?", and someone who
 * has never seen a circuit. So each step sells an affordance rather than
 * teaching a concept, and points at the `i` tooltips for the physics. That keeps
 * it honest for the newcomer without wasting the expert's time.
 */

export type TourStep = {
	id: string;
	/** CSS selector for the element to spotlight. */
	anchor: string;
	title: string;
	body: string;
	/**
	 * Skip silently when the anchor isn't in the DOM. The code panel is hidden on
	 * mobile and in left-dock mode it moves, so steps must tolerate absence
	 * rather than stranding the user on a step that can't render.
	 */
	optional?: boolean;
};

export const TOUR_STEPS: TourStep[] = [
	{
		id: 'palette',
		anchor: '[data-tour="palette"]',
		title: 'Every gate, one row',
		body: 'Drag a gate onto a wire, or double-click it to drop it in the next free column. Every tile carries an `i` that explains what the gate does, so you can build a circuit without looking anything up.'
	},
	{
		id: 'board',
		anchor: '[data-tour="board"]',
		title: 'The board is the source of truth',
		body: 'Drag to box-select, Delete to remove, right-click for reset and copy. CONTROL and ANTI-CONTROL are separate tiles — drop one in the same column as a gate to condition it, so any gate becomes controlled without a special CX tile.'
	},
	{
		id: 'results',
		anchor: '[data-tour="results"]',
		title: 'No Run button — that is the point',
		body: 'The statevector re-simulates on every edit, so amplitudes and probabilities update as you drag — nothing to run, and no way to be looking at a stale result. Shown in Dirac notation with polar form; Settings has a bit-order toggle if you prefer q0 on the left to the Qiskit convention.'
	},
	{
		id: 'code',
		anchor: '[data-tour="code"]',
		title: 'Round-trips to Qiskit and QASM',
		body: 'The circuit exports as OpenQASM 2.0/3.0 or Qiskit Python, and imports back from either — so you can prototype here and drop the result straight into an existing notebook. Drag this panel to the left dock in Settings when you are reading code more than building.',
		optional: true
	},
	{
		id: 'save',
		anchor: '[data-tour="save"]',
		title: 'Save, and you are done',
		body: 'Sign in and circuits sync to your account with auto-save while you edit. That is the whole tour — the `?` beside the theme toggle brings it back any time.'
	}
];
