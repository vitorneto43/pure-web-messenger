import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/unsubscribe')({
  component: UnsubscribePage,
  head: () => ({
    meta: [
      { title: 'Cancelar inscrição — Wavechat' },
      { name: 'robots', content: 'noindex,nofollow' },
    ],
  }),
})

type State =
  | { kind: 'loading' }
  | { kind: 'valid' }
  | { kind: 'already' }
  | { kind: 'invalid' }
  | { kind: 'submitting' }
  | { kind: 'done' }
  | { kind: 'error'; message: string }

function UnsubscribePage() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('token')
    if (!t) {
      setState({ kind: 'invalid' })
      return
    }
    setToken(t)
    fetch(`/email/unsubscribe?token=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.valid === true) setState({ kind: 'valid' })
        else if (d?.reason === 'already_unsubscribed') setState({ kind: 'already' })
        else setState({ kind: 'invalid' })
      })
      .catch(() => setState({ kind: 'error', message: 'Não foi possível validar o link.' }))
  }, [])

  async function confirm() {
    if (!token) return
    setState({ kind: 'submitting' })
    try {
      const res = await fetch('/email/unsubscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const d = await res.json()
      if (d?.success) setState({ kind: 'done' })
      else if (d?.reason === 'already_unsubscribed') setState({ kind: 'already' })
      else setState({ kind: 'error', message: d?.error ?? 'Falha ao cancelar inscrição.' })
    } catch {
      setState({ kind: 'error', message: 'Falha de rede.' })
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm text-center">
        <h1 className="text-2xl font-semibold mb-2">Cancelar e-mails do Wavechat</h1>
        {state.kind === 'loading' && <p className="text-muted-foreground">Validando…</p>}
        {state.kind === 'invalid' && (
          <p className="text-muted-foreground">Link inválido ou expirado.</p>
        )}
        {state.kind === 'already' && (
          <p className="text-muted-foreground">Este e-mail já está cancelado. Você não receberá mais avisos.</p>
        )}
        {state.kind === 'valid' && (
          <>
            <p className="text-muted-foreground mb-6">
              Tem certeza que quer parar de receber e-mails de novas mensagens?
            </p>
            <button
              onClick={confirm}
              className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground px-6 py-2 font-medium hover:opacity-90 transition"
            >
              Confirmar cancelamento
            </button>
          </>
        )}
        {state.kind === 'submitting' && <p className="text-muted-foreground">Cancelando…</p>}
        {state.kind === 'done' && (
          <p className="text-foreground">Pronto! Você não receberá mais e-mails de novas mensagens.</p>
        )}
        {state.kind === 'error' && <p className="text-destructive">{state.message}</p>}
      </div>
    </main>
  )
}
