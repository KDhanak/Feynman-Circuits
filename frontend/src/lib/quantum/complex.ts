export interface Complex {
    re: number;
    im: number;
}

export function createComplex(re: number, im: number): Complex {
    return { re, im };
}

export function conjugate(z: Complex): Complex {
    return { re: z.re, im: -z.im };
}

export function magnitude(z: Complex): number {
    return Math.sqrt(z.re * z.re + z.im * z.im);
}

export function magnitudeSquared(z: Complex): number {
    return z.re * z.re + z.im * z.im;
}

export function add(z1: Complex, z2: Complex): Complex {
    return { re: z1.re + z2.re, im: z1.im + z2.im };
}

export function multiply(z1: Complex, z2: Complex): Complex {
    return {
        re: z1.re * z2.re - z1.im * z2.im,
        im: z1.re * z2.im + z1.im * z2.re,
    };
}

export function scale(z: Complex, scalar: number): Complex {
    return { re: z.re * scalar, im: z.im * scalar };
}

export function formatComplex({ re, im }: Complex): string {
    if (re === 0 && im === 0) {
        return '0';
    }

    let result = '';
    if (re !== 0) {
        result += re.toFixed(2);
    }

    if (im !== 0) {
        if (im === 1) {
            // Just "i"
            result += (re === 0 ? '' : im < 0 ? ' - ' : ' + ') + 'i';
        } else if (im === -1) {
            // Just "-i"
            result += (re === 0 ? '-' : ' - ') + 'i';
        } else {
            // General case, e.g., "2i" or "-3i"
            const imPart = Math.abs(im) + 'i';
            result += (re === 0 ? (im < 0 ? '-' : '') : im < 0 ? ' - ' : ' + ') + imPart;
        }
    }

    return result || '0'; // Fallback if both parts are 0
}

// Format the quantum state as α|0⟩ + β|1⟩
export function formatQuantumState(state: Complex[]): string {
	const alpha = formatComplex(state[0]);
	const beta = formatComplex(state[1]);

	if (alpha === '0' && beta === '0') return '0';
	if (alpha === '0') return `${beta}|1⟩`;
	if (beta === '0') return `${alpha}|0⟩`;

	const betaSign = state[1].re < 0 || state[1].im < 0 ? '' : '+';
	return `${alpha}|0⟩ ${betaSign}${beta}|1⟩`;
}

// Format the quantum state in polar form to highlight phase shifts
export function formatQuantumStatePolar(state: Complex[]): string {
	const getPolar = ({ re, im }: Complex) => {
		const magnitude = Math.sqrt(re * re + im * im);
		const phase = Math.atan2(im, re); // Phase in radians
		return { magnitude: magnitude.toFixed(2), phase: (phase * 180 / Math.PI).toFixed(2) }; // Phase in degrees
	};

	const alphaPolar = getPolar(state[0]);
	const betaPolar = getPolar(state[1]);

	return `|0⟩: ${alphaPolar.magnitude}e^(i * ${alphaPolar.phase}°), |1⟩: ${betaPolar.magnitude}e^(i * ${betaPolar.phase}°)`
}
