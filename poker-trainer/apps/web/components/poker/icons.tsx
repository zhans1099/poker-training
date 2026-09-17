import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

export function HistoryIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M5 3.75h12A2.25 2.25 0 0 1 19.25 6v12A2.25 2.25 0 0 1 17 20.25H5A2.25 2.25 0 0 1 2.75 18V6A2.25 2.25 0 0 1 5 3.75Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M7 8h8M7 12h8M7 16h5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle
        cx="12"
        cy="12"
        r="3.25"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="m19.2 13.3 1.05 1.8-1.9 3.3h-2.1l-1.2.7-1.05 1.8h-4l-1.05-1.8-1.2-.7h-2.1l-1.9-3.3 1.05-1.8v-1.4L3.75 10.1l1.9-3.3h2.1l1.2-.7L10 4.3h4l1.05 1.8 1.2.7h2.1l1.9 3.3-1.05 1.8v1.4Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function UserIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M5.5 19c.8-3.2 3-4.8 6.5-4.8s5.7 1.6 6.5 4.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function ChevronIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path
        d="m5 7.5 5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path
        d="m5 5 10 10M15 5 5 15"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}
