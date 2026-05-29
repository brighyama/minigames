import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'

type Tone = 'info' | 'success' | 'error'

type Toast = {
  id: number
  message: string
  tone: Tone
}

type ShowOptions = {
  tone?: Tone
  durationMs?: number
}

type ToastContextValue = {
  show: (message: string, opts?: ShowOptions) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

let idCounter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback(
    (message: string, opts?: ShowOptions) => {
      const id = ++idCounter
      const tone = opts?.tone ?? 'info'
      const duration = opts?.durationMs ?? 3000
      setToasts((prev) => [...prev, { id, message, tone }])
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration)
    },
    [],
  )

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <span className="toast-message">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}
