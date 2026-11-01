// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BandError from "../error";

afterEach(cleanup);

describe("BandError", () => {
  it("'다시 시도' asks the error boundary to fetch the band home again", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const retry = vi.fn();
    const reset = vi.fn();
    // The props Next 16.4 hands to error.tsx (next/dist/client/components/error-boundary.js).
    const boundaryProps = { error: new Error("boom"), reset, retry };

    render(<BandError {...boundaryProps} />);
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(retry).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
  });
});
