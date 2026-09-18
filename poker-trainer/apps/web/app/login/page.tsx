import type { Metadata } from 'next'
import { LoginForm } from './login-form'

export const metadata: Metadata = {
  title: 'Workspace Access',
  description: 'Private workspace access',
}

interface LoginPageProps {
  searchParams: Promise<{ next?: string | string[] }>
}

function safeNextPath(value: string | string[] | undefined) {
  const path = Array.isArray(value) ? value[0] : value
  return path?.startsWith('/') && !path.startsWith('//') ? path : '/'
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const nextPath = safeNextPath((await searchParams).next)
  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-symbol" aria-hidden="true">
          W
        </div>
        <span className="login-eyebrow">PRIVATE WORKSPACE</span>
        <h1 id="login-title">内部工作台</h1>
        <p>此区域仅供授权人员访问。</p>
        <LoginForm nextPath={nextPath} />
        <small>Secure session · Access monitored</small>
      </section>
    </main>
  )
}
