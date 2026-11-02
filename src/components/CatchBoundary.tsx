import { Component, type ErrorInfo, type ReactNode } from "react";

interface CatchBoundaryProps {
  children: ReactNode;
  /** What to show instead after a render failure; `retry` tries again. */
  fallback: (retry: () => void) => ReactNode;
  /** Runs once per failure, e.g. to log it. Must not throw. */
  onError: (error: Error, info: ErrorInfo) => void;
}

/** Catches a render failure in one part of a view so the rest keeps working. */
export class CatchBoundary extends Component<
  CatchBoundaryProps,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError(error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return this.props.fallback(() => this.setState({ failed: false }));
  }
}
