import type { GateType } from "./stores";
// Define the type for the drag data
// This is used to transfer data during drag-and-drop operations
export interface DragData {
    source: 'palette' | 'wire';
    gateType?: string; // Present if source is 'palette'
    gateId?: string; // Present if source is 'wire'
}

export const gates: { type: GateType; name: string }[] = [
    { type: 'X', name: 'X Gate' },
    { type: 'Y', name: 'Y Gate' },
    { type: 'Z', name: 'Z Gate' },
    { type: 'H', name: 'H Gate' },
    { type: 'S', name: 'S Gate' },
    { type: 'T', name: 'T Gate' }
]
