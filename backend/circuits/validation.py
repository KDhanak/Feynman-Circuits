"""Circuit IR validation, shared by the private (owner) API and the public
handoff API.

This lives outside serializers.py because two very different callers need it:
the authenticated CircuitDetailSerializer, where the payload comes from our own
frontend, and circuits arriving from a share link, which may have been built in
another browser or hand-edited in the URL. That second caller is the reason the
checks here are strict — anything the frontend guarantees by construction has to
be proven on the wire instead.

The gate rules are driven entirely by shared/gates.json (`arity` and `numParams`
per gate), so adding a gate to the registry extends validation automatically
rather than requiring a matching edit here.

The client-side counterpart is frontend/src/lib/IR/validate.ts; the two are kept
deliberately close in what they accept.
"""

import json
from pathlib import Path

from rest_framework import serializers

_gates_path = Path(__file__).parents[2] / 'shared' / 'gates.json'
_GATES = {g['id']: g for g in json.loads(_gates_path.read_text())}

VALID_GATES = set(_GATES)
VALID_KINDS = {'unitary', 'measure', 'reset', 'barrier'}
VALID_VERSION = '1.0'

# Mirrors frontend/src/lib/utils/constants.ts — MAX_QUBITS and MAX_COLUMNS.
MAX_QUBITS = 8
MAX_COLUMNS = 29
# Every qubit occupied in every column is the densest a circuit can legally get.
MAX_OPERATIONS = MAX_QUBITS * (MAX_COLUMNS + 1)


def _fail(message):
    raise serializers.ValidationError(message)


def _qubit_indices(op, field, num_qubits, label):
    """Read a qubit-index list off an operation and check every entry is an int
    inside the register. Returns the list so callers can test for overlap."""
    value = op.get(field, [])
    if not isinstance(value, list):
        _fail(f"{label}: '{field}' must be a list")
    for index in value:
        if not isinstance(index, int) or isinstance(index, bool):
            _fail(f"{label}: '{field}' entries must be integers")
        if not (0 <= index < num_qubits):
            _fail(
                f"{label}: qubit index {index} in '{field}' is outside the "
                f"circuit's {num_qubits}-qubit register"
            )
    return value


def _validate_unitary(op, num_qubits, label):
    gate = op.get('gate')
    if gate not in VALID_GATES:
        _fail(f"{label}: invalid gate '{gate}'")

    spec = _GATES[gate]
    targets = _qubit_indices(op, 'targets', num_qubits, label)
    controls = _qubit_indices(op, 'controls', num_qubits, label)
    anti_controls = _qubit_indices(op, 'antiControls', num_qubits, label)

    if len(targets) != spec['arity']:
        _fail(
            f"{label}: gate '{gate}' takes {spec['arity']} target(s), "
            f"got {len(targets)}"
        )

    # A qubit cannot be both acted on and used as a control in the same column,
    # and a control cannot be both a control and an anti-control.
    if len(set(targets)) != len(targets):
        _fail(f"{label}: duplicate qubit in 'targets'")
    overlap = (set(targets) & set(controls)) | (set(targets) & set(anti_controls))
    if overlap:
        _fail(f"{label}: qubit {sorted(overlap)[0]} is both a target and a control")
    if set(controls) & set(anti_controls):
        _fail(f"{label}: a qubit cannot be both a control and an anti-control")

    params = op.get('params', [])
    if not isinstance(params, list):
        _fail(f"{label}: 'params' must be a list")
    if len(params) != spec['numParams']:
        _fail(
            f"{label}: gate '{gate}' takes {spec['numParams']} param(s), "
            f"got {len(params)}"
        )
    for param in params:
        if isinstance(param, bool) or not isinstance(param, (int, float)):
            _fail(f"{label}: 'params' entries must be numbers")


def _validate_measure(op, num_qubits, num_clbits, label):
    _qubit_indices(op, 'targets', num_qubits, label)
    classical = op.get('classicalTargets', [])
    if not isinstance(classical, list):
        _fail(f"{label}: 'classicalTargets' must be a list")
    for index in classical:
        if not isinstance(index, int) or isinstance(index, bool):
            _fail(f"{label}: 'classicalTargets' entries must be integers")
        if not (0 <= index < num_clbits):
            _fail(
                f"{label}: classical bit {index} is outside the circuit's "
                f"{num_clbits}-bit classical register"
            )


def validate_circuit_ir(value):
    """Validate a canonical Circuit IR document, raising DRF ValidationError on
    the first problem found. Returns the value unchanged so it can be used
    directly as a serializer field validator."""
    if not isinstance(value, dict):
        _fail("IR must be an object")

    if value.get('version') != VALID_VERSION:
        _fail(f"IR must have version '{VALID_VERSION}'")

    registers = value.get('registers')
    if not isinstance(registers, dict):
        _fail("IR must have a 'registers' object")

    num_qubits = registers.get('q', 0)
    num_clbits = registers.get('c', 0)
    if not isinstance(num_qubits, int) or isinstance(num_qubits, bool):
        _fail("Qubit count must be an integer")
    if not isinstance(num_clbits, int) or isinstance(num_clbits, bool):
        _fail("Classical bit count must be an integer")
    if not (1 <= num_qubits <= MAX_QUBITS):
        _fail(f"Qubit count must be between 1 and {MAX_QUBITS}")
    if num_clbits < 0:
        _fail("Classical bit count cannot be negative")

    labels = value.get('qubitLabels', [])
    if not isinstance(labels, list) or not all(isinstance(x, str) for x in labels):
        _fail("'qubitLabels' must be a list of strings")
    if labels and len(labels) != num_qubits:
        _fail(f"'qubitLabels' has {len(labels)} entries for {num_qubits} qubits")

    operations = value.get('operations', [])
    if not isinstance(operations, list):
        _fail("'operations' must be a list")
    if len(operations) > MAX_OPERATIONS:
        _fail(f"Circuit has {len(operations)} operations; the maximum is {MAX_OPERATIONS}")

    seen_ids = set()
    for index, op in enumerate(operations):
        label = f"Operation {index}"
        if not isinstance(op, dict):
            _fail(f"{label}: must be an object")

        kind = op.get('kind')
        if kind not in VALID_KINDS:
            _fail(f"{label}: invalid operation kind '{kind}'")

        column = op.get('column', -1)
        if not isinstance(column, int) or isinstance(column, bool):
            _fail(f"{label}: 'column' must be an integer")
        if not (0 <= column <= MAX_COLUMNS):
            _fail(f"{label}: column {column} out of range (0–{MAX_COLUMNS})")

        # `id` is optional on the wire — the handoff format drops it to keep
        # links short and the client regenerates one on import — but when it is
        # present it has to be unique, since the frontend keys operations by it.
        op_id = op.get('id')
        if op_id is not None:
            if not isinstance(op_id, str):
                _fail(f"{label}: 'id' must be a string")
            if op_id in seen_ids:
                _fail(f"{label}: duplicate operation id '{op_id}'")
            seen_ids.add(op_id)

        if kind == 'unitary':
            _validate_unitary(op, num_qubits, label)
        elif kind == 'measure':
            _validate_measure(op, num_qubits, num_clbits, label)
        else:
            # reset and barrier carry targets only.
            _qubit_indices(op, 'targets', num_qubits, label)

    return value
