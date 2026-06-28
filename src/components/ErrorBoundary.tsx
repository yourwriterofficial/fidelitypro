import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; message: string; }

/**
 * App-wide error boundary. Previously an unhandled render error (or a page that
 * threw after a 403/expired-session response) left the user staring at a broken
 * screen with no way to navigate "back or forward". This catches the error and
 * always offers recovery actions so the user is never stuck.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Something went wrong.',
    };
  }

  componentDidCatch(error: unknown) {
    console.error('Uncaught render error:', error);
  }

  private handleReload = () => {
    this.setState({ hasError: false, message: '' });
    window.location.reload();
  };

  private handleHome = () => {
    this.setState({ hasError: false, message: '' });
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} className="text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Something went wrong</h1>
          <p className="text-gray-500 text-sm mt-2 break-words">{this.state.message}</p>
          <div className="mt-6 flex gap-3 justify-center">
            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-dark text-white text-sm font-semibold rounded-xl transition"
            >
              <RefreshCw size={15} /> Reload
            </button>
            <button
              onClick={this.handleHome}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition"
            >
              <Home size={15} /> Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
