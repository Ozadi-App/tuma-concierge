"use client";

import { Select as BaseSelect } from "@peebee/shared/select";
import { Check, ChevronDown, Search } from "lucide-react";
import { Children, Fragment, isValidElement, useEffect, useId, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";

type OptionProps = { value?: string | number; children?: ReactNode; disabled?: boolean; label?: string };
type Option = { value: string; label: ReactNode; text: string; disabled?: boolean };

function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

function optionsFrom(children: ReactNode): Option[] {
  const out: Option[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<OptionProps>(child)) return;
    if (child.type === Fragment) out.push(...optionsFrom(child.props.children));
    else if (child.type === "option") {
      const label = child.props.label ?? child.props.children;
      out.push({ value: String(child.props.value ?? textOf(child.props.children)), label, text: textOf(label), disabled: child.props.disabled });
    }
  });
  return out;
}

/** Lists longer than this get a search box. */
const SEARCH_THRESHOLD = 8;

type Props = ComponentProps<typeof BaseSelect>;

/**
 * Admin dropdown. Short lists use the shared themed Radix select (keyboard,
 * typeahead, portalled menu); long lists get a searchable listbox. Same API:
 * `<Select value onValueChange><option …/></Select>`.
 */
export function Select(props: Props) {
  const options = useMemo(() => optionsFrom(props.children), [props.children]);
  if (options.length > SEARCH_THRESHOLD) return <SearchSelect {...props} options={options} />;
  return <BaseSelect sizing="stretch" {...props} />;
}

function SearchSelect({ options, value, defaultValue, onValueChange, name, required, disabled, className = "", id, ...rest }: Props & { options: Option[] }) {
  const [local, setLocal] = useState(String(defaultValue ?? options[0]?.value ?? ""));
  const selected = value === undefined ? local : String(value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLSpanElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const filtered = options.filter((o) => !query.trim() || o.text.toLowerCase().includes(query.trim().toLowerCase()));
  const current = options.find((o) => o.value === selected);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.value === selected)));
    requestAnimationFrame(() => input.current?.focus());
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function choose(o: Option | undefined) {
    if (!o || o.disabled) return;
    if (value === undefined) setLocal(o.value);
    onValueChange?.(o.value);
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <span ref={root} className="pb-combo">
      {name && <input type="hidden" name={name} value={selected} required={required} />}
      <button
        ref={trigger}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={rest["aria-label"]}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setOpen(true); } }}
        className={`peebee-select-trigger ${className}`}
        data-sizing="stretch"
      >
        <span className="peebee-select-value">{current?.label ?? "Select…"}</span>
        <ChevronDown className="peebee-select-chevron h-4 w-4" aria-hidden />
      </button>
      {open && (
        <span className="pb-combo-menu peebee-select-menu" role="presentation">
          <span className="pb-combo-search">
            <Search className="h-4 w-4 text-ink-500" aria-hidden />
            <input
              ref={input}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(filtered.length - 1, a + 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
                else if (e.key === "Enter") { e.preventDefault(); choose(filtered[active]); }
                else if (e.key === "Escape") { e.preventDefault(); setOpen(false); trigger.current?.focus(); }
              }}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
              aria-label="Search options"
              placeholder="Search…"
            />
          </span>
          <ul id={listId} role="listbox" className="pb-combo-list">
            {filtered.length === 0 && <li className="px-3 py-2 text-sm text-ink-500">No matches</li>}
            {filtered.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={o.value === selected}
                aria-disabled={o.disabled || undefined}
                data-active={i === active || undefined}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(o)}
                className="peebee-select-option pb-combo-option"
              >
                <span className="min-w-0 truncate">{o.label}</span>
                {o.value === selected && <Check className="h-4 w-4 shrink-0 text-gold" aria-hidden />}
              </li>
            ))}
          </ul>
        </span>
      )}
    </span>
  );
}
