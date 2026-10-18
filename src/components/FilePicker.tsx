import { useRef, useState, type InputHTMLAttributes } from 'react'
import { Upload } from 'lucide-react'
import { t, useLanguage } from '@/lib/i18n'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children' | 'aria-label'> & {
  label: string
}

/** Native file selection with application-localized, keyboard-accessible controls. */
export function FilePicker({ label, onChange, disabled, ...props }: Props) {
  useLanguage()
  const input = useRef<HTMLInputElement>(null)
  const [filename, setFilename] = useState('')
  return (
    <div className="file-picker">
      <span className="file-picker-label">{label}</span>
      <div className="file-picker-row">
        <button
          type="button"
          disabled={disabled}
          aria-label={t('选择文件：{0}', { 0: label })}
          onClick={() => input.current?.click()}
        >
          <Upload size={16} />
          {t('选择文件')}
        </button>
        <span className="file-picker-name" role="status" title={filename || undefined}>
          {filename || t('未选择文件')}
        </span>
      </div>
      <input
        {...props}
        ref={input}
        type="file"
        hidden
        disabled={disabled}
        aria-label={label}
        onChange={(event) => {
          setFilename(Array.from(event.target.files || [], (file) => file.name).join(', '))
          onChange?.(event)
          // Permit importing the same file again after editing it externally.
          event.target.value = ''
        }}
      />
    </div>
  )
}
