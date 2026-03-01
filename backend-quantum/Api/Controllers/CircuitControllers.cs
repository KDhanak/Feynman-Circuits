using Microsoft.AspNetCore.Mvc;
using Microsoft.Quantum.Simulation.Simulators;
using Microsoft.Quantum.Simulation.Core;
using QuantumLogic;

namespace Api.Controllers
{
    public record GateInput(string Gate, int TargetQubit, int ControlQubit = -1);
    public record CircuitInput(GateInput Gate, int NumQubits);
    public record CircuitInputWithShots(GateInput[] Gates, int NumQubits, int Shots);

    [ApiController]
    [Route("api/[controller]")]
    public class CircuitController : ControllerBase
    {
        [HttpPost("simulate")]
        public async Task<IActionResult> RunCircuitSimulation([FromBody] CircuitInput input)
        {
            try
            {
                if (input.NumQubits < 1 || input.Gate.TargetQubit >= input.NumQubits || (input.Gate.ControlQubit >= 0 && input.Gate.ControlQubit >= input.NumQubits))
                {
                    return BadRequest("Invalid qubit indices.");
                }
                using var sim = new QuantumSimulator();
                var gateTuple = (input.Gate.Gate, (long)input.Gate.TargetQubit, (long)input.Gate.ControlQubit);
                var gatesArray = new QArray<(string, long, long)>(new[] { gateTuple }); // Wrap single gate in array for Q#
                var result = await SimulateCircuit.Run(sim, gatesArray, input.NumQubits);
                var resultStrings = result.Select(r => r.ToString()).ToArray();
                return Ok(resultStrings);
            }
            catch (Exception ex)
            {
                return BadRequest($"Error simulating circuit: {ex.Message}");
            }
        }
    }
}
