# WaveChat - Guia de Hardening de Segurança

**Data**: 23 de maio de 2026  
**Versão**: 1.22  
**Status**: Implementado

---

## 1. Visão Geral de Segurança

Áreas críticas de segurança:
- ✅ Proteção de secrets (.env, keystore)
- ✅ Separação frontend/backend
- ✅ Validação de entrada
- ✅ HTTPS e TLS
- ✅ Autenticação e autorização
- ✅ Proteção de dados sensíveis

---

## 2. Gerenciamento de Secrets

### 2.1 Arquivo .env

**NUNCA fazer**:
```bash
# ❌ ERRADO: Secrets no código
SUPABASE_URL=https://abc.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
FCM_SERVER_KEY=AAAA1234567:ABC...XYZ
```

**Fazer**:
```bash
# ✅ CORRETO: Usar .env.local (não commitado)
SUPABASE_URL=https://abc.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
FCM_SERVER_KEY=AAAA1234567:ABC...XYZ
```

### 2.2 .gitignore Completo

```bash
# .gitignore

# Environment variables
.env
.env.local
.env.*.local
.env.production.local

# Secrets
*.jks
*.keystore
*.pem
*.key
*.p12
*.pfx
firebase-key.json
google-services.json
wavechat-key.json

# Build outputs
dist/
build/
*.apk
*.aab
*.ipa

# Dependencies
node_modules/
.pnp
.pnp.js

# IDE
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# OS
Thumbs.db
.DS_Store

# Capacitor
android/app/release/
android/app/debug/
ios/Pods/

# Cache
.cache/
.eslintcache
.next/

# Testing
coverage/
.nyc_output/

# Misc
*.bak
*.tmp
.env.example  # Não ignore, este é o template
```

### 2.3 .env.example

```bash
# .env.example
# IMPORTANTE: Este arquivo é um TEMPLATE. Nunca adicione valores reais aqui!
# Copie este arquivo para .env.local e preencha com seus valores

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Firebase
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id

# FCM
FCM_SERVER_KEY=your-fcm-server-key

# Android
ANDROID_KEYSTORE_PATH=./wavechat.jks
ANDROID_KEYSTORE_PASSWORD=your-keystore-password
ANDROID_KEYSTORE_ALIAS=wavechat
ANDROID_KEY_PASSWORD=your-key-password

# Backend
BACKEND_URL=https://api.wavechat.com
BACKEND_API_KEY=your-backend-api-key
```

### 2.4 Variáveis de Ambiente no Vite

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // ✅ Apenas expor variáveis públicas (VITE_)
    __SUPABASE_URL__: JSON.stringify(process.env.VITE_SUPABASE_URL),
    __SUPABASE_ANON_KEY__: JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY),
  },
});
```

### 2.5 Acessar Variáveis no Frontend

```typescript
// src/integrations/supabase/client.ts
import { createClient } from '@supabase/supabase-js';

// ✅ CORRETO: Usar apenas VITE_ (públicas)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase credentials not configured');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

---

## 3. Keystore Android

### 3.1 Gerar Keystore Seguro

```bash
# Gerar keystore com senha forte
keytool -genkey -v -keystore wavechat.jks \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10950 \
  -alias wavechat \
  -storepass "YOUR_STRONG_PASSWORD_HERE" \
  -keypass "YOUR_STRONG_PASSWORD_HERE"

# Será solicitado:
# - First and last name: WaveChat
# - Organizational unit: Development
# - Organization: WaveChat
# - City or Locality: São Paulo
# - State or Province: SP
# - Country Code: BR
```

### 3.2 Proteger Keystore

```bash
# Definir permissões restritivas
chmod 600 wavechat.jks

# Verificar proprietário
ls -la wavechat.jks
# Resultado: -rw------- 1 user group 2048 May 23 10:00 wavechat.jks
```

### 3.3 Armazenar Senha Seguramente

**NUNCA fazer**:
```gradle
// ❌ ERRADO: Senha no build.gradle
android {
    signingConfigs {
        release {
            storeFile file("wavechat.jks")
            storePassword "YOUR_PASSWORD"  // ❌ EXPOSTO!
            keyAlias "wavechat"
            keyPassword "YOUR_PASSWORD"    // ❌ EXPOSTO!
        }
    }
}
```

**Fazer**:
```gradle
// ✅ CORRETO: Usar variáveis de ambiente
android {
    signingConfigs {
        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH") ?: "wavechat.jks")
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEYSTORE_ALIAS") ?: "wavechat"
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }
}
```

### 3.4 Usar Keystore em CI/CD

```bash
# .github/workflows/build.yml
name: Build Android

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up JDK
        uses: actions/setup-java@v3
        with:
          java-version: '17'
      
      - name: Build AAB
        env:
          ANDROID_KEYSTORE_PATH: ./wavechat.jks
          ANDROID_KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          ANDROID_KEYSTORE_ALIAS: wavechat
          ANDROID_KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}
        run: |
          # Decodificar keystore do GitHub Secrets
          echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 -d > wavechat.jks
          
          # Build
          ./gradlew bundleRelease
```

---

## 4. Separação Frontend/Backend

### 4.1 Arquitetura

```
wavechat/
├── frontend/                    # Cliente (React/Vite)
│   ├── src/
│   ├── public/
│   ├── vite.config.ts
│   └── package.json
├── backend/                     # Servidor (Node.js/Express)
│   ├── src/
│   ├── routes/
│   ├── middleware/
│   └── package.json
├── android/                     # App Android (Capacitor)
│   └── app/
└── README.md
```

