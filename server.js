// ═══════════════════════════════════════════════════════════════
//  GUILD SVE — Servidor Node.js + Firebase Admin SDK
//  Render (ou qualquer VPS) · Porta: process.env.PORT ou 3001
//
//  Rotas protegidas exigem header:
//    Authorization: Bearer <idToken do admin logado no browser>
//
//  Variáveis de ambiente necessárias (.env ou Render Environment):
//    FIREBASE_PROJECT_ID
//    FIREBASE_CLIENT_EMAIL
//    FIREBASE_PRIVATE_KEY    (com \n reais — veja .env.example)
//    ADMIN_EMAIL             (email do admin master)
//    ALLOWED_ORIGIN          (URL do seu site, ex: https://seu-site.com)
// ═══════════════════════════════════════════════════════════════

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const admin      = require('firebase-admin');
const nodemailer = require('nodemailer');

// ── Nodemailer — Gmail ─────────────────────────────────────────
const _mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASS,
  },
});

async function sendWelcomeEmail({ to, userName, guildName, password }) {
  const siteUrl = process.env.SITE_URL || 'https://caca-d5478.web.app';
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background:#f0f2f8; color:#1a1a2e; }
  .wrap { max-width:560px; margin:32px auto; }
  .header {
    background:linear-gradient(135deg,#0a0f2e 0%,#101840 100%);
    border-radius:16px 16px 0 0;
    padding:32px 36px 24px;
    text-align:center;
    border-bottom:3px solid #FFD700;
  }
  .header-title {
    font-size:22px; font-weight:900; letter-spacing:3px;
    color:#FFD700; margin-bottom:6px;
  }
  .header-sub { font-size:12px; color:rgba(0,229,255,0.7); letter-spacing:2px; }
  .body {
    background:#fff;
    padding:32px 36px;
    border-left:1px solid #e0e4f0;
    border-right:1px solid #e0e4f0;
  }
  .greeting { font-size:18px; font-weight:700; color:#0a0f2e; margin-bottom:8px; }
  .intro { font-size:14px; color:#555; line-height:1.7; margin-bottom:24px; }
  .info-box {
    background:#f8f9fc;
    border:1px solid #e0e4f0;
    border-left:4px solid #0066cc;
    border-radius:8px;
    padding:18px 20px;
    margin-bottom:24px;
  }
  .info-row { display:flex; gap:10px; align-items:center; margin-bottom:10px; }
  .info-row:last-child { margin-bottom:0; }
  .info-label { font-size:11px; font-weight:700; color:#888; text-transform:uppercase; letter-spacing:1px; width:80px; flex-shrink:0; }
  .info-value { font-size:14px; font-weight:700; color:#1a1a2e; }
  .pass-box {
    background:#fff8e0;
    border:1px solid #ffe4a0;
    border-left:4px solid #FFB800;
    border-radius:8px;
    padding:18px 20px;
    margin-bottom:24px;
    text-align:center;
  }
  .pass-label { font-size:11px; color:#888; letter-spacing:2px; text-transform:uppercase; margin-bottom:8px; }
  .pass-value { font-size:28px; font-weight:900; letter-spacing:6px; color:#cc8800; font-family:monospace; }
  .pass-warn { font-size:11px; color:#888; margin-top:8px; }
  .steps { margin-bottom:24px; }
  .steps-title { font-size:13px; font-weight:700; color:#0a0f2e; margin-bottom:12px; letter-spacing:1px; text-transform:uppercase; }
  .step { display:flex; gap:12px; align-items:flex-start; margin-bottom:10px; }
  .step-num {
    width:24px; height:24px; border-radius:50%; flex-shrink:0;
    background:#0066cc; color:#fff;
    font-size:12px; font-weight:700;
    display:flex; align-items:center; justify-content:center;
  }
  .step-text { font-size:13px; color:#444; line-height:1.6; padding-top:3px; }
  .step-text a { color:#0066cc; font-weight:700; }
  .btn-wrap { text-align:center; margin-bottom:24px; }
  .btn {
    display:inline-block;
    background:linear-gradient(135deg,#0066cc,#0044aa);
    color:#fff; text-decoration:none;
    padding:14px 36px; border-radius:10px;
    font-size:14px; font-weight:700; letter-spacing:2px;
    text-transform:uppercase;
  }
  .footer {
    background:#0a0f2e;
    border-radius:0 0 16px 16px;
    padding:20px 36px;
    text-align:center;
  }
  .footer-text { font-size:11px; color:rgba(200,230,255,0.45); line-height:1.7; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="header-title">⚔ RELATÓRIO DE CAÇA</div>
    <div class="header-sub">Plataforma de Gestão para Guilds · Lords Mobile</div>
  </div>
  <div class="body">
    <div class="greeting">Olá, ${userName}! 👋</div>
    <div class="intro">
      Você foi cadastrado no <strong>Relatório de Caça</strong> — plataforma de gestão da guild
      <strong>${guildName}</strong>. Abaixo estão suas credenciais de acesso.
    </div>

    <div class="info-box">
      <div class="info-row">
        <div class="info-label">Guild</div>
        <div class="info-value">⚔ ${guildName}</div>
      </div>
      <div class="info-row">
        <div class="info-label">E-mail</div>
        <div class="info-value">${to}</div>
      </div>
    </div>

    <div class="pass-box">
      <div class="pass-label">🔑 Senha temporária</div>
      <div class="pass-value">${password}</div>
      <div class="pass-warn">Você será solicitado a criar uma nova senha no primeiro acesso.</div>
    </div>

    <div class="steps">
      <div class="steps-title">📋 Como acessar</div>
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text">Acesse <a href="${siteUrl}">${siteUrl}</a> no seu navegador.</div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text">Clique em <strong>"Já tem uma conta? Clique para entrar"</strong>.</div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text">Digite seu e-mail e a <strong>senha temporária</strong> acima.</div>
      </div>
      <div class="step">
        <div class="step-num">4</div>
        <div class="step-text">Crie sua <strong>nova senha pessoal</strong> quando solicitado.</div>
      </div>
    </div>

    <div class="btn-wrap">
      <a href="${siteUrl}" class="btn">ACESSAR O SISTEMA</a>
    </div>
  </div>
  <div class="footer">
    <div class="footer-text">
      Este e-mail foi enviado automaticamente pelo sistema Relatório de Caça.<br>
      Em caso de dúvidas, entre em contato com o líder da sua guild.
    </div>
  </div>
</div>
</body>
</html>`;

  await _mailer.sendMail({
    from: `"Suporte Relatório de Caça" <${process.env.GMAIL_USER}>`,
    to,
    subject: `⚔ Seu acesso ao Relatório de Caça — ${guildName}`,
    html,
  });
}

// ── Inicializa Firebase Admin ──────────────────────────────────
const serviceAccount = {
  type:                        'service_account',
  project_id:                  process.env.FIREBASE_PROJECT_ID,
  client_email:                process.env.FIREBASE_CLIENT_EMAIL,
  // A private key vem como string com \n literais no .env — converte de volta
  private_key:                 process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const auth = admin.auth();
const db   = admin.firestore();

// ── Tratamento de erros não capturados ────────────────────────
process.on('uncaughtException',  err => console.error('[UNCAUGHT]',  err));
process.on('unhandledRejection', err => console.error('[UNHANDLED]', err));

// ── Express ────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3001;

// Confia no proxy do Render para IP real (necessário para rate limit por IP)
app.set('trust proxy', 1);

// ── Segurança: headers HTTP ────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// ── Rate limiting global — protege contra bots e abuso ────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,      // janela de 1 minuto
  max: 60,                  // máx 60 requisições por IP por minuto
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições — aguarde 1 minuto.' },
});
app.use(globalLimiter);

// ── Rate limiting específico para PIX (evita spam de pagamentos) ─
const pixLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // janela de 10 minutos
  max: 5,                   // máx 5 criações de PIX por IP por 10 min
  message: { error: 'Limite de tentativas de pagamento atingido — aguarde 10 minutos.' },
});

// ── Rate limiting para auth-heavy routes ──────────────────────
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Muitas requisições autenticadas — aguarde 1 minuto.' },
});

app.use(express.json({ limit: '10kb' }));

// CORS — aceita uma ou mais origens separadas por vírgula
const _rawOrigins = process.env.ALLOWED_ORIGIN;
if (!_rawOrigins) {
  console.error('⛔ ALLOWED_ORIGIN não configurado — servidor abortando por segurança.');
  process.exit(1);
}
const _allowedOrigins = _rawOrigins.split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    // Sem origin = chamada server-to-server (ex: webhook MP) — permitida
    if (!origin) return cb(null, true);
    if (_allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origem não permitida — ' + origin));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Middleware: verifica token + garante que é admin ───────────
async function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  try {
    const decoded    = await auth.verifyIdToken(token);
    const adminEmail = process.env.ADMIN_EMAIL || '';

    if (decoded.email.toLowerCase() !== adminEmail.toLowerCase()) {
      return res.status(403).json({ error: 'Acesso negado — não é administrador' });
    }

    req.adminUid   = decoded.uid;
    req.adminEmail = decoded.email;
    next();
  } catch (e) {
    console.error('[AUTH] Token inválido:', e.message);
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// ── Middleware: verifica token (qualquer usuário autenticado) ──
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  try {
    req.decodedToken = await auth.verifyIdToken(token);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// ════════════════════════════════════════════════════════════════
//  ROTAS
// ════════════════════════════════════════════════════════════════

// ── Health check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ── GET /api/users — lista usuários (admin) ───────────────────
app.get('/api/users', requireAdmin, async (req, res) => {
  try {
    const snap  = await db.collection('guild_users').get();
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ users });
  } catch (e) {
    console.error('[GET /api/users]', e);
    res.status(500).json({ error: e.message });
  }
});

// Gera senha aleatória segura de 10 caracteres
function _generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  let pass = '';
  for (let i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return pass;
}

// ── POST /api/users — cria usuário (admin) ────────────────────
//  Body: { name, email, password (opcional), guildName }
app.post('/api/users', requireAdmin, async (req, res) => {
  const { name, email, guildName } = req.body;
  let { password } = req.body;

  // Se senha não informada, gera automaticamente
  const autoPass = !password || password.trim() === '';
  if (autoPass) password = _generatePassword();

  if (!name || !email || !guildName) {
    return res.status(400).json({ error: 'Campos obrigatórios: name, email, guildName' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Senha mínima: 6 caracteres' });
  }

  const adminEmail = process.env.ADMIN_EMAIL || '';
  if (email.toLowerCase() === adminEmail.toLowerCase()) {
    return res.status(400).json({ error: 'E-mail reservado para o administrador' });
  }

  try {
    // 1. Cria no Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
    });

    // 2. Salva dados extras no Firestore
    const docRef = await db.collection('guild_users').add({
      uid:         userRecord.uid,
      name,
      email:       email.toLowerCase(),
      guildName:   guildName.toUpperCase(),
      createdAt:   new Date().toLocaleDateString('pt-BR'),
      firstAccess: true,
    });

    // 3. Responde imediatamente e envia email em background (evita timeout)
    res.status(201).json({
      message:   'Usuário criado com sucesso',
      id:        docRef.id,
      uid:       userRecord.uid,
      emailSent: true,
    });

    // Email em background — não bloqueia a resposta
    sendWelcomeEmail({
      to:        email.toLowerCase(),
      userName:  name,
      guildName: guildName.toUpperCase(),
      password,
    }).then(() => {
      console.log(`[EMAIL] Boas-vindas enviado para ${email}`);
    }).catch(mailErr => {
      console.warn('[EMAIL] Falha ao enviar boas-vindas:', mailErr.message);
    });

  } catch (e) {
    console.error('[POST /api/users]', e);
    const fbErrs = {
      'auth/email-already-exists':  'E-mail já cadastrado no Firebase',
      'auth/invalid-email':         'E-mail inválido',
      'auth/invalid-password':      'Senha muito fraca (mín. 6 caracteres)',
    };
    res.status(400).json({ error: fbErrs[e.code] || e.message });
  }
});

// ── DELETE /api/users/:id — remove usuário (admin) ────────────
//  :id = id do documento Firestore (não o uid do Auth)
app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const docRef  = db.collection('guild_users').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado no Firestore' });
    }

    const { uid, guildName } = docSnap.data();

    // 1. Remove do Firebase Auth
    if (uid) {
      try { await auth.deleteUser(uid); }
      catch (e) { console.warn('[DELETE] Auth user not found, continuing:', e.message); }
    }

    // 2. Remove do Firestore (guild_users)
    await docRef.delete();

    // 2b. Remove todos os docs de presença com o mesmo email (limpa UIDs antigos)
    const { email } = docSnap.data();
    if (email) {
      try {
        const presSnap = await db.collection('presence').get();
        const batch = db.batch();
        presSnap.docs.forEach(d => {
          if (d.data().email === email) batch.delete(d.ref);
        });
        await batch.commit();
      } catch(e) { console.warn('[DELETE] Erro ao limpar presença:', e.message); }
    }

    // 3. Limpa dados da guild (shared_reports + guild_history) se guildName existir
    if (guildName) {
      const guildId = guildName.toUpperCase()
        .replace(/\s+/g, '_')
        .replace(/[^A-Z0-9_\-]/g, c => '_' + c.charCodeAt(0) + '_') || 'DEFAULT';
      const guildIdLegacy = guildName.toUpperCase()
        .replace(/\s+/g, '_')
        .replace(/[^A-Z0-9_\-]/g, '') || 'DEFAULT';

      // Deleta shared_reports (novo ID e legado)
      for (const gid of [...new Set([guildId, guildIdLegacy])]) {
        try { await db.collection('shared_reports').doc(gid).delete(); }
        catch (_) {}
      }

      // Deleta entradas do guild_history
      for (const gid of [...new Set([guildId, guildIdLegacy])]) {
        try {
          const entries = await db.collection('guild_history').doc(gid).collection('entries').get();
          const batch = db.batch();
          entries.docs.forEach(d => batch.delete(d.ref));
          if (entries.docs.length) await batch.commit();
          await db.collection('guild_history').doc(gid).delete();
        } catch (_) {}
      }

      console.log(`[DELETE] Dados da guild "${guildName}" (${guildId}) removidos`);
    }

    res.json({ message: 'Usuário e dados da guild removidos com sucesso' });

  } catch (e) {
    console.error('[DELETE /api/users/:id]', e);
    res.status(500).json({ error: e.message });
  }
});

// ── PATCH /api/users/:id/password — reset de senha (admin) ────
//  Body: { password }
app.patch('/api/users/:id/password', requireAdmin, async (req, res) => {
  const { id }       = req.params;
  const { password } = req.body;

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Senha mínima: 6 caracteres' });
  }

  try {
    const docSnap = await db.collection('guild_users').doc(id).get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const { uid } = docSnap.data();
    if (!uid) return res.status(400).json({ error: 'UID não encontrado no Firestore' });

    // Atualiza senha no Firebase Auth
    await auth.updateUser(uid, { password });

    // Remove flag de primeiro acesso
    await db.collection('guild_users').doc(id).update({ firstAccess: false });

    res.json({ message: 'Senha redefinida com sucesso' });

  } catch (e) {
    console.error('[PATCH /api/users/:id/password]', e);
    res.status(500).json({ error: e.message });
  }
});

// ── PATCH /api/users/:id/guild — atualiza nome da guild (admin) ─
//  Body: { guildName }
app.patch('/api/users/:id/guild', requireAdmin, async (req, res) => {
  const { id }        = req.params;
  const { guildName } = req.body;

  if (!guildName) {
    return res.status(400).json({ error: 'guildName obrigatório' });
  }

  try {
    await db.collection('guild_users').doc(id).update({
      guildName: guildName.toUpperCase(),
    });
    res.json({ message: 'Guild atualizada' });
  } catch (e) {
    console.error('[PATCH /api/users/:id/guild]', e);
    res.status(500).json({ error: e.message });
  }
});

// ── PATCH /api/users/:id/permissions — atualiza permissão individual (admin) ─
//  Body: { feature: 'pdi', value: true/false }
app.patch('/api/users/:id/permissions', requireAdmin, async (req, res) => {
  const { id }            = req.params;
  const { feature, value } = req.body;

  if (!feature || typeof value !== 'boolean') {
    return res.status(400).json({ error: 'feature e value (boolean) obrigatórios' });
  }

  try {
    await db.collection('guild_users').doc(id).update({
      [`permissions.${feature}`]: value,
    });
    res.json({ message: 'Permissão atualizada' });
  } catch (e) {
    console.error('[PATCH /api/users/:id/permissions]', e);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/me — retorna dados do usuário autenticado ────────
app.get('/api/me', authLimiter, requireAuth, async (req, res) => {
  const email = req.decodedToken.email.toLowerCase();
  try {
    const snap = await db.collection('guild_users')
      .where('email', '==', email)
      .get();
    if (snap.empty) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    const docRef = snap.docs[0];
    res.json({ id: docRef.id, ...docRef.data() });
  } catch (e) {
    console.error('[GET /api/me]', e);
    res.status(500).json({ error: e.message });
  }
});

// ── PATCH /api/me/first-access — marca 1º acesso concluído ────
//  Chamado pelo próprio usuário após definir senha no 1º login
//  Body: { firestoreDocId }
app.patch('/api/me/first-access', requireAuth, async (req, res) => {
  const { firestoreDocId } = req.body;
  if (!firestoreDocId) {
    return res.status(400).json({ error: 'firestoreDocId obrigatório' });
  }

  try {
    const docSnap = await db.collection('guild_users').doc(firestoreDocId).get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Garante que o doc pertence ao usuário autenticado
    if (docSnap.data().uid !== req.decodedToken.uid) {
      return res.status(403).json({ error: 'Operação não autorizada' });
    }

    await db.collection('guild_users').doc(firestoreDocId).update({ firstAccess: false });
    res.json({ message: 'Primeiro acesso concluído' });
  } catch (e) {
    console.error('[PATCH /api/me/first-access]', e);
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════
//  PAGAMENTO — MERCADO PAGO PIX
// ════════════════════════════════════════════════════════════════

const MP_FEE_RATE = 0.0099; // 0.99% — taxa PIX padrão Mercado Pago

const _subPlanos = {
  '1h':        { horas: 1,  dias: null, net:  1.00, nome: 'RELATÓRIO DE CAÇA — Teste 1 Hora'  },
  '30d':       { horas: null, dias: 30,  net: 25.00, nome: 'RELATÓRIO DE CAÇA — 30 dias'       },
  '60d':       { horas: null, dias: 60,  net: 45.00, nome: 'RELATÓRIO DE CAÇA — 60 dias'       },
  '90d':       { horas: null, dias: 90,  net: 60.00, nome: 'RELATÓRIO DE CAÇA — 90 dias'       },
  'test':      { horas: null, dias: 30,  net:  1.00, nome: 'RELATÓRIO DE CAÇA — TESTE'         },
  'test1real': { horas: null, dias:  1,  net:  1.00, nome: 'RELATÓRIO DE CAÇA — TESTE PIX R$1' },
};

// Calcula valor bruto que o cliente paga (inclui taxa, você recebe o net)
function _grossAmount(net) {
  return Math.ceil(net / (1 - MP_FEE_RATE) * 100) / 100;
}

// Estende assinatura a partir da expiração atual (ou de hoje se já expirou)
async function _extendSubscription(docRef, dias) {
  const snap = await docRef.get();
  if (!snap.exists) throw new Error('Usuário não encontrado');
  const data  = snap.data();
  const now   = new Date();
  let base    = now;
  if (data.subscriptionExpiresAt) {
    const exp = data.subscriptionExpiresAt.toDate
      ? data.subscriptionExpiresAt.toDate()
      : new Date(data.subscriptionExpiresAt);
    if (exp > now) base = exp;
  }
  return new Date(base.getTime() + dias * 86400000);
}

// ── POST /api/pix/criar — gera QR Code PIX ────────────────────
app.post('/api/pix/criar', pixLimiter, requireAuth, async (req, res) => {
  const MP_TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!MP_TOKEN) {
    return res.status(503).json({ error: 'Pagamento não configurado. Entre em contato pelo WhatsApp: (34) 99796-0026' });
  }

  const { plano } = req.body;
  const p = _subPlanos[plano];
  if (!p) return res.status(400).json({ error: 'Plano inválido' });

  const uid   = req.decodedToken.uid;
  const email = req.decodedToken.email || 'cliente@eventodecaca.com';
  const valor = _grossAmount(p.net);

  try {
    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method:  'POST',
      headers: {
        'Authorization':     `Bearer ${MP_TOKEN}`,
        'Content-Type':      'application/json',
        'X-Idempotency-Key': `caca-${uid}-${plano}-${Date.now()}`,
      },
      body: JSON.stringify({
        transaction_amount: valor,
        description:        p.nome,
        payment_method_id:  'pix',
        external_reference: p.horas
          ? `${uid}|${plano}|h:${p.horas}`   // horas: uid|1h|h:1
          : `${uid}|${plano}|${p.dias}`,      // dias:  uid|30d|30
        payer: { email },
      }),
    });

    const data = await mpRes.json();
    if (!mpRes.ok) {
      console.error('[PIX CRIAR]', data);
      return res.status(502).json({ error: data.message || 'Erro ao criar pagamento' });
    }

    res.json({
      payment_id:     data.id,
      status:         data.status,
      qr_code:        data.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: data.point_of_interaction?.transaction_data?.qr_code_base64,
      valor,
      plano,
      dias: p.dias,
    });
  } catch (e) {
    console.error('[PIX CRIAR]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/pix/status/:id — consulta status do pagamento ────
app.get('/api/pix/status/:id', requireAuth, async (req, res) => {
  const MP_TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!MP_TOKEN) return res.status(503).json({ error: 'MP não configurado' });

  try {
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${req.params.id}`, {
      headers: { 'Authorization': `Bearer ${MP_TOKEN}` },
    });
    const data = await mpRes.json();

    // Verifica se o pagamento pertence ao usuário autenticado
    const extParts = (data.external_reference || '').split('|');
    const payUid   = extParts[0];
    if (payUid && payUid !== req.decodedToken.uid) {
      return res.status(403).json({ error: 'Acesso negado — pagamento não pertence a este usuário' });
    }

    res.json({ status: data.status, status_detail: data.status_detail });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/pix/confirmar — libera acesso após pagamento aprovado ──
// Chamado pelo frontend quando polling detecta status=approved
// Usa Admin SDK (bypassa regras Firestore) para atualizar a assinatura
app.post('/api/pix/confirmar', pixLimiter, requireAuth, async (req, res) => {
  const MP_TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!MP_TOKEN) return res.status(503).json({ error: 'MP não configurado' });

  const { paymentId, plano } = req.body;
  if (!paymentId || !plano) return res.status(400).json({ error: 'paymentId e plano obrigatórios' });

  // uid declarado fora do try — necessário para validação de propriedade antes de qualquer await
  const uid = req.decodedToken.uid;

  try {
    // 1. Verifica status do pagamento no Mercado Pago
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${MP_TOKEN}` },
    });
    const payment = await mpRes.json();

    if (payment.status !== 'approved') {
      return res.status(402).json({ error: `Pagamento não aprovado: ${payment.status}` });
    }

    // 2. Valida que o plano e uid batem com o external_reference gravado no MP
    //    Impede atacante de pagar R$1 e reivindicar plano de 90 dias
    const extParts   = (payment.external_reference || '').split('|');
    const extUid     = extParts[0];
    const extPlano   = extParts[1];
    if (extUid !== uid) {
      return res.status(403).json({ error: 'Pagamento não pertence a este usuário' });
    }
    if (extPlano && extPlano !== plano) {
      return res.status(403).json({ error: 'Plano não corresponde ao pagamento realizado' });
    }

    const p = _subPlanos[plano];
    if (!p) return res.status(400).json({ error: 'Plano inválido' });

    const newExpiry = p.horas
      ? new Date(Date.now() + p.horas * 3600000)
      : new Date(Date.now() + (p.dias || 30) * 86400000);

    // 3. Atualiza Firestore com Admin SDK (sem restrições de regras)
    const snap = await db.collection('guild_users').where('uid', '==', uid).get();
    if (snap.empty) return res.status(404).json({ error: 'Usuário não encontrado' });

    const userDocRef = snap.docs[0].ref;
    const userDoc    = snap.docs[0].data();

    // Proteção contra double-spend: rejeita se paymentId já foi processado
    if (userDoc.lastPaymentId && String(userDoc.lastPaymentId) === String(paymentId)) {
      return res.status(409).json({ error: 'Pagamento já processado anteriormente' });
    }

    const now = new Date();

    await userDocRef.update({
      subscriptionExpiresAt: newExpiry,
      subscriptionPlan:      plano,
      subscriptionPending:   false,
      lastPaymentId:         String(paymentId),
      lastPaymentAt:         now,
      lastPaymentAmount:     payment.transaction_amount,
    });

    // Grava entrada no histórico de pagamentos (subcoleção)
    await userDocRef.collection('pay_history').add({
      paymentId: String(paymentId),
      plano,
      amount:    payment.transaction_amount,
      paidAt:    now,
      expiresAt: newExpiry,
      source:    'PIX',
    });

    console.log(`[CONFIRMAR] uid=${uid} plano=${plano} expira=${newExpiry.toISOString()}`);
    res.json({ ok: true, expiresAt: newExpiry.toISOString(), plano });

  } catch (e) {
    console.error('[CONFIRMAR]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/webhook/mercadopago — recebe notificações MP ────
app.post('/api/webhook/mercadopago', express.raw({ type: '*/*' }), async (req, res) => {
  // Valida assinatura HMAC do MercadoPago (obrigatório — rejeita se MP_WEBHOOK_SECRET não configurado)
  const MP_SECRET = process.env.MP_WEBHOOK_SECRET;
  if (!MP_SECRET) {
    console.error('[WEBHOOK MP] MP_WEBHOOK_SECRET não configurado — rejeitando requisição por segurança');
    return res.status(500).json({ error: 'Webhook não configurado' });
  }
  const crypto     = require('crypto');
  const xSignature = req.headers['x-signature'] || '';
  const xRequestId = req.headers['x-request-id'] || '';
  const urlParams  = new URLSearchParams(req.originalUrl.split('?')[1] || '');
  const dataId     = urlParams.get('data.id') || '';
  const ts         = (xSignature.match(/ts=(\d+)/) || [])[1] || '';
  const manifest   = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const sigPart    = (xSignature.match(/v1=([^,]+)/) || [])[1] || '';
  const expected   = crypto.createHmac('sha256', MP_SECRET).update(manifest).digest('hex');
  if (!sigPart || expected !== sigPart) {
    console.warn('[WEBHOOK MP] Assinatura inválida — possível requisição forjada');
    return res.status(401).json({ error: 'Assinatura inválida' });
  }

  try {
    const body = JSON.parse(req.body.toString());
    if (body.type !== 'payment') return res.status(200).json({ ok: true });

    const paymentId = body.data?.id;
    if (!paymentId) return res.status(200).json({ ok: true });

    const MP_TOKEN = process.env.MP_ACCESS_TOKEN;
    if (!MP_TOKEN) return res.status(200).json({ ok: true });

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${MP_TOKEN}` },
    });
    const payment = await mpRes.json();
    if (payment.status !== 'approved') return res.status(200).json({ ok: true });

    const parts = (payment.external_reference || '').split('|');
    const uid   = parts[0];
    const plano = parts[1] || '30d';
    const ref3  = parts[2] || '30';
    if (!uid) return res.status(200).json({ ok: true });

    const snap = await db.collection('guild_users').where('uid', '==', uid).get();
    if (snap.empty) return res.status(200).json({ ok: true });

    const docRef  = snap.docs[0].ref;
    const docData = snap.docs[0].data();

    // Anti-replay: ignora se paymentId já foi processado
    if (docData.lastPaymentId && String(docData.lastPaymentId) === String(paymentId)) {
      console.log(`[WEBHOOK MP] paymentId ${paymentId} já processado — ignorado`);
      return res.status(200).json({ ok: true });
    }

    // Calcula expiração: horas (h:N) ou dias (N)
    let newExpiry;
    if (ref3.startsWith('h:')) {
      const horas = parseInt(ref3.slice(2)) || 1;
      newExpiry = new Date(Date.now() + horas * 3600000);
      console.log(`[WEBHOOK MP] uid=${uid} plano=${plano} +${horas}h → ${newExpiry.toISOString()}`);
    } else {
      const dias = parseInt(ref3) || 30;
      newExpiry  = new Date(Date.now() + dias * 86400000);
      console.log(`[WEBHOOK MP] uid=${uid} plano=${plano} +${dias}d → ${newExpiry.toISOString()}`);
    }

    const now = new Date();
    await docRef.update({
      subscriptionExpiresAt: newExpiry,
      subscriptionPlan:      plano,
      subscriptionPending:   false,
      lastPaymentId:         String(paymentId),
      lastPaymentAt:         now,
      lastPaymentAmount:     payment.transaction_amount,
    });

    // Grava histórico de pagamentos
    await docRef.collection('pay_history').add({
      paymentId: String(paymentId),
      plano,
      amount:    payment.transaction_amount,
      paidAt:    now,
      expiresAt: newExpiry,
      source:    'PIX-webhook',
    });

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[WEBHOOK MP]', e.message);
    res.status(200).json({ ok: true });
  }
});

// ── POST /api/admin/subscription — ativa assinatura manual ────
app.post('/api/admin/subscription', requireAdmin, async (req, res) => {
  const { firestoreDocId, dias } = req.body;
  if (!firestoreDocId || !dias) {
    return res.status(400).json({ error: 'firestoreDocId e dias obrigatórios' });
  }
  const isUnlimited = dias === 'unlimited';
  const d = isUnlimited ? 36500 : parseInt(dias); // 36500 = ~100 anos
  if (!isUnlimited && ![30, 60, 90].includes(d)) {
    return res.status(400).json({ error: 'Dias inválidos — use 30, 60, 90 ou unlimited' });
  }

  try {
    const docRef   = db.collection('guild_users').doc(firestoreDocId);
    const newExpiry = await _extendSubscription(docRef, d);

    await docRef.update({
      subscriptionExpiresAt: newExpiry,
      subscriptionPlan:      isUnlimited ? 'unlimited' : `${d}d`,
      lastPaymentAt:         new Date(),
    });

    const msg = isUnlimited ? '∞ Acesso ilimitado ativado' : `✅ +${d} dias ativados`;
    res.json({ message: msg, expiresAt: newExpiry.toISOString() });
  } catch (e) {
    console.error('[ADMIN SUB]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/admin/notify-improvements — envia push para todos ─
app.post('/api/admin/notify-improvements', requireAdmin, async (req, res) => {
  const { title, body } = req.body;
  if (!title) return res.status(400).json({ error: 'title obrigatório' });

  try {
    // Busca todos os tokens FCM cadastrados
    const snap   = await db.collection('fcm_tokens').get();
    const tokens = snap.docs.map(d => d.data().token).filter(Boolean);

    if (!tokens.length) return res.json({ ok: true, sent: 0, message: 'Nenhum dispositivo registrado' });

    // Envia para todos de uma vez (multicast)
    const result = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      webpush: {
        notification: {
          icon:    'https://caca-d5478.web.app/char_knight2.png',
          badge:   'https://caca-d5478.web.app/char_knight2.png',
          vibrate: [200, 100, 200],
          requireInteraction: true,
        },
        fcmOptions: { link: 'https://caca-d5478.web.app' },
      },
    });

    // Remove tokens inválidos do Firestore
    result.responses.forEach((r, i) => {
      if (!r.success) {
        const docId = snap.docs[i]?.id;
        if (docId) db.collection('fcm_tokens').doc(docId).delete().catch(() => {});
      }
    });

    console.log(`[NOTIFY] Enviado: ${result.successCount} | Falha: ${result.failureCount}`);
    res.json({ ok: true, sent: result.successCount, failed: result.failureCount });
  } catch(e) {
    console.error('[NOTIFY]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Inicia servidor ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ GUILD SVE Server rodando na porta ${PORT}`);
  console.log(`   Projeto Firebase : ${process.env.FIREBASE_PROJECT_ID}`);
  console.log(`   Admin e-mail     : ${process.env.ADMIN_EMAIL}`);
  console.log(`   CORS origin      : ${_rawOrigins}`);
});
