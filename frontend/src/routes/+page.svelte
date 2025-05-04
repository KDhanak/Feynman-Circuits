<script lang="ts">
    import axios, { AxiosError } from 'axios';
    import type { GateInput, CircuitInput, ErrorResponse, SimulationResult } from '../types';
  
    let numQubits: number = 2;
    let gate: GateInput = { gate: 'H', targetQubit: 0, controlQubit: -1 };
    let output: string = '';
  
    async function simulateCircuit() {
      try {
        const response = await axios.post<SimulationResult>('http://localhost:5158/api/circuit/simulate', {
          gate,
          numQubits
        } as CircuitInput);
        output = `Measurement Results: [${response.data.join(', ')}]`;
        console.log('Simulation Result:', response.data);
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          const axiosError = error as AxiosError<ErrorResponse>;
          output = `Error: ${axiosError.response?.data?.detail || axiosError.message}`;
        } else {
          output = `Error: ${(error as Error).message || 'Unknown error'}`;
        }
      }
    }
  </script>
  
  <main class="p-5 font-sans">
    <h1 class="text-3xl font-bold mb-5">Feynman Circuits</h1>
    <form on:submit|preventDefault={simulateCircuit} class="space-y-4">
      <div>
        <label for="num-qubits" class="block text-sm font-medium text-gray-700">Number of Qubits:</label>
        <input
          id="num-qubits"
          type="number"
          bind:value={numQubits}
          min="1"
          required
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>
      <div>
        <label for="gate-type" class="block text-sm font-medium text-gray-700">Gate:</label>
        <select
          id="gate-type"
          bind:value={gate.gate}
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          <option value="H">Hadamard (H)</option>
          <option value="X">Pauli X</option>
          <option value="Z">Pauli Z</option>
          <option value="CNOT">CNOT</option>
        </select>
        <label for="target-qubit" class="block text-sm font-medium text-gray-700 mt-2">Target Qubit:</label>
        <input
          id="target-qubit"
          type="number"
          bind:value={gate.targetQubit}
          min="0"
          required
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
        <label for="control-qubit" class="block text-sm font-medium text-gray-700 mt-2">Control Qubit (for CNOT):</label>
        <input
          id="control-qubit"
          type="number"
          bind:value={gate.controlQubit}
          min="-1"
          required
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>
      <button
        type="submit"
        class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        Simulate Circuit
      </button>
    </form>
    <pre class="mt-5 whitespace-pre-wrap">{output}</pre>
  </main>
