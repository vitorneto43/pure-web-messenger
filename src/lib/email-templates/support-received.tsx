import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  recipientName?: string
  originalMessage?: string
}

const SupportReceivedEmail = ({ recipientName, originalMessage = '' }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Recebemos sua mensagem — WaveChat</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brand}>
          <Heading style={brandTitle}>WaveChat</Heading>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Recebemos sua mensagem 🎉</Heading>
          <Text style={greet}>
            {recipientName ? `Olá, ${recipientName}!` : 'Olá!'}
          </Text>
          <Text style={paragraph}>
            Muito obrigado por entrar em contato com a <strong>WaveChat</strong>.
            Será um grande prazer atender sua demanda!
          </Text>
          <Text style={paragraph}>
            Sua mensagem foi recebida com sucesso e nossa equipe já está analisando.
            Em breve você receberá uma resposta neste mesmo e-mail.
          </Text>
          {originalMessage ? (
            <>
              <Hr style={hr} />
              <Text style={muted}>Resumo da sua mensagem:</Text>
              <Section style={quoteBox}>
                <Text style={quoteText}>"{originalMessage.slice(0, 600)}"</Text>
              </Section>
            </>
          ) : null}
          <Hr style={hr} />
          <Text style={muted}>
            Atenciosamente,<br />
            Equipe WaveChat
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SupportReceivedEmail,
  subject: 'Recebemos sua mensagem — WaveChat',
  displayName: 'Confirmação de mensagem recebida',
  previewData: {
    recipientName: 'Maria',
    originalMessage: 'Não consigo entrar na minha conta.',
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
const quoteBox = { backgroundColor: '#ffffff', borderLeft: '4px solid #0EA5E9', borderRadius: '8px', padding: '14px 16px', margin: '8px 0 4px' }
const quoteText = { fontSize: '14px', color: '#475569', fontStyle: 'italic' as const, margin: 0, lineHeight: '1.5', whiteSpace: 'pre-wrap' as const }
const hr = { borderColor: '#E2E8F0', margin: '20px 0' }
const muted = { fontSize: '13px', color: '#64748B', margin: '4px 0', lineHeight: '1.5' }
