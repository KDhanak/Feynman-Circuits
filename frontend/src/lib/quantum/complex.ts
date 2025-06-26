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
        return '(0)';
    }

    let result = '';

    if (re !== 0) {
        result += re.toFixed(2);
    }

    if (im !== 0) {
        if (im === 1) {
            result += (re === 0 ? '' : ' + ') + 'i';
        } else if (im === -1) {
            result += (re === 0 ? '-' : ' - ') + 'i';
        } else {
            const imPart = Math.abs(im).toFixed(2) + 'i';
            result += (re === 0 ? (im < 0 ? '-' : '') : im < 0 ? ' - ' : ' + ') + imPart;
        }
    }

    return `(${result})`; // Always wrap in brackets
}

// Format the quantum state as α|0⟩ + β|1⟩
export function formatQuantumState(state: Complex[]): string {
    const numQubits = Math.log2(state.length);

    return state
        .map((amplitude, index) => {
            const formatted = formatComplex(amplitude);
            if (formatted === '(0)') return null;

            const basis = index.toString(2).padStart(numQubits, '0');
            return `${formatted}|${basis}⟩`;
        })
        .filter(Boolean)
        .join(' + ');
}

// Format the quantum state in polar form to highlight phase shifts
export function formatQuantumStatePolar(state: Complex[]): string {
    const numQubits = Math.log2(state.length);

    const getPolar = ({ re, im }: Complex) => {
        const magnitude = Math.sqrt(re * re + im * im);
        const phase = Math.atan2(im, re); // radians
        return {
            magnitude: magnitude.toFixed(2),
            phase: (phase * 180 / Math.PI).toFixed(2) // degrees
        };
    };

    return state
        .map((amplitude, index) => {
            const { magnitude, phase } = getPolar(amplitude);
            if (parseFloat(magnitude) === 0) return null;

            const basis = index.toString(2).padStart(numQubits, '0');
            return `|${basis}⟩: ${magnitude}e^(i * ${phase}°)`;
        })
        .filter(Boolean)
        .join(', ');
}
