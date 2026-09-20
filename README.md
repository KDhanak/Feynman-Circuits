# Feynman Circuits

A browser-based quantum circuit simulator built from scratch — no Qiskit, no Pennylane. The statevector simulation engine is implemented entirely in TypeScript. The separate quantum-error-correction mode is the one exception: its stabiliser simulation and decoding run on the backend with Stim and PyMatching.

## Features

**Circuit Builder**
- Drag-and-drop gate placement on a multi-qubit wire grid
- Touch support for mobile devices
- Double-click to place gates from the palette
- Box-select multiple gates by dragging over them (Ctrl/Cmd to add), then `Delete` to remove
- Undo and redo (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, plus on-screen buttons on mobile)
- Copy or reset the whole circuit from the board's right-click menu (or the reset button)
- Import and export circuits as JSON, OpenQASM 2.0 / 3.0, Qiskit Python, or Q#

**Gates**
| Category | Gates |
|---|---|
| Single-qubit | X, Y, Z, H, S, T |
| Parametric | RX(θ), RY(θ), RZ(θ), P(θ) |
| Multi-qubit | CONTROL, ANTI-CONTROL, SWAP |
| Measurement | MEASURE |

**Simulation**
- Real-time statevector simulation — runs instantly as you edit the circuit
- Correct Born's rule qubit collapse on measurement
- Quantum state displayed in Dirac notation (including polar form)
- Probability histogram with animated bars
- Live results popup window for circuits with 4+ qubits

**Visualization**
- Per-qubit Bloch sphere rendered in real time
- Overall Bloch sphere for multi-qubit state overview

**Error Correction (QEC mode)**
- A rotated distance-3 surface code memory: 9 data qubits holding one logical qubit, 8 ancillas measuring the stabilisers
- Click a data qubit to place a deterministic X, Y or Z error at a chosen round, then run the experiment
- Step through the rounds and watch which checks fire — detection events, not raw syndromes
- Ground truth, measured syndrome and the decoder's guess are kept as three separate layers, so a correction is never shown as "the error that happened"
- Decoder verdict from MWPM matching, including the cases where the decoder gets it wrong
- Turning QEC mode on restricts the palette to single-qubit Clifford gates, which is all the stabiliser simulator can represent

**Accounts & Storage**
- Sign up / sign in with email and password
- OTP-based password reset via email
- Cloud circuit save with auto-save while editing
- Circuit library — load and manage saved circuits

**Sharing**
- Publish a saved circuit and share it by link — recipients need no account
- Signed-out users can share too: the circuit is encoded in the link itself
- Opening a shared link loads the circuit onto the board and simulates it

**UI**
- Dark and light theme
- Fully responsive layout, with tap-to-place editing on touch devices
- Guided onboarding tour for first-time users

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | SvelteKit, TypeScript, Tailwind CSS |
| Backend | Django 6, Django REST Framework |
| Auth | JWT via HTTP-only cookies, SimpleJWT |
| Database | PostgreSQL |
| Email | django-anymail |
| QEC simulation | Stim + PyMatching (backend only) |

The simulation engine ([frontend/src/lib/circuit/simulator.ts](frontend/src/lib/circuit/simulator.ts)) and all quantum math (complex numbers, state vectors, matrix operations, Bloch vector computation) are written from first principles with no external quantum computing dependencies. QEC mode is deliberately separate: it is a stabiliser simulation, which a statevector engine is the wrong tool for, so it runs in the Django backend on Stim with PyMatching for decoding.

## Project Structure

```
feynman-circuits/
├── frontend/               # SvelteKit app
│   └── src/
│       ├── components/     # UI components (CircuitLayout, GatePalette, BlochSphere, ...)
│       ├── lib/
│       │   ├── circuit/    # Simulator, drag-drop, OpenQASM/Qiskit/Q# converters, auto-save
│       │   ├── quantum/    # Complex numbers, vectors, matrices, gates, Bloch
│       │   ├── IR/         # Circuit intermediate representation & schema
│       │   ├── api/        # Axios client & circuit API calls
│       │   ├── auth/       # Session management
│       │   ├── qec/        # Surface-code layout, stores and run actions
│       │   ├── onboarding/ # Guided tour steps
│       │   └── stores/     # Svelte stores (theme, UI state)
│       └── routes/         # SvelteKit pages
└── backend/                # Django REST API
    ├── accounts/           # Auth — sign up, sign in, JWT, password reset
    ├── circuits/           # Circuit CRUD, IR validation, public share endpoint
    ├── qec/                # Surface-code experiment: Stim circuit, MWPM decoding, run API
    └── config/             # Django settings & URL config
```

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

pip install -r requirements.txt
```

Create a `.env` file in `backend/` with:

```env
SECRET_KEY=your-django-secret-key
DEBUG=True
DATABASE_URL=postgres://user:password@localhost:5432/feynman_circuits
ANYMAIL_API_KEY=your-email-provider-key
DEFAULT_FROM_EMAIL=noreply@yourdomain.com
```

Then run:

```bash
python manage.py migrate
python manage.py runserver
```

The frontend dev server runs on `http://localhost:5173` and proxies API requests to `http://localhost:8000`.

## How the Simulator Works

The circuit is stored as an intermediate representation (IR) — a list of operations with column positions, target qubits, control qubits, and gate parameters. When the circuit changes, the simulator:

1. Initialises all qubits to |0⟩ (state vector of length 2ⁿ)
2. Iterates over circuit columns left to right
3. For each gate, constructs the full 2ⁿ × 2ⁿ unitary matrix via tensor product extension
4. Applies the matrix to the current state vector
5. For MEASURE operations, collapses the target qubit using Born's rule and records the classical outcome
6. Returns probabilities, the formatted quantum state, and Bloch vectors for all qubits
