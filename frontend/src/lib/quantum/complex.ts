export interface Complex {
    re: number;
    im: number;
}

export function createComplex(re: number, im: number): Complex {
    return {re, im};
}

export function conjugate(z: Complex): Complex {
    return {re: z.re, im: -z.im};
}

export function magnitude(z: Complex): number {
    return Math.sqrt(z.re * z.re + z.im * z.im);
}

export function magnitudeSquared(z: Complex): number {
    return z.re * z.re + z.im * z.im;
}

export function add (z1: Complex, z2: Complex): Complex {
    return {re: z1.re + z2.re, im: z1.im + z2.im};
}

export function multiply (z1: Complex, z2: Complex): Complex {
    return {
        re: z1.re * z2.re - z1.im * z2.im,
        im: z1.re * z2.im + z1.im * z2.re,
    };
}

export function scale(z: Complex, scalar: number): Complex {
    return {re: z.re * scalar, im: z.im * scalar};
}
