// ─────────────────────────────────────────────────────────────
// Helpers for working with rotation angles as fractions of π,
// which is how most people think about RX/RY/RZ angles
// ("a quarter turn" / π/2) instead of plain radians (1.5708...).
// Inside the app everything is still stored and calculated in radians.
// These helpers only convert when showing or reading values in the UI.
// ─────────────────────────────────────────────────────────────

const DENOMINATORS = [1, 2, 3, 4, 6, 8, 12];

/**
 * Parses a user-entered angle string into radians.
 * Accepts: "pi", "-pi", "2pi", "pi/2", "-pi/4", "3pi/4", "0.5pi",
 * or a plain number (read as radians). Returns null if it can't be read.
 */
export function parsePiInput(input: string): number | null {
	if (input == null) return null;
	const s = input.trim().toLowerCase().replace(/\s+/g, '').replace(/π/g, 'pi');
	if (s === '') return null;

	if (!s.includes('pi')) {
		const n = parseFloat(s);
		return isNaN(n) ? null : n;
	}

	const [numPart, denPart] = s.split('/');

	let coeffStr = numPart.replace('pi', '');
	if (coeffStr === '' || coeffStr === '+') coeffStr = '1';
	else if (coeffStr === '-') coeffStr = '-1';
	const coeff = parseFloat(coeffStr);
	if (isNaN(coeff)) return null;

	if (denPart === undefined) return coeff * Math.PI;

	const denom = parseFloat(denPart);
	if (isNaN(denom) || denom === 0) return null;

	return (coeff * Math.PI) / denom;
}

/**
 * Shows a radian value as a fraction of π (e.g. "π/2", "-3π/4")
 * when it is a simple fraction with a small number at the bottom.
 * Otherwise it shows the radians with 3 decimal places.
 */
export function formatRadiansAsPi(radians: number, tolerance = 1e-6): string {
	if (Math.abs(radians) < tolerance) return '0';

	const k = radians / Math.PI;

	for (const d of DENOMINATORS) {
		const n = k * d;
		const rounded = Math.round(n);
		if (rounded !== 0 && Math.abs(n - rounded) < tolerance * d) {
			const sign = rounded < 0 ? '-' : '';
			const absNum = Math.abs(rounded);
			const numStr = absNum === 1 ? '' : String(absNum);
			const denStr = d === 1 ? '' : `/${d}`;
			return `${sign}${numStr}π${denStr}`;
		}
	}

	return radians.toFixed(3);
}
