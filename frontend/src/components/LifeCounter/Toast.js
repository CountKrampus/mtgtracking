import React, { useState, useEffect, useCallback } from 'react';
import { X, Bell, AlertTriangle, Info, CheckCircle } from 'lucide-react';

// Toast types with their styling
const TOAST_TYPES = {
  trigger: {
    icon: Bell,
    bgColor: 'bg-yellow-600',
    borderColor: 'border-yellow-400'
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-orange-600',
    borderColor: 'border-orange-400'
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-600',
    borderColor: 'border-blue-400'
  },
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-600',
    borderColor: 'border-green-400'
  }
};

function Toast({ toasts, removeToast }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const config = TOAST_TYPES[toast.type] || TOAST_TYPES.info;
        const Icon = config.icon;

        return (
          <div
            key={toast.id}
            className={`${config.bgColor} ${config.borderColor} border-l-4 rounded-lg p-4 shadow-2xl
                       animate-slide-in pointer-events-auto flex items-start gap-3`}
            style={{
              animation: 'slideIn 0.3s ease-out'
            }}
          >
            <Icon size={20} className="text-white flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              {toast.title && (
                <div className="text-white font-semibold text-sm">{toast.title}</div>
              )}
              <div className="text-white/90 text-sm">{toast.message}</div>
              {toast.playerName && (
                <div className="text-white/60 text-xs mt-1">Player: {toast.playerName}</div>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-white/60 hover:text-white transition flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

// Custom hook for managing toasts
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    const newToast = {
      id,
      type: 'info',
      duration: 5000,
      ...toast
    };

    setToasts(prev => [...prev, newToast]);

    // Auto-remove after duration
    if (newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    addToast,
    removeToast,
    clearToasts
  };
}

export default Toast;
