"use client";

import { useEffect, useImperativeHandle, useRef, type ClipboardEvent, type KeyboardEvent, type Ref } from "react";
import { cn } from "@/lib/utils";

export type OtpInputHandle = { focus: () => void };

/**
 * A 6-digit code as six single-digit boxes (spec 8.31). Typing moves to the
 * next box, Backspace on an empty box goes back, a pasted or autofilled code
 * fills every box. `onComplete` fires once, when the last digit goes in.
 */
export function OtpInput({
  ref,
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  invalid,
  labelledBy,
  describedBy,
}: {
  ref?: Ref<OtpInputHandle>;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  labelledBy?: string;
  describedBy?: string;
}) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");
  /** How many digits are in, updated before focus moves (the new value renders a moment later). */
  const filled = useRef(value.length);
  useEffect(() => {
    filled.current = value.length;
  }, [value]);

  const set = (v: string) => {
    filled.current = v.length;
    onChange(v);
  };

  const focusAt = (i: number) => {
    const el = boxes.current[Math.max(0, Math.min(length - 1, i))];
    el?.focus();
    el?.select();
  };

  useImperativeHandle(ref, () => ({ focus: () => focusAt(Math.min(value.length, length - 1)) }));

  /** Writes digits starting at box `at`; returns the new value. */
  const put = (at: number, typed: string) => {
    const clean = typed.replace(/\D/g, "");
    if (!clean) return;
    // a full code (paste or autofill) always starts at the first box
    const start = clean.length >= length ? 0 : at;
    const arr = digits.slice();
    for (let k = 0; k < clean.length && start + k < length; k++) arr[start + k] = clean[k]!;
    // keep the code contiguous: no gaps before the last filled box
    const firstGap = arr.indexOf("");
    const nextValue = (firstGap === -1 ? arr : arr.slice(0, firstGap)).join("");
    set(nextValue);
    if (nextValue.length === length) {
      boxes.current[length - 1]?.focus();
      onComplete?.(nextValue);
    } else focusAt(Math.min(start + clean.length, nextValue.length));
  };

  const onKeyDown = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) set(value.slice(0, i) + value.slice(i + 1));
      else if (i > 0) {
        set(value.slice(0, i - 1));
        focusAt(i - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusAt(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusAt(Math.min(i + 1, filled.current));
    }
  };

  const onPaste = (i: number) => (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    put(i, e.clipboardData.getData("text"));
  };

  return (
    <div role="group" aria-labelledby={labelledBy} aria-describedby={describedBy} className="grid grid-cols-6 gap-2 short:gap-1.5">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          data-otp-box={i}
          // only the first box takes the autofilled code; it spreads over all six
          autoComplete={i === 0 ? "one-time-code" : "off"}
          name={i === 0 ? "otp" : undefined}
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          value={d}
          // clicking past the typed digits lands on the next empty box
          onFocus={() => {
            if (i > filled.current) focusAt(filled.current);
          }}
          onChange={(e) => {
            const v = e.target.value;
            // the box held a digit and one more was typed: keep the new one
            put(i, v.length > 1 && v.length < length && d ? v.replace(d, "") || v.slice(-1) : v);
          }}
          onKeyDown={onKeyDown(i)}
          onPaste={onPaste(i)}
          className={cn(
            "si-otp h-14 w-full min-w-0 rounded-[12px] border border-[var(--si-hairline)] bg-[var(--si-input)] text-center font-mono text-[22px] font-semibold tabular text-[var(--si-fg)] outline-none short:h-12",
            "transition-[border-color,box-shadow] duration-150 hover:border-[var(--si-hairline-strong)] focus:border-[var(--si-blue)] focus:shadow-[0_0_0_3px_color-mix(in_oklch,var(--si-blue)_25%,transparent)]",
            "disabled:cursor-not-allowed disabled:opacity-60",
            invalid && "border-[var(--si-danger)]",
          )}
        />
      ))}
    </div>
  );
}
