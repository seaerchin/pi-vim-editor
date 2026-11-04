/**
 * The read-only status that a decorated editor publishes for other
 * extensions. See docs/integration.md.
 */

import {
  type Buffer,
  isVisual,
  label,
  type Mode,
  type Pos,
  type State,
  selectedSpans,
  selection,
} from "./engine.js";

/** Where a decorated editor publishes its status: `editor[VIM_EDITOR]`. */
export const VIM_EDITOR = Symbol.for("pi-vim-editor");

export type VimEditorMode =
  | "insert"
  | "normal"
  | "visual"
  | "visual-line"
  | "visual-block"
  | "replace";

/** A Visual selection. Offsets are UTF-16 offsets into `getText()`. */
export type VimEditorSelection = Readonly<{
  kind: "char" | "line" | "block";
  /** The fixed end. */
  anchor: number;
  /** The end that moves with the cursor. */
  head: number;
  /** `block` only: the selected range of each line, top to bottom. */
  spans?: readonly Readonly<{ from: number; to: number }>[];
}>;

export type VimEditorStatus = Readonly<{
  mode: VimEditorMode;
  /** Unfinished command or safely escaped search query; otherwise "". */
  pending: string;
  /** The text of the mode label: `pending` if any, else the mode name. */
  label: string;
  /** The Visual selection, only in a Visual mode. */
  selection?: VimEditorSelection;
}>;

export type VimEditorCapability = Readonly<{
  version: 2;
  /** The current status, computed on every call. */
  status(): VimEditorStatus;
}>;

const MODES: Record<Mode, VimEditorMode> = {
  insert: "insert",
  normal: "normal",
  visual: "visual",
  vline: "visual-line",
  vblock: "visual-block",
  replace: "replace",
};

/** `read` is called only in a Visual mode, for the selection. */
export function statusOf(state: State, read: () => Buffer): VimEditorStatus {
  const selected = isVisual(state.mode)
    ? selectionOf(state, read())
    : undefined;
  return Object.freeze({
    mode: MODES[state.mode],
    pending: state.query ? label(state) : state.keys.join(""),
    label: label(state),
    ...(selected && { selection: selected }),
  });
}

function selectionOf(
  state: State,
  buf: Buffer,
): VimEditorSelection | undefined {
  const range = selection(state, buf);
  if (!range || !state.anchor) return undefined;
  const offset = ({ line, col }: Pos) => {
    let total = col;
    for (let n = 0; n < line; n++) total += buf.lines[n].length + 1;
    return total;
  };
  const cursor = offset(buf.cursor);
  const line = Math.min(state.anchor.line, buf.lines.length - 1);
  const anchor = offset({
    line,
    col: Math.min(state.anchor.col, buf.lines[line].length),
  });
  if (state.mode === "visual") {
    // The ends of the exclusive range, so the character under the cursor and
    // the one under the anchor both count as selected, as Vim shows them.
    const [from, to] = [offset(range.from), offset(range.to)];
    return cursor >= anchor
      ? Object.freeze({ kind: "char", anchor: from, head: to })
      : Object.freeze({ kind: "char", anchor: to, head: from });
  }
  if (state.mode === "vline")
    return Object.freeze({ kind: "line", anchor, head: cursor });
  const spans = selectedSpans(state, buf).map((span) =>
    Object.freeze({
      from: offset({ line: span.line, col: span.start }),
      to: offset({ line: span.line, col: span.end }),
    }),
  );
  return Object.freeze({
    kind: "block",
    anchor,
    head: cursor,
    spans: Object.freeze(spans),
  });
}

/** Publish `status` on `editor`, which marks it as decorated, too. */
export function publish(editor: object, status: () => VimEditorStatus): void {
  const capability: VimEditorCapability = Object.freeze({
    version: 2,
    status,
  });
  // Not writable, enumerable, or configurable.
  Object.defineProperty(editor, VIM_EDITOR, { value: capability });
}
