import { Component, ErrorInfo, ReactNode } from 'react';

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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '50vh', padding: '40px', textAlign: 'center',
        }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--ds-error)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Algo deu errado</h2>
          <p style={{ color: 'var(--ds-text-muted)', marginBottom: '24px', maxWidth: '400px' }}>
            Ocorreu um erro inesperado. Tente recarregar a página.
          </p>
          <button
            className="ds-btn ds-btn-primary"
            onClick={() => window.location.reload()}
          >
            Recarregar Página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
