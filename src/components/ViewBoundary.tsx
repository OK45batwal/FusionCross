import { Component, type ReactNode } from "react";

export class ViewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div role="alert" className="p-6 space-y-3">
      <p>This screen could not load. You can switch screens or reload FusionCross.</p>
      <button className="underline" onClick={() => window.location.reload()}>Reload application</button>
    </div> : this.props.children;
  }
}
