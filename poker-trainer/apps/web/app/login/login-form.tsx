'use client'

import { useState } from 'react'

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(formData: FormData) {
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: formData.get('username'),
          password: formData.get('password'),
        }),
      })
      if (!response.ok) {
        setError('账号或访问口令不正确')
        return
      }
      window.location.assign(nextPath)
    } catch {
      setError('暂时无法连接，请稍后再试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="login-form" action={(formData) => void submit(formData)}>
      <label>
        <span>账号</span>
        <input
          name="username"
          type="text"
          autoComplete="username"
          required
          autoFocus
        />
      </label>
      <label>
        <span>访问口令</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      {error !== null ? <p role="alert">{error}</p> : null}
      <button type="submit" disabled={submitting}>
        {submitting ? '正在验证…' : '进入工作台'}
      </button>
    </form>
  )
}
