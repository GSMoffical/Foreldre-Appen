import { Component } from 'react'
import type { ReactNode } from 'react'

const Fallback = () => (
  <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-center">
    <p className="text-[13px] font-medium text-rose-900">Kunne ikke vise forhåndsvisningen.</p>
    <p className="mt-1 text-[12px] text-rose-800">Lukk vinduet og prøv igjen, eller last siden på nytt.</p>
  </div>
)

/**
 * Fanger render-feil i Tankestrøm import-forhåndsvisning uten å lekke innhold til bruker.
 */
export class TankestromImportPreviewBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[TankestromImportPreviewBoundary]', error)
  }

  render() {
    if (this.state.hasError) return <Fallback />
    return this.props.children
  }
}
