// Whether the key press happened while the user was typing in a text box.
//
// Board shortcuts listen on the whole document, so without this check they also
// fire while the user edits the circuit name, a qubit label or a gate angle.
// Delete would then remove the selected gates instead of a character, and
// Ctrl+Z would undo a gate placement instead of the typing.
export function isTypingTarget(event: Event): boolean {
	const target = event.target as HTMLElement | null;
	if (!target) return false;
	if (target.isContentEditable) return true;
	const tag = target.tagName;
	return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
