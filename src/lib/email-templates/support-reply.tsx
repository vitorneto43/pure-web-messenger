import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  recipientName?: string
  originalMessage?: string
  replyMessage?: string
}

const SupportReplyEmail = ({
  recipientName,
  originalMessage = '',
  replyMessage = '',
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Resposta da equipe WaveChat</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brand}>
          <Heading style={brandTitle}>WaveChat</Heading>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Resposta do suporte</Heading>
          <Text style={greet}>
            {recipientName ? `Olá, ${recipientName}!` : 'Olá!'}
          </Text>
          <Text style={paragraph}>
            Obrigado por entrar em contato. Aqui está nossa resposta:
          </Text>
          <Section style={replyBox}>
            <Text style={replyText}>{replyMessage}</Text>
          </Section>
          {originalMessage ? (
            <>
              <Hr style={hr} />
              <Text style={muted}>Sua mensagem original:</Text>
              <Section style={quoteBox}>
                <Text style={quoteText}>"{originalMessage.slice(0, 600)}"</Text>
              </Section>
            </>
          ) : null}
          <Hr style={hr} />
          <Text style={muted}>
            Se precisar de mais ajuda, basta responder a este e-mail.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SupportReplyEmail,
  subject: 'Resposta do suporte WaveChat',
  displayName: 'Resposta do suporte',
  previewData: {
    recipientName: 'Maria',
    originalMessage: 'Não consigo entrar na minha conta.',
    replyMessage: 'Olá Maria, tente redefinir sua senha em /reset-password.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', margin: 0, padding: 0 }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px 16px' }
const brand = { textAlign: 'center' as const, paddingBottom: '16px' }
const brandTitle = { fontSize: '20px', color: '#0EA5E9', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }
const card = { backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '28px 24px' }
const h1 = { fontSize: '22px', lineHeight: '1.3', color: '#0F172A', margin: '0 0 12px', fontWeight: 700 }
const greet = { fontSize: '15px', color: '#0F172A', margin: '0 0 8px' }
const paragraph = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 12px' }
const replyBox = { backgroundColor: '#ffffff', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px 16px', margin: '12px 0' }
const replyText = { fontSize: '15px', color: '#0F172A', margin: 0, lineHeight: '1.6', whiteSpace: 'pre-wrap' as const }
const quoteBox = { backgroundColor: '#ffffff', borderLeft: '4px solid #94A3B8', borderRadius: '8px', padding: '14px 16px', margin: '8px 0 4px' }
const quoteText = { fontSize: '14px', color: '#475569', fontStyle: 'italic' as const, margin: 0, lineHeight: '1.5', whiteSpace: 'pre-wrap' as const }
const hr = { borderColor: '#E2E8F0', margin: '20px 0' }
const muted = { fontSize: '12px', color: '#64748B', margin: '4px 0', lineHeight: '1.5' }
