import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div className="font-pixel text-px-lg text-aic-red mb-4">SYSTEM ERROR</div>
          <div className="font-pixel text-px-sm text-aic-text-dim mb-6 max-w-md">
            {this.state.error?.message ?? 'An unexpected error occurred'}
          </div>
          <button
            onClick={this.handleRetry}
            className="font-pixel text-px-sm px-4 py-2 bg-aic-accent text-aic-bg-dark hover:opacity-80 transition-opacity"
          >
            RETRY
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
