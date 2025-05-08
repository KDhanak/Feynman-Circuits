import type { CircuitState, SimulationResult } from "./stores";
import { Complex, Vector, Gates, Dimension } from "quantum-tensors";

export function simulateSingleQubitX (circuit: CircuitState): SimulationResult {

    const qubitDim = Dimension.qubit();

    let qubitState = Vector.fromArray(
        [
            new Complex(1, 0),
            new Complex(0, 0),
        ], 
        [qubitDim]
    );

    const probabilities: { [state: string]: number } = {};

    const newQubitState = Gates.X.apply(qubitState).toDense();

        const amp0 = newQubitState[0][0];
        const amp1 = newQubitState[0][1];

        const prob0 = amp0.re ** 2 + amp0.im ** 2;
        const prob1 = amp1.re ** 2 + amp1.im ** 2;


        probabilities["0"] = prob0;
        probabilities["1"] = prob1;

    return { probabilities };

}
