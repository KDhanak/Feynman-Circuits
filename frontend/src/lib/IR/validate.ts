// This file is responsible for validating whether an unknown input
// actually matches our Canonical Circuit IR structure.

// It does NOT modify data.
// It only checks correctness and reports errors.

import type {
    CanonicalUnitaryGate
} from './schema';

// Supported version of the IR schema
const VALID_VERSION = '1.0';

// List of valid unitary gates we currently support
const VALID_UNITARY_GATES: CanonicalUnitaryGate[] = ['x', 'y', 'z', 'h', 's', 't'];

// Allowed operation types
const VALID_KINDS = ['unitary', 'measure', 'reset', 'barrier'] as const;

// Return type of validator
export interface ValidationResult {
    valid: boolean;     // true if no errors
    errors: string[];   // list of all validation issues
}

// -----------------------------
// 🔹 Helper Type Guards
// -----------------------------

// Checks if value is a plain object (not array, not null)
function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Checks if value is a non-negative integer
function isNonNegativeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

// Checks if value is an array of strings
function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

// Checks if value is an array of valid qubit indices (numbers)
function isNumberArray(value: unknown): value is number[] {
    return Array.isArray(value) && value.every((item) => isNonNegativeInteger(item));
}

// Detect duplicate values in array
function hasDuplicates(values: number[]): boolean {
    return new Set(values).size !== values.length;
}

// Check if two arrays share any common value
function arraysOverlap(a: number[], b: number[]): boolean {
    const bSet = new Set(b);
    return a.some((value) => bSet.has(value));
}

// -----------------------------
// 🔹 Index Validation Helpers
// -----------------------------

// Ensures qubit indices are within valid range
function validateQubitIndices(
    values: number[],
    numQubits: number,
    fieldName: string,
    opLabel: string,
    errors: string[]
) {
    for (const value of values) {
        if (value < 0 || value >= numQubits) {
            errors.push(`${opLabel}: ${fieldName} contains invalid qubit index ${value}.`);
        }
    }
}

// Ensures classical bit indices are valid
function validateClassicalIndices(
    values: number[],
    numClassicalBits: number,
    fieldName: string,
    opLabel: string,
    errors: string[]
) {
    for (const value of values) {
        if (value < 0 || value >= numClassicalBits) {
            errors.push(`${opLabel}: ${fieldName} contains invalid classical bit index ${value}.`);
        }
    }
}

// -----------------------------
// 🔹 Base Operation Validation
// -----------------------------

// Validates fields common to ALL operations
function validateBaseOperationShape(
    op: Record<string, unknown>,
    index: number,
    errors: string[]
): { id: string; kind: string; gate: string; column: number } | null {
    const opLabel = `Operation at index ${index}`;

    // Check id
    if (typeof op.id !== 'string' || op.id.trim() === '') {
        errors.push(`${opLabel}: missing or invalid "id".`);
    }

    // Check kind
    if (typeof op.kind !== 'string' || !VALID_KINDS.includes(op.kind as any)) {
        errors.push(`${opLabel}: missing or invalid "kind".`);
    }

    // Check gate
    if (typeof op.gate !== 'string' || op.gate.trim() === '') {
        errors.push(`${opLabel}: missing or invalid "gate".`);
    }

    // Check column (layout position)
    if (!isNonNegativeInteger(op.column)) {
        errors.push(`${opLabel}: missing or invalid "column".`);
    }

    // If any critical fields are invalid, stop further validation
    if (
        typeof op.id !== 'string' ||
        typeof op.kind !== 'string' ||
        typeof op.gate !== 'string' ||
        !isNonNegativeInteger(op.column)
    ) {
        return null;
    }

    return {
        id: op.id,
        kind: op.kind,
        gate: op.gate,
        column: op.column
    };
}

// -----------------------------
// 🔹 Unitary Operation
// -----------------------------

function validateUnitaryOperation(
    op: Record<string, unknown>,
    index: number,
    numQubits: number,
    errors: string[]
) {
    const opLabel = `Operation "${String(op.id ?? index)}"`;

    // Gate must be one of supported unitary gates
    if (!VALID_UNITARY_GATES.includes(op.gate as CanonicalUnitaryGate)) {
        errors.push(`${opLabel}: invalid unitary gate "${String(op.gate)}".`);
    }

    // Targets must exist
    if (!isNumberArray(op.targets) || op.targets.length === 0) {
        errors.push(`${opLabel}: "targets" must be a non-empty array.`);
        return;
    }

    // Controls must exist (can be empty array)
    if (!isNumberArray(op.controls)) {
        errors.push(`${opLabel}: "controls" must be an array.`);
        return;
    }

    // Params must be numbers
    if (!Array.isArray(op.params) || !op.params.every((p) => typeof p === 'number')) {
        errors.push(`${opLabel}: "params" must be numbers.`);
    }

    const targets = op.targets;
    const controls = op.controls;

    // No duplicates
    if (hasDuplicates(targets)) {
        errors.push(`${opLabel}: duplicate targets.`);
    }
    if (hasDuplicates(controls)) {
        errors.push(`${opLabel}: duplicate controls.`);
    }

    // Controls and targets must not overlap
    if (arraysOverlap(targets, controls)) {
        errors.push(`${opLabel}: controls and targets overlap.`);
    }

    // Validate indices
    validateQubitIndices(targets, numQubits, 'targets', opLabel, errors);
    validateQubitIndices(controls, numQubits, 'controls', opLabel, errors);
}

