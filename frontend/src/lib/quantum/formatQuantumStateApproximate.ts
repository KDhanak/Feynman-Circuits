import type { QuantumState } from "./vector";

export function formatQuantumStateApproximate(state: QuantumState): string {
    const sqrt2Inv = 1 / Math.sqrt(2); // Approximately 0.7071067811865475
    const tolerance = 1e-10; // Tolerance for floating-point comparison
    let result = '';

    state.forEach((amplitude, index) => {
        const real = amplitude.re;
        const imag = amplitude.im;
        let coeffStr = '';

        if (Math.abs(real - sqrt2Inv) < tolerance) {
            coeffStr = '1/√2';
        } else if (Math.abs(real + sqrt2Inv) < tolerance) {
            coeffStr = '-1/√2';
        } else if (Math.abs(real) < tolerance) {
            coeffStr = '0';
        } else {
            coeffStr = real.toFixed(2);
        }

        if (Math.abs(imag) > tolerance) {
            const imagSign = imag >= 0 ? '+' : '-';
            const imagAbs = Math.abs(imag);
            let imagStr = '';
            if (Math.abs(imagAbs - sqrt2Inv) < tolerance) {
                imagStr = '1/√2';
            } else {
                imagStr = imagAbs.toFixed(2);
            }
            coeffStr += `${coeffStr !== '0' ? imagSign : (imag < 0 ? '-': '')}${imagStr}`
        }

        if (coeffStr !== '0') {
            if (result) result += ' + ';
            result += `${coeffStr}|${index}⟩`
        }

    });

    return result || '0';
}
