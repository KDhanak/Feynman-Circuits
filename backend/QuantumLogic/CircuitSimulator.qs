namespace QuantumLogic {

    open Microsoft.Quantum.Canon;
    open Microsoft.Quantum.Intrinsic;
    open Microsoft.Quantum.Measurement;

    operation ApplyGate(gate : String, qubit : Qubit, control : Qubit) : Unit is Adj + Ctl {
        if gate == "H" {
            H(qubit);
        } elif gate == "X" {
            X(qubit);
        } elif gate == "Z" {
            Z(qubit);
        } elif gate == "CNOT" {
            CNOT(control, qubit);
        }
    }

    operation SimulateCircuit(gates : (String, Int, Int)[], numQubits : Int) : Result[] {
        use qubits = Qubit[numQubits];
        for (gate, target, control) in gates {
            if control >= 0 {
                ApplyGate(gate, qubits[target], qubits[control]);
            } else {
                ApplyGate(gate, qubits[target], qubits[0]);
            }
        }
        mutable results = Repeated(Zero, Length(qubits));
        for i in 0..Length(qubits)-1 {
            set results w/= i <- M(qubits[i]);
        }
        ResetAll(qubits);
        return results;
    }

    @EntryPoint()
    operation Main() : Unit {
        let gates = [("H", 0, -1), ("CNOT", 1, 0), ("X", 1, -1)];
        let numQubits = 2;
        let results = SimulateCircuit(gates, numQubits);
        Message($"Results: {results}");
    }
}

