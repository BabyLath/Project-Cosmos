export function FormError({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="mb-4 rounded-lg border border-oms-danger/40 bg-oms-danger/10 px-3.5 py-2.5 text-sm text-oms-danger"
    >
      {message}
    </div>
  );
}
