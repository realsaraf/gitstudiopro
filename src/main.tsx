import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import { App } from './App';
import './styles.css';
class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { error: string }
> {
  state = { error: '' };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>The workspace could not render</h1>
        <p>{this.state.error}</p>
        <button
          onClick={() => {
            localStorage.clear();
            location.reload();
          }}
        >
          Reset local preferences and reload
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
