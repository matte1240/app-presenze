"use client";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-slate-900">You are offline</h1>
        <p className="mb-8 text-lg text-slate-600">
          Please check your internet connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-md bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
