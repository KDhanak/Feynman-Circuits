export const LABEL_WIDTH = 80;
export const COLUMN_WIDTH = 58; // ideal / maximum column width
export const GATE_OFFSET = LABEL_WIDTH + 44; // 124
export const MAX_COLUMNS = 29; // hard cap on how far a circuit can extend
export const MAX_QUBITS = 8;

// Dropzone sizing. The board renders only as many columns as the circuit needs
// (used columns + a buffer of empty ones to drop into), fitted to the centre
// panel — instead of always rendering MAX_COLUMNS. This avoids a forced
// horizontal scrollbar on laptops/monitors when the circuit is small.
export const MIN_COLUMN_WIDTH = 40; // legibility floor before the track scrolls
export const COLUMN_BUFFER = 4; // empty columns kept past the last used one
export const MIN_VISIBLE_COLUMNS = 8; // smallest canvas, even for an empty circuit
