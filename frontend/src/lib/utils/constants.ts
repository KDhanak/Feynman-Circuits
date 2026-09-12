export const LABEL_WIDTH = 80;
export const COLUMN_WIDTH = 58; // ideal / maximum column width
export const GATE_OFFSET = LABEL_WIDTH + 44; // 124
export const MAX_COLUMNS = 29; // the most columns a circuit can ever have
export const MAX_QUBITS = 8;

// Drop zone sizes. The board only draws as many columns as the circuit needs
// (the used columns plus a few empty ones to drop into), sized to fit the
// centre panel, instead of always drawing MAX_COLUMNS. This way a small circuit
// doesn't get an unneeded horizontal scrollbar on laptops and monitors.
export const MIN_COLUMN_WIDTH = 40; // smallest width that is still easy to read, before the track starts scrolling
export const COLUMN_BUFFER = 4; // empty columns kept after the last used one
export const MIN_VISIBLE_COLUMNS = 8; // smallest canvas, even for an empty circuit
