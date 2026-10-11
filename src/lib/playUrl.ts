import type { Card } from '../types'

export function playUrl(baseUrl: string, card: Card): string {
  return `${baseUrl.replace(/\/$/, '')}/?p=${card.deezerId}`
}
