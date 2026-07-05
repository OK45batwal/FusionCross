import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex items-center justify-center h-full p-8 text-center">
          <div className="glass-panel p-6 rounded-2xl max-w-md border-red-500/30">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
              <span className="text-red-400 text-xl font-bold">!</span>
            </div>
            <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wide mb-2">Something went wrong</h2>
            <p className="text-xs text-graphite-400 font-mono mb-4">{this.state.error?.message || 'An unexpected error occurred.'}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="btn-primary py-2 px-4 text-xs font-mono"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
