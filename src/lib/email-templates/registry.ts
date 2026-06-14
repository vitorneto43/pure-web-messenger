import type { ComponentType } from 'react'
import { template as newMessageTemplate } from './new-message'
import { template as supportReplyTemplate } from './support-reply'
import { template as supportReceivedTemplate } from './support-received'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'new-message': newMessageTemplate,
  'support-reply': supportReplyTemplate,
  'support-received': supportReceivedTemplate,
}
