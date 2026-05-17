# Guide: Adding a New Gate to Feynman Circuits

This document provides a step-by-step process for adding a new gate type to the quantum circuit platform. Use this guide whenever you need to implement a new gate.

---

## Overview

Adding a new gate requires changes across **5-6 key files**:
1. **Schema Definition** (`src/lib/IR/schema.ts`)
2. **Gate Palette** (`src/components/GatePalette.svelte`)
3. **Drag/Drop Logic** (`src/lib/dragDropUtils.ts`)
4. **Circuit Rendering** (`src/components/CircuitLayout/WireDropeZone.svelte`)
5. **Simulator** (`src/lib/simulator.ts`) — *if gate requires special handling*

---

## Step-by-Step Process

### Step 1: Define the Gate Type in Schema

**File:** `src/lib/IR/schema.ts`

**What to do:**
- Determine if your gate is **unitary** (like X, Y, Z, H), **control-based** (like CONTROL), or **special** (like MEASURE)

**For Unitary Gates:**
- Add to the `CanonicalUnitaryGate` type if it's a standard single-qubit gate:
  ```ts
  export type CanonicalUnitaryGate = 'x' | 'y' | 'z' | 'h' | 's' | 't' | 'YOUR_GATE';
  ```

**For Control-Based Gates:**
- Extend `UnitaryOperation` with a new field (like we did with `antiControls`):
  ```ts
  export interface UnitaryOperation extends BaseOperation {
      kind: 'unitary';
      gate: CanonicalUnitaryGate;
      targets: number[];
      controls: number[];
      antiControls: number[];
      // NEW: Add your field here if needed
      yourNewField: number[];
      params: number[];
  }
  ```

**For Special Operations (Measurement, Reset, etc.):**
- Create a new operation interface extending `BaseOperation`:
  ```ts
  export interface YourGateOperation extends BaseOperation {
      kind: 'your_gate';
      targets: number[];
      // Add gate-specific fields
  }
  ```
- Add to `CircuitOperation` union type:
  ```ts
  export type CircuitOperation = UnitaryOperation | MeasureOperation | YourGateOperation;
  ```

---

### Step 2: Add Gate to Palette

**File:** `src/components/GatePalette.svelte`

**What to do:**

1. **Add to gates array** (line 22):
   ```ts
   export const gates: { type: string; name: string; category: string }[] = [
       // ... existing gates ...
       { type: 'YOUR_GATE', name: 'YOUR_GATE', category: 'single' }, // or 'multi'
   ];
   ```
   - **category:** `'single'` for single-qubit gates, `'multi'` for multi-qubit/control gates

2. **Update gate type check** (line 190):
   ```ts
   ['CONTROL', 'ANTI_CONTROL', 'MEASURE', 'YOUR_GATE'].includes(gate.type)
       ? 'h-11 w-10 rounded-sm border-secondary-4'
       : 'rounded-sm border-secondary-4 px-3.5 py-2 text-base font-medium text-secondary-2'
   ```

3. **Add rendering logic** (line 195):
   ```ts
   {#if gate.type === 'CONTROL'}
       <span class="h-3 w-3 rounded-full bg-secondary-4"></span>
   {:else if gate.type === 'YOUR_GATE'}
       <span>YOUR_ICON_HERE</span>
   {:else if gate.type === 'MEASURE'}
       <!-- ... -->
   {/if}
   ```

**Styling Options:**
- **Filled circle:** `<span class="h-3 w-3 rounded-full bg-secondary-4"></span>`
- **Open circle:** `<span class="h-3 w-3 rounded-full border border-secondary-4"></span>`
- **Icon:** Use `@iconify/svelte`: `<Icon icon="icon-name" width="20" height="20" />`
- **Text:** `<span>YOUR_TEXT</span>`

---

### Step 3: Handle Drag/Drop Logic

**File:** `src/lib/dragDropUtils.ts`

**What to do:**

1. **Create pending store** (if your gate is placed before being attached):
   ```ts
   export const pendingYourGates = writable<Map<number, number[]>>(new Map());
   ```

