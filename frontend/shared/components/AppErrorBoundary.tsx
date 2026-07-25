import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  failed: boolean;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Patient portal render failure', error, info.componentStack);
  }

  private recover = () => {
    this.setState({ failed: false });
    window.location.assign('/home');
  };

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="app-error-boundary" role="alert">
        <section>
          <span>Patient portal</span>
          <h1>This page could not be displayed</h1>
          <p>Your session is still safe. Return to the portal home and try the action again.</p>
          <div>
            <button type="button" onClick={this.recover}>Return to portal home</button>
            <button type="button" onClick={() => window.location.reload()}>Reload page</button>
          </div>
        </section>
      </main>
    );
  }
}
