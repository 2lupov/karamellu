/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  token: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  recipient,
  token,
}: SignupEmailProps) => (
  <Html lang="uk" dir="ltr">
    <Head />
    <Preview>Ваш код підтвердження для {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>KARAMELLU</Text>
        <Heading style={h1}>Підтвердження пошти</Heading>
        <Text style={text}>
          Дякуємо за реєстрацію! Використайте код нижче для підтвердження вашої
          електронної адреси ({recipient}):
        </Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={text}>Код дійсний протягом обмеженого часу.</Text>
        <Text style={footer}>
          Якщо ви не створювали акаунт, просто проігноруйте цей лист.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '40px 25px' }
const brand = {
  fontSize: '14px',
  letterSpacing: '0.2em',
  color: 'hsl(0 0% 20%)',
  fontWeight: '500' as const,
  margin: '0 0 30px',
}
const h1 = {
  fontSize: '24px',
  fontWeight: '600' as const,
  color: 'hsl(0 0% 20%)',
  fontFamily: "'Playfair Display', Georgia, serif",
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: 'hsl(0 0% 55%)',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const codeStyle = {
  fontFamily: "'Inter', Courier, monospace",
  fontSize: '32px',
  fontWeight: 'bold' as const,
  color: 'hsl(0 0% 20%)',
  letterSpacing: '0.15em',
  textAlign: 'center' as const,
  padding: '20px 0',
  margin: '0 0 20px',
  borderTop: '1px solid hsl(0 0% 85%)',
  borderBottom: '1px solid hsl(0 0% 85%)',
}
const footer = { fontSize: '12px', color: 'hsl(0 0% 55%)', margin: '30px 0 0' }