2. **Add to drop handler** in `_dropPaletteGate()` function (line 180):
   ```ts
   if (upperType === 'YOUR_GATE') {
       const upperType = gateType.toUpperCase();
       
       if (upperType === 'YOUR_GATE') {
           // Find existing operations in this column
           const existingOps = ir.operations.filter(
               op => op.kind === 'unitary' && op.column === col
           ) as UnitaryOperation[];
   
           if (existingOps.length > 0) {
               // Attach to existing operations
               for (const existingOp of existingOps) {
                   if (!existingOp.yourNewField.includes(qubit)) {
                       updateOperation(existingOp.id, op => ({
                           ...op,
                           yourNewField: [...(op as UnitaryOperation).yourNewField, qubit]
                       } as CircuitOperation));
                   }
               }
           } else {
               // Park in pending store
               pendingYourGates.update(map => {
                   const next = new Map(map);
                   const existing = next.get(col) ?? [];
                   if (!existing.includes(qubit)) next.set(col, [...existing, qubit]);
                   return next;
               });
           }
           triggerSimulation(get(circuitIR));
           return;
       }
   }
   ```

3. **Update function signature** (line 180):
   ```ts
   function _dropPaletteGate(
       gateType: string,
       col: number,
       qubit: number,
       ir: CircuitIR,
       pending: Map<number, number[]>,
       antiPending: Map<number, number[]>,
       yourPending: Map<number, number[]>  // ADD THIS
   )
   ```

4. **Update standard gate logic** (line 268):
   ```ts
   const pendingInColumn = pending.get(col) ?? [];
   const antiPendingInColumn = antiPending.get(col) ?? [];
   const yourPendingInColumn = yourPending.get(col) ?? [];
   
   // Collect from existing operations
   const existingYourGates = new Set<number>();
   for (const op of ir.operations) {
       if (op.kind === 'unitary' && op.column === col) {
           (op as UnitaryOperation).yourNewField.forEach(c => existingYourGates.add(c));
       }
   }
   
   const allYourGates = [...new Set([...yourPendingInColumn, ...existingYourGates])];
   ```

5. **Initialize new field in created operations**:
   ```ts
   const unitaryOp: UnitaryOperation = {
       // ... existing fields ...
       yourNewField: allYourGates,  // ADD THIS
   };
   ```

6. **Update all call sites** of `_dropPaletteGate()`:
   - Line 145 (ghost wire drop)
   - Line 176 (palette drop)
   - Line 338 (double-click)
   
   Add the new pending map to all calls:
   ```ts
   const yourPending = get(pendingYourGates);
   _dropPaletteGate(gateType, col, qubit, ir, pending, antiPending, yourPending);
   ```

7. **Add to double-click valid gates** (line 331):
   ```ts
   const valid = ['X', 'Y', 'Z', 'H', 'S', 'T', 'CONTROL', 'ANTI_CONTROL', 'MEASURE', 'YOUR_GATE'];
   ```

---

### Step 4: Render in Circuit

**File:** `src/components/CircuitLayout/WireDropeZone.svelte`

**What to do:**

1. **Import pending store** (line 6):
   ```ts
   import {
       // ... existing imports ...
       pendingYourGates
   } from '$lib/dragDropUtils';
   ```

2. **Add to connector drawing** (in `recomputeConnectors()` function, line 45):
   - If your gate needs visual connectors to show relationships:
   ```ts
   // Draw connector from each your-gate to this target
   for (const yourGate of unitOp.yourNewField) {
       const yourGateEl = boardEl.querySelector(
           `[data-col="${unitOp.column}"][data-qubit="${yourGate}"][data-type="YOUR_GATE"]`
       );
       if (!yourGateEl) continue;

       const c = getCenter(yourGateEl, boardRect);

       next.push({
           key: `${unitOp.id}-yourgate-${yourGate}-${targetQubit}`,
           left: c.x,
           top: Math.min(c.y, t.y),
           height: Math.abs(c.y, t.y)
       });
   }
   ```

3. **Add to hasGatesOnWire check** (line 135):
   ```ts
   function hasGatesOnWire(qubitIndex: number) {
       return $circuitIR.operations.some((op) => {
           if ('targets' in op && (op.targets as number[]).includes(qubitIndex)) return true;
           if (op.kind === 'unitary') {
               const unitOp = op as UnitaryOperation;
               if (unitOp.controls.includes(qubitIndex)) return true;
               if (unitOp.antiControls.includes(qubitIndex)) return true;
               if (unitOp.yourNewField.includes(qubitIndex)) return true;  // ADD THIS
           }
           return false;
       });
   }
   ```

