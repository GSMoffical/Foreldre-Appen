import { forwardRef } from 'react'
import { inputBase, inputLabel, inputHint, inputError as inputErrorCls } from '../../lib/ui'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    const hasError = !!error
    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={inputId} className={inputLabel}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`${inputBase} ${hasError ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-400/20' : ''} ${className}`.trim()}
          aria-invalid={hasError || undefined}
          aria-describedby={
            hasError
              ? `${inputId}-error`
              : hint
                ? `${inputId}-hint`
                : undefined
          }
          {...props}
        />
        {hasError && (
          <p id={`${inputId}-error`} className={inputErrorCls} role="alert">
            {error}
          </p>
        )}
        {hint && !hasError && (
          <p id={`${inputId}-hint`} className={inputHint}>
            {hint}
          </p>
        )}
      </div>
    )
  },
)
Input.displayName = 'Input'

// ── Textarea variant ──────────────────────────────────────────────────────────

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, className = '', id, rows = 2, ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    const hasError = !!error
    const base =
      'w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-body text-zinc-900 placeholder-zinc-400 outline-none resize-none transition focus:border-brandTeal focus:bg-white focus:ring-1 focus:ring-brandTeal/20'
    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={textareaId} className={inputLabel}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={`${base} ${hasError ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-400/20' : ''} ${className}`.trim()}
          aria-invalid={hasError || undefined}
          aria-describedby={
            hasError
              ? `${textareaId}-error`
              : hint
                ? `${textareaId}-hint`
                : undefined
          }
          {...props}
        />
        {hasError && (
          <p id={`${textareaId}-error`} className={inputErrorCls} role="alert">
            {error}
          </p>
        )}
        {hint && !hasError && (
          <p id={`${textareaId}-hint`} className={inputHint}>
            {hint}
          </p>
        )}
      </div>
    )
  },
)
Textarea.displayName = 'Textarea'
