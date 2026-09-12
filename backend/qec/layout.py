"""Layout of the rotated distance-3 surface code.

This table is a copy of the one in `frontend/src/lib/qec/layout.ts`. Both
copies must be exactly the same. The frontend uses its copy to draw the
lattice, and the backend uses this copy to build the Stim circuit. If they
ever differ, the picture on screen would not match the real physics.
`tests.py` compares the two files, so if they differ the tests fail and we find
out right away, instead of showing a diagram that is slightly wrong.

Coordinates use the same rules as Stim: data qubits sit where x and y are both
odd, checks sit where x and y are both even, and y gets bigger going down.

       x=0   1   2   3   4   5   6
 y=0             [X2]
 y=1        q0   q1       q2
 y=2   [Z2]    [X0]    [Z0]
 y=3        q3   q4       q5
 y=4        [Z1]    [X1]    [Z3]
 y=5        q6   q7       q8
 y=6            [X3]
"""

from dataclasses import dataclass

DISTANCE = 3


@dataclass(frozen=True)
class DataQubit:
    id: int
    x: int
    y: int

    def to_dict(self) -> dict:
        return {"id": self.id, "x": self.x, "y": self.y}


@dataclass(frozen=True)
class Check:
    id: str
    type: str  # "X" or "Z"
    x: int
    y: int
    data_qubits: tuple[int, ...]

    def to_dict(self) -> dict:
        # Use camelCase names so they match the frontend's SurfaceCodeLayout type exactly.
        return {
            "id": self.id,
            "type": self.type,
            "x": self.x,
            "y": self.y,
            "dataQubits": list(self.data_qubits),
        }


DATA_QUBITS: tuple[DataQubit, ...] = (
    DataQubit(0, 1, 1),
    DataQubit(1, 3, 1),
    DataQubit(2, 5, 1),
    DataQubit(3, 1, 3),
    DataQubit(4, 3, 3),
    DataQubit(5, 5, 3),
    DataQubit(6, 1, 5),
    DataQubit(7, 3, 5),
    DataQubit(8, 5, 5),
)

# Do not change this order. The ancilla qubits get the numbers 9 to 16 in
# exactly this order, and the frontend expects the same order.
CHECKS: tuple[Check, ...] = (
    Check("X0", "X", 2, 2, (0, 1, 3, 4)),
    Check("X1", "X", 4, 4, (4, 5, 7, 8)),
    Check("X2", "X", 4, 0, (1, 2)),
    Check("X3", "X", 2, 6, (6, 7)),
    Check("Z0", "Z", 4, 2, (1, 2, 4, 5)),
    Check("Z1", "Z", 2, 4, (3, 4, 6, 7)),
    Check("Z2", "Z", 0, 2, (0, 3)),
    Check("Z3", "Z", 6, 4, (5, 8)),
)

# The qubits the logical Z operator acts on (the top row). This is also the
# observable the memory experiment watches. There are 3 qubits here, and that
# number is the code distance.
# Note: this row is NOT where the hidden failure happens. The failure we cannot
# see is a chain of X errors going DOWN the left column (q0, q3, q6). That chain
# sets off no detector, but it still flips this observable.
LOGICAL_Z: tuple[int, ...] = (0, 1, 2)

ANCILLA_START = 9

#: check id -> the qubit index Stim uses for that check's ancilla.
ANCILLA_INDEX: dict[str, int] = {
    check.id: ANCILLA_START + i for i, check in enumerate(CHECKS)
}

#: (x, y) -> data qubit id. Used to find a check's neighbours when placing the CNOTs.
DATA_AT: dict[tuple[int, int], int] = {(q.x, q.y): q.id for q in DATA_QUBITS}

X_CHECKS: tuple[Check, ...] = tuple(c for c in CHECKS if c.type == "X")
Z_CHECKS: tuple[Check, ...] = tuple(c for c in CHECKS if c.type == "Z")


def get_check(check_id: str) -> Check | None:
    return next((c for c in CHECKS if c.id == check_id), None)


def checks_affected_by(qubit: int, pauli: str) -> list[str]:
    """Checks whose stabiliser anticommutes with `pauli` on `qubit`.

    In simple words: the checks that would notice this error. Z checks catch X
    errors, X checks catch Z errors, and both kinds catch Y errors. We only use
    this for previews and in tests. We never use it to work out the real
    syndrome. Only Stim does that.
    """
    detected_by = {"X": "Z", "Z": "X", "Y": "both"}[pauli]
    return [
        c.id
        for c in CHECKS
        if qubit in c.data_qubits and (detected_by == "both" or c.type == detected_by)
    ]


def to_dict() -> dict:
    """Returns the layout in the shape of the frontend's `SurfaceCodeLayout`.

    We send it back in every response. That way, if the frontend and backend
    copies ever differ, the frontend can notice, instead of quietly drawing a
    different code.
    """
    return {
        "distance": DISTANCE,
        "dataQubits": [q.to_dict() for q in DATA_QUBITS],
        "checks": [c.to_dict() for c in CHECKS],
        "logicalZ": list(LOGICAL_Z),
    }