4. **Add to qubit removal remapping** (line 147):
   ```ts
   if (op.kind === 'unitary') {
       return {
           ...op,
           targets: remapQubits((op as UnitaryOperation).targets),
           controls: remapQubits((op as UnitaryOperation).controls),
           antiControls: remapQubits((op as UnitaryOperation).antiControls),
           yourNewField: remapQubits((op as UnitaryOperation).yourNewField),  // ADD THIS
       };
   }
   ```

5. **Render attached gate** (line 247, inside the operations loop):
   ```ts
   {#if gate.yourNewField.includes(wire.qubit)}
       <div
           data-gate-id={gate.id}
           data-col={gate.column}
           data-qubit={wire.qubit}
           data-type="YOUR_GATE"
           role="button"
           aria-label="Your gate"
           tabindex="0"
           draggable="true"
           on:dragstart={(e) => handleGateDragStart(e, gate.id)}
           on:dragend={() => isDragging.set(false)}
           on:keydown={(e) => e.key === 'Delete' && removeGate(gate.id)}
           on:dblclick={() => handleDoubleClick({ source: 'wire', gateId: gate.id })}
           on:touchstart={(e) =>
               handleTouchStart(e, { source: 'wire', gateId: gate.id, gateType: 'YOUR_GATE' })}
           on:touchmove={handleTouchMove}
           on:touchend={handleTouchEnd}
           class="gate z-10 cursor-grab select-none rounded-sm h-11 w-10 text-base border bg-YOUR_COLOR-400 hover:bg-YOUR_COLOR-500 active:bg-YOUR_COLOR-600 border-YOUR_COLOR-500 active:text-white active:border-white shadow transition-colors duration-100 flex items-center justify-center"
           style="left: {gateOffset + (gate.column + 0.5) * columnWidth}px;"
       >
           <div class="w-3 h-3 rounded-full bg-YOUR_COLOR-700"></div>
       </div>
   {/if}
   ```

6. **Render pending gate** (after pending controls, around line 404):
   ```ts
   <!-- Pending your-gate boxes -->
   {#each Array.from($pendingYourGates.entries()) as [col, qubits]}
       {#each qubits as yourQubit}
           {#if yourQubit === wire.qubit}
               <div
                   data-col={col}
                   data-qubit={yourQubit}
                   data-type="YOUR_GATE"
                   role="button"
                   aria-label="Pending your-gate"
                   tabindex="0"
                   on:keydown={(e) => e.key === 'Delete' && pendingYourGates.update(map => {
                       const next = new Map(map);
                       const qubits = next.get(col) ?? [];
                       next.set(col, qubits.filter(q => q !== yourQubit));
                       if (next.get(col)?.length === 0) next.delete(col);
                       return next;
                   })}
                   class="gate z-10 select-none rounded-sm h-11 w-10 py-3 text-base border bg-YOUR_PENDING_COLOR-200 hover:bg-YOUR_PENDING_COLOR-300 border-YOUR_PENDING_COLOR-400 shadow transition-colors duration-100 opacity-75 flex items-center justify-center"
                   style="left: {gateOffset + (col + 0.5) * columnWidth}px;"
               >
                   <div class="w-3 h-3 rounded-full border border-YOUR_PENDING_COLOR-600"></div>
               </div>
           {/if}
       {/each}
   {/each}
   ```

---

### Step 5: (Optional) Handle Simulation

**File:** `src/lib/simulator.ts`

**When needed:** Only if your gate requires special simulation logic beyond standard unitary gates.

#### For Standard Unitary Gates (X, Y, Z, H, S, T, etc.)

No simulator changes needed—the framework automatically handles:
- Uncontrolled gates via `extendGateMatrix()`
- Controlled gates (controls only) via `computeMultiControlledUMatrix()`
- Controlled + anti-controlled gates via `computeMultiControlledUMatrixWithAntiControls()`

The gate just needs to be defined in `src/lib/quantum/gates.ts` with its matrix.

#### For Custom Unitary Gates with Controls/Anti-Controls

The simulator automatically applies your gate when:
- **No controls or anti-controls:** Always applies to target
- **Only controls:** Applies when all control qubits are |1⟩
- **With anti-controls:** Applies when all controls are |1⟩ AND all anti-controls are |0⟩

