import React from "react";

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("UI error", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="bg-red-50 border border-red-300 rounded p-4 space-y-3">
          <h2 className="text-lg font-semibold text-red-800">Něco se pokazilo</h2>
          <pre className="text-xs font-mono bg-white border border-red-200 rounded p-2 overflow-auto">
            {this.state.error.message}
          </pre>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={this.reset}>
              Zkusit znovu
            </button>
            <button className="btn-muted" onClick={() => window.location.reload()}>
              Obnovit stránku
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
