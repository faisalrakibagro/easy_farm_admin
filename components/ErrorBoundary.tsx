'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
          <div className="bg-white rounded-2xl shadow p-8 max-w-md w-full text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">কিছু একটা সমস্যা হয়েছে · Something went wrong</h2>
            <p className="text-sm text-slate-500 mb-6">
              পেজটি লোড করতে ব্যর্থ হয়েছে। পুনরায় চেষ্টা করুন।
              <br />
              The page failed to load. Please try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
            >
              পেজ রিলোড করুন · Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
