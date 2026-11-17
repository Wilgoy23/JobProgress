export default function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            onDismiss();
            toast.action.onClick();
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