**Example:** A gate with `controls: [0]` and `antiControls: [1]` on `targets: [2]` applies the operation only when qubit 0 is |1⟩ AND qubit 1 is |0⟩.

#### For Non-Unitary Gates (Measurement, Reset, Custom Operations)

Add special handling in `simulateMultipleQubits()`:

```ts
if (op.kind === 'your_gate') {
    // Custom simulation logic here
    // Access: op.targets, op.column, op.gate, etc.
    // Modify: state, measuredQubits, classicalBits
    
    // Example: measurement operation
    const outcome = collapseQubit(state, op.targets[0], numQubits);
    state = outcome.newState;
    classicalBits.set(op.targets[0], outcome.outcome);
}
```

#### Key Simulator Components

- **`collapseQubit()`** — Collapses a single qubit and returns outcome (0 or 1)
- **`extendGateMatrix()`** — Creates full matrix for single-qubit uncontrolled gate
- **`computeMultiControlledUMatrix()`** — Creates matrix for gates with controls only
- **`computeMultiControlledUMatrixWithAntiControls()`** — Creates matrix for gates with controls and/or anti-controls
- **`applyMatrix()`** — Applies unitary matrix to quantum state

---

## Checklist

Use this checklist when adding a new gate:

- [ ] **Schema.ts**
  - [ ] Add gate type to `CanonicalUnitaryGate` or create new operation interface
  - [ ] Add gate to `CircuitOperation` union if creating new operation type
  - [ ] Define any new fields on the operation

- [ ] **GatePalette.svelte**
  - [ ] Add gate to `gates` array with type, name, and category
  - [ ] Update gate type check for size/styling
  - [ ] Add rendering logic for gate icon/symbol

- [ ] **dragDropUtils.ts**
  - [ ] Create `pendingXxx` store if needed (for control-based gates)
  - [ ] Add drop handler in `_dropPaletteGate()`
  - [ ] Update function signature with new pending map
  - [ ] Update standard gate drop logic to collect pending/existing gates
  - [ ] Initialize field in created operations
  - [ ] Update all `_dropPaletteGate()` call sites (3 locations: ghost wire, palette, double-click)
  - [ ] Add to double-click valid gates
  - [ ] **For control-based gates:** Handle both controls and anti-controls in attachment logic

- [ ] **WireDropeZone.svelte**
  - [ ] Import pending store if applicable
  - [ ] Update `recomputeConnectors()` if connectors needed
  - [ ] Update `hasGatesOnWire()` check
  - [ ] Update qubit removal remapping
  - [ ] Add rendering for attached gate instances
  - [ ] Add rendering for pending gate instances

- [ ] **simulator.ts** (if needed)
  - [ ] Add simulation logic for your gate

---

## Example: Complete Gate Addition

Here's a minimal example of adding a hypothetical `RX` (rotation around X-axis) gate:

### 1. Schema
```ts
export type CanonicalUnitaryGate = 'x' | 'y' | 'z' | 'h' | 's' | 't' | 'rx';

export interface UnitaryOperation extends BaseOperation {
    kind: 'unitary';
    gate: CanonicalUnitaryGate;
    targets: number[];
    controls: number[];
    antiControls: number[];
    params: number[];  // rx has angle parameter
}
```

### 2. GatePalette
```ts
{ type: 'RX', name: 'RX(θ)', category: 'single' },

// In gate type check:
['CONTROL', 'ANTI_CONTROL', 'MEASURE', 'RX'].includes(gate.type)

// In rendering:
{:else if gate.type === 'RX'}
    <span class="text-secondary-4 text-xs font-semibold">RX</span>
```

### 3. dragDropUtils (standard gate - no special drop handler needed)
```ts
// RX will be handled by standard unitary gate logic
// Just make sure it's lowercase in canonicalGate function
```

### 4. WireDropeZone
```ts
// Standard rendering - will work automatically for unitary gates
// No special connectors needed for RX (no control/anti-control field)
```

### 5. Simulator
```ts
// Add case for 'rx' in simulation logic
case 'rx':
    // Apply RX rotation with params[0] as angle
    break;
```

---

## Advanced: Control-Based Gate Architecture

If you're adding control-based gates (like CONTROL, ANTI_CONTROL, or custom conditional gates), understand this architecture:

### Controls vs Anti-Controls

**Controls** (`UnitaryOperation.controls`):
- Gate applies when control qubit is in |1⟩ state
- Example: Regular controlled-X (CNOT) gate