// -----------------------------
// 🔹 Measure Operation
// -----------------------------

function validateMeasureOperation(
    op: Record<string, unknown>,
    index: number,
    numQubits: number,
    numClassicalBits: number,
    errors: string[]
) {
    const opLabel = `Operation "${String(op.id ?? index)}"`;

    if (op.gate !== 'measure') {
        errors.push(`${opLabel}: gate must be "measure".`);
    }

    if (!isNumberArray(op.targets)) {
        errors.push(`${opLabel}: invalid targets.`);
        return;
    }

    if (!isNumberArray(op.classicalTargets)) {
        errors.push(`${opLabel}: invalid classicalTargets.`);
        return;
    }

    // Must match 1-to-1
    if (op.targets.length !== op.classicalTargets.length) {
        errors.push(`${opLabel}: mismatch between targets and classicalTargets.`);
    }

    validateQubitIndices(op.targets, numQubits, 'targets', opLabel, errors);
    validateClassicalIndices(op.classicalTargets, numClassicalBits, 'classicalTargets', opLabel, errors);
}

// -----------------------------
// 🔹 Reset Operation
// -----------------------------

function validateResetOperation(
    op: Record<string, unknown>,
    index: number,
    numQubits: number,
    errors: string[]
) {
    const opLabel = `Operation "${String(op.id ?? index)}"`;

    if (op.gate !== 'reset') {
        errors.push(`${opLabel}: gate must be "reset".`);
    }

    if (!isNumberArray(op.targets)) {
        errors.push(`${opLabel}: invalid targets.`);
        return;
    }

    validateQubitIndices(op.targets, numQubits, 'targets', opLabel, errors);
}

// -----------------------------
// 🔹 Barrier Operation
// -----------------------------

function validateBarrierOperation(
    op: Record<string, unknown>,
    index: number,
    numQubits: number,
    errors: string[]
) {
    const opLabel = `Operation "${String(op.id ?? index)}"`;

    if (op.gate !== 'barrier') {
        errors.push(`${opLabel}: gate must be "barrier".`);
    }

    if (!isNumberArray(op.targets)) {
        errors.push(`${opLabel}: invalid targets.`);
        return;
    }

    validateQubitIndices(op.targets, numQubits, 'targets', opLabel, errors);
}

// -----------------------------
// MAIN VALIDATOR
// -----------------------------

export function validateCanonicalIR(input: unknown): ValidationResult {
    const errors: string[] = [];

    // Must be object
    if (!isPlainObject(input)) {
        return { valid: false, errors: ['Circuit IR must be an object.'] };
    }

    // Version check
    if (input.version !== VALID_VERSION) {
        errors.push(`Invalid version.`);
    }

    // Registers validation
    let numQubits = 0;
    let numClassicalBits = 0;

    if (!isPlainObject(input.registers)) {
        errors.push('Missing or invalid "registers" object.');
    } else {
        if (!isNonNegativeInteger(input.registers.q) || input.registers.q <= 0) {
            errors.push('"registers.q" must be a positive integer.');
        } else {
            numQubits = input.registers.q;
        }

        if (!isNonNegativeInteger(input.registers.c)) {
            errors.push('"registers.c" must be a non-negative integer.');
        } else {
            numClassicalBits = input.registers.c;
        }
    }

    // Labels
    if (!isStringArray(input.qubitLabels)) {
        errors.push('Invalid qubitLabels.');
    }

    // Operations
    if (!Array.isArray(input.operations)) {
        errors.push('Operations must be array.');
    } else {
        const ids = new Set<string>();

        input.operations.forEach((op, index) => {
            if (!isPlainObject(op)) {
                errors.push(`Operation ${index} invalid.`);
                return;
            }

            const base = validateBaseOperationShape(op, index, errors);
            if (!base) return;

            // Check duplicate IDs
            if (ids.has(base.id)) {
                errors.push(`Duplicate id ${base.id}`);
            } else {
                ids.add(base.id);
            }

            // Dispatch validation by kind
            switch (base.kind) {
                case 'unitary':
                    validateUnitaryOperation(op, index, numQubits, errors);
                    break;
                case 'measure':
                    validateMeasureOperation(op, index, numQubits, numClassicalBits, errors);
                    break;
                case 'reset':
                    validateResetOperation(op, index, numQubits, errors);
                    break;
                case 'barrier':
                    validateBarrierOperation(op, index, numQubits, errors);
                    break;
            }
        });
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
