import React, { useState, useEffect } from 'react';

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'info', duration = 3000) => {
    const id = Date.now();
    const toast = { id, message, type, duration };
    setToasts(prev => [...prev, toast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const success = (message, duration) => showToast(message, 'success', duration);
  const error = (message, duration) => showToast(message, 'error', duration);
  const info = (message, duration) => showToast(message, 'info', duration);
  const warning = (message, duration) => showToast(message, 'warning', duration);

  const ToastContainer = () => (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map(toast => (
        <Toast key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );

  return {
    success,
    error,
    info,
    warning,
    ToastContainer
  };
}

function Toast({ message, type, onClose }) {
  const colors = {
    success: 'bg-green-500 border-green-600',
    error: 'bg-red-500 border-red-600',
    info: 'bg-blue-500 border-blue-600',
    warning: 'bg-orange-500 border-orange-600'
  };

  const icons = {
    success: '✓',
    error: '✗',
    info: 'ℹ',
    warning: '⚠'
  };

  return (
    <div
      className={`${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg border-l-4 pointer-events-auto flex items-center gap-3 min-w-[300px] max-w-md animate-[slideInFromRight_0.3s_ease-out]`}
    >
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center font-bold">
        {icons[type]}
      </div>
      <div className="flex-1 text-sm font-medium whitespace-pre-line">
        {message}
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 w-6 h-6 rounded-full hover:bg-white/20 transition-colors flex items-center justify-center"
        title="Schließen"
      >
        ×
      </button>
    </div>
  );
}

// Add animation to index.css
// @keyframes slideInFromRight {
//   0% { opacity: 0; transform: translateX(100%); }
//   100% { opacity: 1; transform: translateX(0); }
// }
