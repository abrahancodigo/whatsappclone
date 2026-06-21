"use client";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <div className="text-4xl">⚠️</div>
      <h2 className="text-xl font-semibold text-[var(--color-tx-primary)]">
        Algo salió mal
      </h2>
      <p className="max-w-md text-center text-sm text-[var(--color-tx-secondary)]">
        {error.message || "Error desconocido"}
      </p>
      {error.digest && (
        <p className="text-xs text-[var(--color-tx-tertiary)]">
          ID: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        className="rounded-md bg-[var(--color-wa-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-wa-green-dark)]"
      >
        Reintentar
      </button>
    </div>
  );
}
