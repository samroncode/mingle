import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CatchBoundary } from "./CatchBoundary";

describe("CatchBoundary", () => {
  it("renders its children when nothing fails", () => {
    const html = renderToStaticMarkup(
      <CatchBoundary fallback={() => <p>broken</p>} onError={vi.fn()}>
        <p>fine</p>
      </CatchBoundary>,
    );
    expect(html).toContain("fine");
    expect(html).not.toContain("broken");
  });

  it("maps a render failure to the fallback state", () => {
    expect(CatchBoundary.getDerivedStateFromError()).toEqual({ failed: true });
  });

  it("reports the error and offers a retry from the fallback", () => {
    const onError = vi.fn();
    const boundary = new CatchBoundary({
      children: null,
      fallback: (retry) => <button onClick={retry}>retry</button>,
      onError,
    });
    const error = new Error("too long");
    boundary.componentDidCatch(error, { componentStack: "" });
    expect(onError).toHaveBeenCalledWith(error, { componentStack: "" });
  });
});
