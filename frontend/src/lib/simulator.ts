import type { CircuitState, SimulationResult } from "./stores";
import { Complex, Vector, Gates, Dimension } from "quantum-tensors";

export function simulateSingleQubitX(circuit: CircuitState): SimulationResult {
    const qubitDim = Dimension.qubit();

    // Initial state: |0⟩ (probability 1 for |0⟩, 0 for |1⟩)
    let qubitState = Vector.fromArray(
        [
            new Complex(1, 0), // |0⟩ amplitude
            new Complex(0, 0), // |1⟩ amplitude
        ], 
        [qubitDim]
    );

    // Apply gates from the circuit
    for (const gate of circuit.gates) {
        if (gate.gateType === 'X') {
            // Apply the X gate, which returns a Tensor
            const newStateTensor = Gates.X.apply(qubitState);
            // Convert the Tensor to a dense matrix (Complex[][])
            const denseState = newStateTensor.toDense();
            // For a single qubit, denseState is a 2x1 matrix: [[Complex(0, 0)], [Complex(1, 0)]]
            // Extract the state vector as a Complex[]: [Complex(0, 0), Complex(1, 0)]
            const stateVector = [denseState[0][0], denseState[1][0]];
            // Create a new Vector from the state vector
            qubitState = Vector.fromArray(stateVector, [qubitDim]);
        }
    }

    // Calculate probabilities
    const probabilities: { [state: string]: number } = {};
        const newQubitState = qubitState.toDense();
        
        const amp0 = newQubitState[0]; // amplitude for |0⟩
        const amp1 = newQubitState[1]; // amplitude for |1⟩

        const prob0 = amp0.re ** 2 + amp0.im ** 2;
        const prob1 = amp1.re ** 2 + amp1.im ** 2;


        probabilities["0"] = prob0;
        probabilities["1"] = prob1;

    return { probabilities };

}