### 4.2 Backend Express

```typescript
// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();

// ✅ Segurança
app.use(helmet()); // Headers de segurança
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// ✅ Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requisições por IP
});
app.use(limiter);

// ✅ Parsing
app.use(express.json({ limit: '10mb' }));

// ✅ Rotas
app.post('/api/auth/login', async (req, res) => {
  // Validar entrada
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  
  // Processar login
  try {
    const user = await authenticateUser(email, password);
    res.json({ token: user.token });
  } catch (error) {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/calls/send-notification', async (req, res) => {
  // Verificar autenticação
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Validar entrada
  const { callId, calleeId, callerName, kind } = req.body;
  if (!callId || !calleeId || !callerName || !kind) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Enviar notificação
  try {
    await sendCallNotification(callId, calleeId, callerName, kind);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
```

### 4.3 Middleware de Autenticação

```typescript
// backend/src/middleware/auth.ts
import jwt from 'jsonwebtoken';

export function verifyToken(req: any, res: any, next: any) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function verifyAdmin(req: any, res: any, next: any) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}
```

### 4.4 Validação de Entrada

```typescript
// backend/src/middleware/validation.ts
import { body, validationResult } from 'express-validator';

export const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  (req: any, res: any, next: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

export const validateCallNotification = [
  body('callId').isString().trim(),
  body('calleeId').isString().trim(),
  body('callerName').isString().trim().isLength({ min: 1, max: 100 }),
  body('kind').isIn(['audio', 'video']),
  (req: any, res: any, next: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];
```

---

## 5. HTTPS e TLS

### 5.1 Certificado SSL

```bash
# Gerar certificado auto-assinado (desenvolvimento)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Usar Let's Encrypt (produção)
# Recomendado: Usar Certbot com Nginx/Apache
```

### 5.2 Configurar HTTPS no Express

```typescript
// backend/src/server.ts
import https from 'https';
import fs from 'fs';

const options = {
  key: fs.readFileSync('./key.pem'),
  cert: fs.readFileSync('./cert.pem'),
};

https.createServer(options, app).listen(443, () => {
  console.log('HTTPS server running on port 443');
});
```

### 5.3 HSTS Header

```typescript
// backend/src/server.ts
app.use(helmet.hsts({
  maxAge: 31536000, // 1 ano
  includeSubDomains: true,
  preload: true,
}));
```

---

## 6. Autenticação e Autorização

### 6.1 JWT (JSON Web Token)

```typescript
// backend/src/auth.ts
import jwt from 'jsonwebtoken';

export function generateToken(userId: string, role: string) {
  return jwt.sign(
    { userId, role, iat: Math.floor(Date.now() / 1000) },
    process.env.JWT_SECRET!,
    { expiresIn: '24h' }
  );
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!);
  } catch (error) {
    throw new Error('Invalid token');
  }
}
```

### 6.2 Refresh Token

```typescript
// backend/src/auth.ts
export function generateRefreshToken(userId: string) {
  return jwt.sign(
    { userId, type: 'refresh' },
    process.env.REFRESH_TOKEN_SECRET!,
    { expiresIn: '7d' }
  );
}

app.post('/api/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;
  
  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!);
    const newToken = generateToken(decoded.userId, decoded.role);
    res.json({ token: newToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});
```

---

## 7. Proteção de Dados Sensíveis

### 7.1 Hash de Senhas

```typescript
// backend/src/auth.ts
import bcrypt from 'bcrypt';

export async function hashPassword(password: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
```

### 7.2 Criptografia de Dados

```typescript
// backend/src/crypto.ts
import crypto from 'crypto';

export function encryptData(data: string, key: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptData(data: string, key: string) {
  const [iv, encrypted] = data.split(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), Buffer.from(iv, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

---

## 8. Logging e Monitoramento

### 8.1 Logging Seguro

```typescript
// backend/src/logger.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// ✅ Log sem expor dados sensíveis
logger.info('User login', {
  userId: user.id,
  timestamp: new Date(),
  // ❌ NÃO fazer: password, token, etc.
});
```

### 8.2 Monitoramento

```typescript
// backend/src/middleware/monitoring.ts
export function monitoringMiddleware(req: any, res: any, next: any) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
}
```

---

## 9. Checklist de Segurança

- [ ] `.env` não commitado
- [ ] `.env.example` criado com placeholders
- [ ] Keystore protegido com chmod 600
- [ ] Senha do keystore em variável de ambiente
- [ ] HTTPS ativado em produção
- [ ] JWT com expiração
- [ ] Refresh token implementado
- [ ] Rate limiting ativado
- [ ] CORS configurado corretamente
- [ ] Helmet.js ativado
- [ ] Senhas com hash bcrypt
- [ ] Dados sensíveis criptografados
- [ ] Logging sem expor secrets
- [ ] Validação de entrada em todas as rotas
- [ ] Autenticação em todas as rotas protegidas

---

## 10. Próximos Passos

1. **Fase 7**: Preparar Google Play Console
2. **Fase 8**: Documentação final

---

## 11. Referências

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Android Security](https://developer.android.com/training/articles/security-tips)

---

**Última atualização**: 23 de maio de 2026  
**Versão**: 1.22 (versionCode: 23)
