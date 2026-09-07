import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";

/**
 * A dropdown that opens below the field.
 *
 * ---------------------------------------------------------------------------
 * Why this exists next to Select
 * ---------------------------------------------------------------------------
 * Select renders a native <select>, which is the right default nearly
 * everywhere: real keyboard behaviour, typeahead, and the platform's own
 * control on a phone, all for free and all things a hand-rolled listbox has to
 * earn back.
 *
 * What a native select does NOT give is control over where its menu appears.
 * macOS draws it as an overlay aligned so the CHOSEN option sits on top of the
 * control — so on a field near the top of a panel the menu covers the fields
 * above it, which is what it looked like was happening on the rule book field.
 * No amount of CSS moves it; the popup is drawn by the OS, not the page.
 *
 * So: used where the menu's position matters, or where the list needs headings
 * or an action at the bottom. Select stays the default for everything else.
 */

export type PickerOption = { value: string; label: string; hint?: string };
export type PickerGroup = { label: string; options: PickerOption[] };

type Props = {
  label: string;
  hint?: string;
  value: string;
  groups: PickerGroup[];
  onChange: (value: string) => void;
  /** A row at the bottom of the menu, for "add a new one". */
  action?: { label: string; onSelect: () => void };
  placeholder?: string;
};

export function Picker({
  label,
  hint,
  value,
  groups,
  onChange,
  action,
  placeholder,
}: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  /** Which row the keyboard is on. -1 means the action row, when there is one. */
  const [cursor, setCursor] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  /*
   * Where to draw the menu, in viewport coordinates.
   *
   * Needed because the menu is drawn through a portal rather than inside this
   * component — see the comment on the portal below — so it cannot inherit its
   * position from the field. Null while closed.
   */
  const [at, setAt] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const flat = groups.flatMap((g) => g.options);
  const chosen = flat.find((o) => o.value === value);

  /*
   * Closing on a click anywhere else, and on Escape.
   *
   * Bound to the document rather than a blur handler on the button: a click
   * lands on the menu itself before any blur resolves, so blur-to-close eats
   * the first click on every option.
   */
  useEffect(() => {
    if (!open) return;

    function onDocClick(event: MouseEvent) {
      const target = event.target as Node;
      /*
       * Both, because the menu is no longer a descendant of the field. Testing
       * only the field would close the menu on the first click on any option.
       */
      if (box.current?.contains(target) || menu.current?.contains(target))
        return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /*
   * Focused once when it opens, and explicitly WITHOUT the browser scrolling
   * to it.
   *
   * This was a callback ref calling focus() directly, which fires on every
   * render — so the menu was re-focused constantly, and each focus made the
   * browser scroll its nearest scrollable ancestor to bring the menu into
   * view. Opening the dropdown jumped the whole page upward and cut the top of
   * the panel off. The keyboard still needs focus here, so the fix is
   * preventScroll rather than not focusing.
   */
  useEffect(() => {
    if (!open) return;
    menu.current?.focus({ preventScroll: true });
  }, [open]);

  /*
   * Measured from the field, and re-measured while it is open.
   *
   * Height comes from the room actually left below the field rather than a
   * fixed number: pinned below is the whole point of this component, but a
   * fixed height means a field low on the screen opens a menu that runs off
   * the bottom of the window — the same "cannot see the options" problem in
   * the other direction. The floor is 160px, because below that a menu is not
   * usable and one that needs a little scrolling beats one squeezed to two
   * rows.
   */
  const measure = useCallback(() => {
    const field = box.current?.getBoundingClientRect();
    if (!field) return;
    setAt({
      left: field.left,
      /* 4px, matching the mt-1 this replaced. */
      top: field.bottom + 4,
      width: field.width,
      /* 12px so it never sits flush against the bottom edge. */
      maxHeight: Math.max(160, window.innerHeight - field.bottom - 16),
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setAt(null);
      return;
    }
    measure();

    /*
     * A fixed-position menu does not travel with the page, so scrolling would
     * leave it hanging over the wrong field. Re-measured on scroll and resize
     * rather than closed, because closing a menu somebody is reading — perhaps
     * having scrolled deliberately to reach the bottom of a long list — is the
     * more annoying of the two.
     *
     * capture: true so it also fires for scrolling inside any container, not
     * only the window.
     */
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, measure]);

  function choose(next: string) {
    onChange(next);
    setOpen(false);
  }

  function onButtonKey(event: React.KeyboardEvent) {
    if (
      event.key === "ArrowDown" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setCursor(
          Math.max(
            0,
            flat.findIndex((o) => o.value === value),
          ),
        );
      }
    }
  }

  function onMenuKey(event: React.KeyboardEvent) {
    const lowest = action ? -1 : 0;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => (c >= flat.length - 1 ? lowest : c + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => (c <= lowest ? flat.length - 1 : c - 1));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (cursor === -1 && action) {
        setOpen(false);
        action.onSelect();
      } else if (flat[cursor]) {
        choose(flat[cursor].value);
      }
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  let index = -1;

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-[13px] font-medium text-ink">
        {label}
      </span>

      <div ref={box} className="relative">
        <button
          type="button"
          id={id}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={`${id}-label`}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={onButtonKey}
          className={cn(
            "flex h-9.5 w-full items-center justify-between gap-2 rounded-[6px] border px-3 text-left text-sm",
            open ? "border-accent" : "border-line-strong hover:border-ink-4",
            "bg-surface text-ink",
          )}
        >
          <span className={cn("truncate", !chosen && "text-ink-4")}>
            {chosen?.label ?? placeholder ?? ""}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className={cn(
              "shrink-0 text-ink-3 transition-transform",
              open && "rotate-180",
            )}
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {/*
          Drawn through a portal, on purpose.
 
          Panel — like most cards in this console — sets overflow-hidden so its
          header and tables sit inside its rounded corners. An absolutely
          positioned menu inside that panel gets CLIPPED by it: the dropdown
          appeared as a two-line sliver cut off at the panel's bottom edge.
 
          Taking overflow-hidden off Panel would fix this one dropdown and
          spoil the corners of every panel in the console. A portal escapes the
          clip — and every other ancestor with an overflow, a transform or a
          filter, all of which do the same thing — at the cost of positioning
          the menu by hand, which is what `at` is for.
        */}
        {open &&
          at &&
          createPortal(
            <div
              className="fixed z-50 overflow-y-auto rounded-[8px] border border-line-strong bg-surface py-1 shadow-lg"
              style={{
                left: at.left,
                top: at.top,
                width: at.width,
                maxHeight: at.maxHeight,
              }}
              role="listbox"
              aria-labelledby={`${id}-label`}
              tabIndex={-1}
              // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role
              onKeyDown={onMenuKey}
              ref={menu}
            >
              {groups.map((group) => (
                <div key={group.label}>
                  {/*
                  A heading only when there is more than one group AND this
                  group is named. "Not chosen yet" sits in its own unnamed
                  group so it is not filed under a heading that would make it
                  look like one of the legal rule books.
                */}
                  {groups.length > 1 && group.label !== "" && (
                    <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-4">
                      {group.label}
                    </p>
                  )}
                  {group.options.map((option) => {
                    index += 1;
                    const at = index;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={option.value === value}
                        onMouseEnter={() => setCursor(at)}
                        onClick={() => choose(option.value)}
                        className={cn(
                          "block w-full px-3 py-1.5 text-left text-[13.5px]",
                          cursor === at ? "bg-surface-2" : "",
                          option.value === value
                            ? "font-medium text-accent"
                            : "text-ink",
                        )}
                      >
                        {option.label}
                        {option.hint && (
                          <span className="block text-[12px] text-ink-3">
                            {option.hint}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}

              {action && (
                <div className="mt-1 border-t border-line pt-1">
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(-1)}
                    onClick={() => {
                      setOpen(false);
                      action.onSelect();
                    }}
                    className={cn(
                      "block w-full px-3 py-1.5 text-left text-[13.5px] font-medium text-accent",
                      cursor === -1 ? "bg-surface-2" : "",
                    )}
                  >
                    {action.label}
                  </button>
                </div>
              )}
            </div>,
            document.body,
          )}
      </div>

      {hint && <p className="text-[13px] text-ink-3">{hint}</p>}
    </div>
  );
}