**Anti-Controls** (`UnitaryOperation.antiControls`):
- Gate applies when anti-control qubit is in |0⟩ state
- Example: Conditional gate that only executes if qubit is NOT measured as 1

### Pending State Flow

1. **User drops CONTROL on empty column:**
   - Added to `pendingControls` map (UI-only, not yet in IR)
   - Renders as yellow dot with distinct styling

2. **User then drops unitary gate (X/Y/Z/H/S/T) in same column:**
   - Standard gate creation collects pending controls
   - Creates `UnitaryOperation` with `controls: [pendingQubits]`
   - Pending controls automatically cleared from map

3. **Alternatively, user drops unitary gate, then CONTROL in same column:**
   - CONTROL handler finds existing unitary ops in column
   - Directly attaches control to all of them via `updateOperation`
   - No pending state involved

### Important: Handling Both Controls and Anti-Controls

When adding control-based gates:

1. **In Schema**: Define field as `number[]` array
2. **In DragDropUtils**: 
   - Create separate pending store for each control type
   - In standard gate drop, collect BOTH controls and anti-controls separately
   - Initialize field in new `UnitaryOperation` with collected values
3. **In Simulator**: 
   - For unitary gates: `computeMultiControlledUMatrixWithAntiControls` handles both
   - Automatically checks: all controls are 1 AND all anti-controls are 0
4. **In WireDropeZone**:
   - Render control and anti-control as separate visual elements
   - Update `hasGatesOnWire()` to check both fields
   - Update `removeQubitWire()` to remap both fields

### Example: Adding NEGATION (gate applies when qubit is |0⟩)

This would work identically to ANTI_CONTROL:
1. Add `antiControls: number[]` to schema (already done)
2. Create `pendingNegations` store
3. In `_dropPaletteGate()`, attach to `antiControls[]` just like ANTI_CONTROL
4. In `WireDropeZone`, render with same visual style
5. Simulator automatically handles via existing `computeMultiControlledUMatrixWithAntiControls`

---

## Tips & Best Practices

1. **Color Coding**: Use consistent color schemes for gate families:
   - Single-qubit gates: Blue/secondary colors
   - Control-based gates: Purple/secondary with variations
   - Measurement: Orange
   - New families: Choose distinct colors

2. **Icons**: Use `@iconify/svelte` for standard quantum gate symbols
   - Search at https://iconify.design/

3. **Styling Classes**: Reuse Tailwind classes from existing gates for consistency
   - Background: `bg-COLOR-100` → `bg-COLOR-400` (gradient)
   - Borders: `border-COLOR-300` → `border-COLOR-500`
   - Hover/Active: `hover:bg-COLOR-200`, `active:bg-COLOR-400`

4. **Testing Workflow**:
   - Drop gate from palette → verify it appears
   - Drop control/anti-control → verify attachment
   - Drag gate → verify movement
   - Delete gate → verify removal
   - Drag qubit off → verify remapping
   - Import/export circuit → verify persistence

5. **Keyboard Support**:
   - Delete key: `on:keydown={(e) => e.key === 'Delete' && removeGate(id)}`
   - Focus management: Use `tabindex="0"` on interactive elements

---

## Common Pitfalls

- **Forgetting pending store initialization**: Every control-like gate needs a pending store
- **Missing simulator logic**: Non-standard gates (non-unitary) will fail simulation without handlers
- **Incorrect qubit remapping**: Always update new fields in `removeQubitWire()`
- **Inconsistent data types**: Ensure `number[]` vs `number` consistency
- **Forgetting call site updates**: Easy to miss updating `_dropPaletteGate()` calls
- **Style inconsistency**: Use existing color/sizing patterns for visual coherence
- **Anti-control semantics**: Remember anti-control applies gate when qubit is |0⟩, not |1⟩
- **Missing anti-control support**: Control-based gates must update `antiControls` field in schema and dragDropUtils
- **Simulator auto-handling**: Unitary gates with controls/anti-controls work automatically—don't duplicate logic in simulator

---

## Questions?

If you encounter issues:
1. Check the examples (CONTROL, ANTI_CONTROL, MEASURE)
2. Verify all 5+ file changes are complete
3. Look for TypeScript compilation errors
4. Test the full workflow: palette → drop → move → delete

