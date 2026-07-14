import React from 'react';

interface ModalErrorBoundaryProps {
  onClose: () => void;
  children: React.ReactNode;
}

interface ModalErrorBoundaryState {
  error: string | null;
}

class ModalErrorBoundary extends React.Component<ModalErrorBoundaryProps, ModalErrorBoundaryState> {
  state: ModalErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ModalErrorBoundaryState {
    return { error: error instanceof Error ? error.message : '弹窗渲染失败' };
  }

  componentDidCatch(error: unknown) {
    console.error('Modal render failed', error);
  }

  componentDidUpdate(prevProps: ModalErrorBoundaryProps) {
    if (prevProps.children !== this.props.children && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border border-red-200 dark:border-red-800 bg-white dark:bg-slate-800 p-6 shadow-2xl">
          <h3 className="text-base font-semibold text-red-600 dark:text-red-400">弹窗打开失败</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 break-words">{this.state.error}</p>
          <button
            onClick={() => { this.setState({ error: null }); this.props.onClose(); }}
            className="mt-4 px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700"
          >
            关闭
          </button>
        </div>
      </div>
    );
  }
}

export default ModalErrorBoundary;
