import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OtpInput } from "./otp-input";

afterEach(cleanup);

function Harness({ onComplete, initial = "" }: { onComplete?: (v: string) => void; initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <OtpInput value={value} onChange={setValue} onComplete={onComplete} />
      <output data-testid="value">{value}</output>
    </>
  );
}

const boxes = () => screen.getAllByRole("textbox") as HTMLInputElement[];
const value = () => screen.getByTestId("value").textContent;

describe("OtpInput", () => {
  it("renders six numeric boxes; only the first takes the autofilled code", () => {
    render(<Harness />);
    const b = boxes();
    expect(b).toHaveLength(6);
    for (const x of b) expect(x.getAttribute("inputmode")).toBe("numeric");
    expect(b[0]!.getAttribute("autocomplete")).toBe("one-time-code");
    expect(b[1]!.getAttribute("autocomplete")).toBe("off");
  });

  it("typing a digit moves to the next box; letters are ignored", () => {
    render(<Harness />);
    fireEvent.change(boxes()[0]!, { target: { value: "4" } });
    expect(value()).toBe("4");
    expect(document.activeElement).toBe(boxes()[1]);
    fireEvent.change(boxes()[1]!, { target: { value: "x" } });
    expect(value()).toBe("4");
  });

  it("paste of a full code fills every box and submits once", () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    fireEvent.paste(boxes()[2]!, { clipboardData: { getData: () => " 123-456 " } });
    expect(value()).toBe("123456");
    expect(boxes().map((b) => b.value)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  it("an autofilled code in the first box spreads over all six", () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    fireEvent.change(boxes()[0]!, { target: { value: "987654" } });
    expect(value()).toBe("987654");
    expect(onComplete).toHaveBeenCalledWith("987654");
  });

  it("submits automatically when the sixth digit is typed", () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    "12345".split("").forEach((d, i) => fireEvent.change(boxes()[i]!, { target: { value: d } }));
    expect(onComplete).not.toHaveBeenCalled();
    fireEvent.change(boxes()[5]!, { target: { value: "6" } });
    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  it("Backspace on an empty box clears the previous one and moves back", () => {
    render(<Harness initial="123" />);
    act(() => boxes()[3]!.focus());
    fireEvent.keyDown(boxes()[3]!, { key: "Backspace" });
    expect(value()).toBe("12");
    expect(document.activeElement).toBe(boxes()[2]);
  });

  it("Backspace on a filled box clears that digit and stays", () => {
    render(<Harness initial="123" />);
    act(() => boxes()[2]!.focus());
    fireEvent.keyDown(boxes()[2]!, { key: "Backspace" });
    expect(value()).toBe("12");
    expect(document.activeElement).toBe(boxes()[2]);
  });

  it("focusing past the typed digits lands on the next empty box", () => {
    render(<Harness initial="12" />);
    act(() => boxes()[5]!.focus());
    expect(document.activeElement).toBe(boxes()[2]);
  });

  it("disabled boxes ignore input", () => {
    render(<OtpInput value="" onChange={() => {}} disabled />);
    for (const b of boxes()) expect(b.disabled).toBe(true);
  });
});
