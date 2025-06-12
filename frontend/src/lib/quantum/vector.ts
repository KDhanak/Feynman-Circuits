// Defines a type for Complex numbers, imported from "./complex"
// Also imports utility functions `add` and `multiply` for complex number operations
import { type Complex} from "./complex";

// Defines a QuantumState as an array of Complex numbers, representing the amplitudes of a quantum state
export type QuantumState = Complex[];

// Creates a quantum state from an array of complex amplitudes
// Parameters:
// - amplitudes: An array of Complex numbers representing the state's amplitudes
// Returns: A QuantumState (array of Complex numbers)
export function createState(amplitudes: Complex[]): QuantumState {
    return amplitudes; // Simply returns the input amplitudes as the quantum state
};
