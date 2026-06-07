import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  recipientName?: string
  senderName?: string
  preview?: string
  conversationUrl?: string
  unreadCount?: number
}

const NewMessageEmail = ({
  recipientName,
  senderName = 'Alguém',
  preview = '',
  conversationUrl = 'https://webconnectchat.com',
  unreadCount = 1,
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{`${senderName} te mandou ${unreadCount > 1 ? unreadCount + ' mensagens' : 'uma mensagem'} no Wavechat`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brand}>
          <Heading style={brandTitle}>Wavechat</Heading>
        </Section>
        <Section style={card}>
          <Heading style={h1}>
            {senderName} te mandou {unreadCount > 1 ? `${unreadCount} mensagens` : 'uma mensagem'}
          </Heading>
          <Text style={greet}>
            {recipientName ? `Olá, ${recipientName}!` : 'Olá!'}
          </Text>
          <Text style={paragraph}>
            Você tem {unreadCount > 1 ? `${unreadCount} mensagens novas` : 'uma mensagem nova'} esperando por você.
          </Text>
          {preview ? (
            <Section style={quoteBox}>
              <Text style={quoteText}>"{preview.slice(0, 240)}"</Text>
            </Section>
          ) : null}
          <Section style={{ textAlign: 'center', margin: '28px 0 8px' }}>
            <Button href={conversationUrl} style={btn}>
              Abrir conversa
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={muted}>
            Você está recebendo este e-mail porque alguém te enviou uma mensagem no Wavechat e você ainda não a leu.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NewMessageEmail,
  subject: (data: Record<string, any>) => {
    const sender = (data?.senderName as string) || 'Alguém'
    const n = (data?.unreadCount as number) || 1
    return n > 1
      ? `${sender} e outros te mandaram ${n} mensagens no Wavechat`
      : `${sender} te mandou uma mensagem no Wavechat`
  },
  displayName: 'Nova mensagem no Wavechat',
  previewData: {
    recipientName: 'Maria',
    senderName: 'João',
    preview: 'Oi! Tudo bem? Vi que você criou conta agora, bora conversar?',
    conversationUrl: 'https://webconnectchat.com',
    unreadCount: 1,
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
const quoteBox = { backgroundColor: '#ffffff', borderLeft: '4px solid #0EA5E9', borderRadius: '8px', padding: '14px 16px', margin: '12px 0 4px' }
const quoteText = { fontSize: '15px', color: '#0F172A', fontStyle: 'italic' as const, margin: 0, lineHeight: '1.5' }
const btn = { backgroundColor: '#0EA5E9', color: '#ffffff', padding: '12px 28px', borderRadius: '999px', fontSize: '15px', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }
const hr = { borderColor: '#E2E8F0', margin: '20px 0' }
const muted = { fontSize: '12px', color: '#64748B', margin: 0, lineHeight: '1.5' }
