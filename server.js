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
const XLSX       = require('xlsx');
const cron       = require('node-cron');
const { TelegramClient } = require('telegram');
const { StringSession }  = require('telegram/sessions');
const { Api }            = require('telegram');

// ── Nodemailer — Gmail (porta 587 TLS — compatível com Render) ──
const _mailer = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASS,
  },
  connectionTimeout: 10000,
  greetingTimeout:   10000,
  socketTimeout:     15000,
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
  res.json({ status: 'ok', version: '2026-06-04-v3' });
});

// ── POST /api/security/event — registra evento de segurança ──────
// Sem auth obrigatório (falhas pré-login precisam ser registradas).
// Proteção contra flood: global rate limiter (60/min por IP já configurado).
// userAgent vem do header HTTP — mais confiável que body do cliente.
app.post('/api/security/event', async (req, res) => {
  const ALLOWED = ['login_failed','password_reset','account_locked','session_expired','unauthorized_access'];
  const { type, email, errorCode } = req.body;
  if (!type || !ALLOWED.includes(type)) {
    return res.status(400).json({ error: 'Tipo de evento inválido' });
  }
  try {
    await db.collection('security_events').add({
      ts:        new Date().toISOString(),
      type,
      email:     String(email     || '').slice(0, 200),
      errorCode: String(errorCode || '').slice(0, 60),
      userAgent: String(req.headers['user-agent'] || '').slice(0, 250),
    });
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ ok: false });
  }
});

// ── POST /api/admin/migrate-guild-claims — define guildId claim para todos os usuários ──
// Executar UMA VEZ após deploy. Após confirmar sucesso, remover || userGuildId() == null das rules.
app.post('/api/admin/migrate-guild-claims', requireAdmin, async (req, res) => {
  try {
    const snap = await db.collection('guild_users').get();
    let ok = 0, skipped = 0;
    const errors = [];
    for (const doc of snap.docs) {
      const { uid, guildName } = doc.data();
      if (!uid || !guildName) { skipped++; continue; }
      try {
        const guildId = _normalizeGuildId(guildName);
        await auth.setCustomUserClaims(uid, { guildId });
        console.log(`[MIGRATE CLAIMS] uid=${uid} guildId=${guildId}`);
        ok++;
      } catch(e) {
        errors.push({ uid, error: e.message });
      }
    }
    res.json({ ok, skipped, errors, total: snap.docs.length });
  } catch(e) {
    console.error('[MIGRATE CLAIMS]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /test-email — testa envio de email (admin only) ─────────
app.get('/test-email', requireAdmin, async (req, res) => {
  const to = req.query.to || process.env.GMAIL_USER;
  try {
    await sendWelcomeEmail({ to, userName: 'Teste', guildName: 'GUILD TESTE', password: 'SENHA123' });
    res.json({ ok: true, sentTo: to, from: process.env.GMAIL_USER });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message, from: process.env.GMAIL_USER });
  }
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

// Normaliza guildName → docId (igual a _sharedDocId() no frontend)
function _normalizeGuildId(guildName) {
  return (guildName || '').toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_\-]/g, c => '_' + c.charCodeAt(0) + '_')
    || 'DEFAULT';
}

// Gera senha aleatória segura de 10 caracteres
function _generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  const { randomInt } = require('crypto');
  let pass = '';
  for (let i = 0; i < 10; i++) pass += chars[randomInt(chars.length)];
  return pass;
}

// ── POST /api/users — cria usuário (admin) ────────────────────
//  Body: { name, email, password (opcional), guildName }
app.post('/api/users', requireAdmin, async (req, res) => {
  const { name, email, guildName, role } = req.body;
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

    // 2. Define custom claim guildId para isolamento de tenant no Firestore
    const guildId = _normalizeGuildId(guildName);
    await auth.setCustomUserClaims(userRecord.uid, { guildId });

    // 3. Salva dados extras no Firestore
    const allowedRoles = ['member', 'viewer', 'lider'];
    const docRef = await db.collection('guild_users').add({
      uid:         userRecord.uid,
      name,
      email:       email.toLowerCase(),
      guildName:   guildName.toUpperCase(),
      role:        allowedRoles.includes(role) ? role : 'member',
      createdAt:   new Date().toLocaleDateString('pt-BR'),
      firstAccess: true,
    });

    // 4. Responde imediatamente e envia email em background (evita timeout)
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
//  Body: { password? }  — se omitido, gera senha temporária e envia email
app.patch('/api/users/:id/password', requireAdmin, async (req, res) => {
  const { id } = req.params;
  let { password } = req.body;

  const autoPass = !password || password.trim() === '';
  if (autoPass) password = _generatePassword();

  if (password.length < 6) {
    return res.status(400).json({ error: 'Senha mínima: 6 caracteres' });
  }

  try {
    const docSnap = await db.collection('guild_users').doc(id).get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const data = docSnap.data();
    let { uid, email, name, guildName } = data;
    if (!uid) return res.status(400).json({ error: 'UID não encontrado no Firestore' });

    // Fallback: busca email direto do Firebase Auth se não estiver no Firestore
    if (!email) {
      try {
        const authUser = await auth.getUser(uid);
        email = authUser.email;
        console.log('[PATCH password] Email obtido do Firebase Auth:', email);
      } catch(e) {
        console.warn('[PATCH password] Não foi possível obter email do Auth:', e.message);
      }
    }

    // Atualiza senha no Firebase Auth
    await auth.updateUser(uid, { password });

    // Marca firstAccess para forçar troca de senha no próximo login
    await db.collection('guild_users').doc(id).update({ firstAccess: true });

    // Responde imediatamente — não bloqueia esperando o email
    res.json({ message: 'Senha redefinida com sucesso', emailSent: autoPass && !!email });

    // Envia email em background (não bloqueia a resposta)
    if (autoPass && email) {
      console.log('[PATCH password] Enviando email para:', email);
      sendWelcomeEmail({
        to:        email,
        userName:  name      || 'Membro',
        guildName: guildName || 'Guild',
        password,
      }).catch(e => console.error('[PATCH password] Email falhou:', e.message));
    } else if (autoPass) {
      console.warn('[PATCH password] Email não encontrado para uid:', uid);
    }

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
    const docSnap = await db.collection('guild_users').doc(id).get();
    if (!docSnap.exists) return res.status(404).json({ error: 'Usuário não encontrado' });
    const { uid } = docSnap.data();

    await db.collection('guild_users').doc(id).update({
      guildName: guildName.toUpperCase(),
    });

    // Atualiza custom claim para refletir nova guild (token do usuário precisará refresh)
    if (uid) {
      await auth.setCustomUserClaims(uid, { guildId: _normalizeGuildId(guildName) });
    }

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

// ── POST /api/trial/activate — ativa trial de 1h (self-service, uma vez) ──
// O servidor controla a expiração — cliente não pode manipular o valor
app.post('/api/trial/activate', requireAuth, async (req, res) => {
  const uid = req.decodedToken.uid;
  try {
    const snap = await db.collection('guild_users').where('uid', '==', uid).get();
    if (snap.empty) return res.status(404).json({ error: 'Usuário não encontrado' });

    const docRef = snap.docs[0].ref;
    const data   = snap.docs[0].data();

    if (data.trialUsed) {
      return res.status(409).json({ error: 'Trial já utilizado' });
    }

    const now       = new Date();
    const expiresAt = new Date(now.getTime() + 3600000); // exatamente 1h — server-controlled

    await docRef.update({
      trialUsed:      true,
      trialStartedAt: now,
      trialExpiresAt: expiresAt,
    });

    console.log(`[TRIAL] uid=${uid} trial ativado → expira ${expiresAt.toISOString()}`);
    res.json({ ok: true, expiresAt: expiresAt.toISOString() });
  } catch (e) {
    console.error('[TRIAL ACTIVATE]', e.message);
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

// ═══════════════════════════════════════════════════════════════
//  TELEGRAM — Monitor de grupos via MTProto
// ═══════════════════════════════════════════════════════════════
let _tgClient = null;

async function getTgClient() {
  if (_tgClient) return _tgClient;
  const session = process.env.TG_SESSION || '';
  const apiId   = parseInt(process.env.TG_API_ID);
  const apiHash = process.env.TG_API_HASH;
  if (!session || !apiId || !apiHash) return null;
  try {
    const client = new TelegramClient(
      new StringSession(session),
      apiId, apiHash,
      { connectionRetries: 5, retryDelay: 1000 }
    );
    await client.connect();
    _tgClient = client;
    console.log('✅ Telegram client conectado');
    return client;
  } catch(e) {
    console.error('❌ Telegram client erro:', e.message);
    return null;
  }
}

async function sendCommandAndWaitXlsx(groupId, prefix, timeoutMs = 60000) {
  const client = await getTgClient();
  if (!client) throw new Error('Telegram não conectado — verifique TG_SESSION no Render');

  const cmd    = `${prefix}stats all`;
  const entity = await client.getEntity(groupId);

  const before = await client.getMessages(entity, { limit: 1 });
  let lastId   = before[0]?.id || 0;

  const sentMsg  = await client.sendMessage(entity, { message: cmd });
  const toDelete = [sentMsg.id];
  console.log(`📤 Telegram: "${cmd}" enviado (id=${sentMsg.id})`);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3000));

    const history = await client.invoke(new Api.messages.GetHistory({
      peer: entity, offsetId: 0, offsetDate: 0, addOffset: 0,
      limit: 10, maxId: 0, minId: lastId, hash: BigInt(0),
    }));

    const novas = (history.messages || [])
      .filter(m => m.id > lastId)
      .sort((a, b) => a.id - b.id);

    if (novas.length > 0) {
      lastId = Math.max(lastId, ...novas.map(m => m.id));
      novas.forEach(m => {
        if (!toDelete.includes(m.id)) toDelete.push(m.id);
      });
    }

    for (const msg of novas) {
      const doc      = msg.media?.document;
      const fileAttr = doc ? (doc.attributes||[]).find(a => a.className === 'DocumentAttributeFilename') : null;
      const fileName = fileAttr?.fileName || '';
      if (!fileName.endsWith('.xlsx')) continue;

      // Download com retry em caso de timeout
      let buffer = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`📥 Download tentativa ${attempt}/3: ${fileName}`);
          buffer = await client.downloadMedia(msg, { workers: 1 });
          if (buffer) break;
        } catch(e) {
          console.warn(`⚠️ Download tentativa ${attempt} falhou: ${e.message}`);
          if (attempt < 3) await new Promise(r => setTimeout(r, 3000));
        }
      }
      if (!buffer) {
        console.error('❌ Download falhou após 3 tentativas');
        // Deleta as mensagens mesmo assim para não deixar lixo
        try { await client.deleteMessages(entity, toDelete, { revoke: true }); } catch(_) {}
        throw new Error('Falha ao baixar o arquivo do Telegram após 3 tentativas');
      }

      const wb   = XLSX.read(buffer, { type: 'buffer' });
      const data = {};
      wb.SheetNames.forEach(sheet => {
        data[sheet] = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: '' });
      });

      // Deleta mensagens do grupo
      try {
        await client.deleteMessages(entity, toDelete, { revoke: true });
        console.log(`🗑️ ${toDelete.length} msg(s) deletada(s)`);
      } catch(e) {
        console.warn('⚠️ Falha ao deletar lote, tentando uma a uma:', e.message);
        for (const id of toDelete) {
          try { await client.deleteMessages(entity, [id], { revoke: true }); } catch(_) {}
        }
      }

      return { ok: true, fileName, data };
    }
  }
  throw new Error('Timeout — xlsx não chegou em 60s');
}

// POST /api/telegram/update-stats — busca xlsx via Telegram
app.post('/api/telegram/update-stats', requireAuth, async (req, res) => {
  const { groupId, prefix } = req.body;
  if (!groupId || !prefix) return res.status(400).json({ error: 'groupId e prefix obrigatórios' });

  // Valida que o groupId pertence à guild do usuário autenticado
  const uid = req.decodedToken.uid;
  const adminEmail = process.env.ADMIN_EMAIL || '';
  const isAdmin = req.decodedToken.email?.toLowerCase() === adminEmail.toLowerCase();
  if (!isAdmin) {
    try {
      const userDoc = await db.collection('guild_users').doc(uid).get();
      const userData = userDoc.data() || {};
      const allowedGroupId = String(userData.tgGroupId || '');
      if (!allowedGroupId || allowedGroupId !== String(groupId)) {
        return res.status(403).json({ error: 'Grupo não autorizado para este usuário' });
      }
    } catch(e) {
      return res.status(500).json({ error: 'Erro ao validar permissão do grupo' });
    }
  }

  try {
    const result = await sendCommandAndWaitXlsx(groupId, prefix);
    res.json(result);
  } catch(e) {
    console.error('[TELEGRAM]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/telegram/health — status do cliente Telegram + timer
app.get('/api/telegram/health', requireAdmin, async (req, res) => {
  const client = await getTgClient();
  const now    = Date.now();
  const nextAt = _tgLastUpdateAt + _tgIntervalMs;
  const secsLeft = Math.max(0, Math.floor((nextAt - now) / 1000));
  res.json({ ok: !!client, connected: !!client, lastUpdateAt: _tgLastUpdateAt, secondsLeft: secsLeft });
});

// POST /api/telegram/find-group — descobre ID do grupo pelo link de convite
app.post('/api/telegram/find-group', requireAdmin, async (req, res) => {
  const { inviteLink } = req.body;
  if (!inviteLink) return res.status(400).json({ error: 'inviteLink obrigatório' });

  const client = await getTgClient();
  if (!client) return res.status(503).json({ error: 'Telegram não conectado' });

  try {
    // Extrai hash do link (t.me/+HASH ou t.me/joinchat/HASH)
    const hashMatch = inviteLink.match(/(?:t\.me\/\+|t\.me\/joinchat\/)([A-Za-z0-9_-]+)/);

    if (hashMatch) {
      const hash = hashMatch[1];
      // Tenta verificar sem entrar (retorna ID se já for membro)
      try {
        const check = await client.invoke(new Api.messages.CheckChatInvite({ hash }));
        if (check.className === 'ChatInviteAlready' && check.chat) {
          const c = check.chat;
          const id = c.megagroup || c.broadcast ? -(1000000000000 + Number(c.id)) : -Number(c.id);
          return res.json({ ok: true, groupId: id, name: c.title, type: c.className });
        }
        // Se ChatInvite (não é membro), tenta entrar para obter o ID
        const joined = await client.invoke(new Api.messages.ImportChatInvite({ hash }));
        const chat = (joined.chats || [])[0];
        if (chat) {
          const id = chat.megagroup || chat.broadcast ? -(1000000000000 + Number(chat.id)) : -Number(chat.id);
          return res.json({ ok: true, groupId: id, name: chat.title, type: chat.className });
        }
      } catch(e) {
        if (e.message?.includes('INVITE_HASH_EXPIRED')) return res.status(400).json({ error: 'Link expirado' });
        if (e.message?.includes('USER_ALREADY_PARTICIPANT')) {
          // Já é membro — busca nos diálogos
        }
        throw e;
      }
    }

    // Tenta como username público (@grupname)
    const usernameMatch = inviteLink.match(/t\.me\/([A-Za-z0-9_]+)/);
    if (usernameMatch) {
      const entity = await client.getEntity(usernameMatch[1]);
      if (entity) {
        const id = entity.megagroup || entity.broadcast ? -(1000000000000 + Number(entity.id)) : -Number(entity.id);
        return res.json({ ok: true, groupId: id, name: entity.title, type: entity.className });
      }
    }

    res.status(400).json({ error: 'Não foi possível encontrar o grupo. Verifique o link.' });
  } catch(e) {
    console.error('[find-group]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/telegram/timer — tempo restante
app.get('/api/telegram/timer', requireAuth, async (req, res) => {
  const now      = Date.now();
  const nextAt   = _tgLastUpdateAt + _tgIntervalMs;
  const secsLeft = Math.max(0, Math.floor((nextAt - now) / 1000));
  res.json({ lastUpdateAt: _tgLastUpdateAt, secondsLeft: secsLeft, intervalMs: _tgIntervalMs });
});

// ── Auto-update configurável no servidor ──────────────────────
let _tgIntervalMs   = 30 * 60 * 1000; // padrão 30 min
let _tgLastUpdateAt = Date.now();
let _tgAutoRunning  = false;
let _tgAutoTimer    = null;

// POST /api/telegram/set-interval — configura intervalo
app.post('/api/telegram/set-interval', requireAdmin, (req, res) => {
  const mins = parseInt(req.body.intervalMinutes);
  if (!mins || mins < 5) return res.status(400).json({ error: 'Mínimo 5 minutos' });
  _tgIntervalMs   = mins * 60 * 1000;
  _tgLastUpdateAt = Date.now();
  if (_tgAutoTimer) clearInterval(_tgAutoTimer);
  _tgAutoTimer = setInterval(tgAutoUpdate, _tgIntervalMs);
  console.log(`[TG] Intervalo atualizado para ${mins} min`);
  res.json({ ok: true, intervalMinutes: mins });
});

// Converte JSON do xlsx para formato allData (igual ao parseRows do front-end)
function xlsxJsonToAllData(jsonData) {
  const sheetName = Object.keys(jsonData)[0];
  const rows      = jsonData[sheetName] || [];
  const n = (v) => parseFloat(v) || 0;
  const allData = [];
  for (const r of rows) {
    if (!r['Name'] || r['Name'] === 'Total') continue;
    const l1h = n(r['L1 (Hunt)']); const l2h = n(r['L2 (Hunt)']); const l3h = n(r['L3 (Hunt)']);
    const l4h = n(r['L4 (Hunt)']); const l5h = n(r['L5 (Hunt)']);
    const l1p = n(r['L1 (Purchase)']); const l2p = n(r['L2 (Purchase)']); const l3p = n(r['L3 (Purchase)']);
    const l4p = n(r['L4 (Purchase)']); const l5p = n(r['L5 (Purchase)']);
    const pts = l2h*1 + l3h*3 + l4h*6 + l5h*12 + l2p*1 + l3p*3 + l4p*6 + l5p*12;
    allData.push({
      userId: String(r['User ID'] || ''), name: r['Name'],
      totalKills: n(r['Total']), l1h, l2h, l3h, l4h, l5h, l1p, l2p, l3p, l4p, l5p, pts
    });
  }
  allData.sort((a, b) => b.pts - a.pts);
  allData.forEach((d, i) => d.rank = i + 1);
  return allData;
}

async function tgAutoUpdate() {
  if (_tgAutoRunning) return;
  _tgAutoRunning = true;
  const now = Date.now();
  console.log('[TG AUTO] Verificando guilds para atualização...');
  try {
    const adminConfig = await db.collection('shared_reports').doc('ADMIN_CONFIG').get();
    const admData = adminConfig.exists ? adminConfig.data() : {};
    const groups = [];

    // Admin — usa tgInterval do ADMIN_CONFIG
    if (admData.tgGroupId && admData.tgPrefix) {
      const admInterval  = (admData.tgInterval || 30) * 60 * 1000;
      const admLastUpd   = admData.tgLastUpdate ? new Date(admData.tgLastUpdate).getTime() : 0;
      if (now - admLastUpd >= admInterval) {
        const gn = admData.guildName || 'GUILD';
        groups.push({ groupId: admData.tgGroupId, prefix: admData.tgPrefix, guildName: gn,
          uploadedBy: 'auto', sharedDocId: gn.toUpperCase().replace(/\s+/g,'_'), isAdmin: true });
      } else {
        console.log(`[TG AUTO] Skip admin guild — próximo em ~${Math.round((admInterval-(now-admLastUpd))/60000)}min`);
      }
    }

    // Usuários — cada um com seu próprio tgInterval
    const snap = await db.collection('guild_users').where('tgGroupId', '!=', null).get();
    snap.docs.forEach(doc => {
      const d = doc.data();
      if (!d.tgGroupId || !d.tgPrefix) return;
      const interval   = (d.tgInterval || 30) * 60 * 1000;
      const lastUpdate = d.tgLastUpdate ? new Date(d.tgLastUpdate).getTime() : 0;
      if (now - lastUpdate >= interval) {
        const gn = d.guildName || 'GUILD';
        groups.push({ groupId: d.tgGroupId, prefix: d.tgPrefix, guildName: gn,
          uploadedBy: d.email || 'auto', sharedDocId: gn.toUpperCase().replace(/\s+/g,'_'), docId: doc.id });
      } else {
        console.log(`[TG AUTO] Skip ${d.guildName} — próximo em ~${Math.round((interval-(now-lastUpdate))/60000)}min`);
      }
    });

    if (!groups.length) { console.log('[TG AUTO] Nenhuma guild precisa atualizar agora.'); return; }

    const seen = new Set();
    for (const g of groups) {
      if (seen.has(g.groupId)) continue;
      seen.add(g.groupId);
      try {
        console.log(`[TG AUTO] Atualizando ${g.guildName} (grupo ${g.groupId})...`);
        const result    = await sendCommandAndWaitXlsx(g.groupId, g.prefix);
        const freshData = xlsxJsonToAllData(result.data);
        const savedAt   = new Date().toISOString();

        // Filtra o novo arquivo para só incluir membros que já estão no relatório atual.
        // Isso evita que o auto-update adicione de volta membros que o admin removeu manualmente.
        let finalData = freshData;
        try {
          const currentSnap = await db.collection('shared_reports').doc(g.sharedDocId).get();
          if (currentSnap.exists) {
            const currentMembers = currentSnap.data().data || [];
            if (currentMembers.length > 0) {
              const currentIds = new Set(
                currentMembers.map(m => String(m.userId || m.name || '').toLowerCase().trim())
                  .filter(Boolean)
              );
              const filtered = freshData.filter(m =>
                currentIds.has(String(m.userId || m.name || '').toLowerCase().trim())
              );
              // Só aplica o filtro se houver overlap — na primeira execução usa todos
              if (filtered.length > 0) finalData = filtered;
            }
          }
        } catch(e) { console.warn('[TG AUTO] Aviso ao filtrar membros:', e.message); }

        await db.collection('shared_reports').doc(g.sharedDocId).set({
          data: finalData, filename: result.fileName, uploadedBy: 'auto-update',
          guildName: g.guildName, savedAt,
        }, { merge: true });

        if (g.isAdmin) {
          await db.collection('shared_reports').doc('ADMIN_CONFIG').update({ tgLastUpdate: savedAt });
          _tgLastUpdateAt = Date.now();
        } else if (g.docId) {
          await db.collection('guild_users').doc(g.docId).update({ tgLastUpdate: savedAt, tgLastFile: result.fileName });
        }

        console.log(`[TG AUTO] ✅ ${g.guildName}: ${result.fileName} (${allData.length} membros)`);
      } catch(e) {
        console.warn(`[TG AUTO] ❌ ${g.guildName}: ${e.message}`);
      }
    }
  } catch(e) {
    console.error('[TG AUTO] Erro geral:', e.message);
  } finally {
    _tgAutoRunning = false;
  }
}

// ── Helpers para jobs agendados ───────────────────────────────

// Retorna data no fuso de Brasília (UTC-3) como string YYYY-MM-DD
function getBRTDateStr(offsetDays = 0) {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() - 3);
  if (offsetDays) d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// Retorna todas as guilds com Telegram configurado (admin + usuários)
async function _getConfiguredGuilds() {
  const guilds = [];
  const adminSnap = await db.collection('shared_reports').doc('ADMIN_CONFIG').get();
  if (adminSnap.exists()) {
    const d = adminSnap.data();
    if (d.tgGroupId && d.tgPrefix) {
      const gn = d.guildName || 'GUILD';
      guilds.push({ groupId: d.tgGroupId, prefix: d.tgPrefix, guildName: gn,
        sharedDocId: gn.toUpperCase().replace(/\s+/g,'_'), isAdmin: true });
    }
  }
  const snap = await db.collection('guild_users').where('tgGroupId', '!=', null).get();
  snap.docs.forEach(doc => {
    const d = doc.data();
    if (!d.tgGroupId || !d.tgPrefix) return;
    const gn = d.guildName || 'GUILD';
    guilds.push({ groupId: d.tgGroupId, prefix: d.tgPrefix, guildName: gn,
      sharedDocId: gn.toUpperCase().replace(/\s+/g,'_'), docId: doc.id });
  });
  return guilds;
}

// ── Job 23:55 BRT — última atualização da semana ──────────────
cron.schedule('55 23 * * *', async () => {
  const today = getBRTDateStr();
  console.log(`[CRON 23:55] Verificando guilds para atualização final (${today})...`);
  try {
    const guilds = await _getConfiguredGuilds();
    let disparou = 0;
    for (const g of guilds) {
      const sharedSnap = await db.collection('shared_reports').doc(g.sharedDocId).get();
      if (!sharedSnap.exists()) continue;
      const goals = (sharedSnap.data().goals || {});
      if (goals.goalDateEnd !== today) continue;
      console.log(`[CRON 23:55] Última atualização da semana → ${g.guildName}`);
      try {
        const result     = await sendCommandAndWaitXlsx(g.groupId, g.prefix);
        const freshData  = xlsxJsonToAllData(result.data);
        const savedAt    = new Date().toISOString();
        // Mesma lógica do auto-update: só atualiza membros já presentes no relatório
        let finalData = freshData;
        const currentMembers = sharedSnap.data().data || [];
        if (currentMembers.length > 0) {
          const currentIds = new Set(
            currentMembers.map(m => String(m.userId || m.name || '').toLowerCase().trim()).filter(Boolean)
          );
          const filtered = freshData.filter(m =>
            currentIds.has(String(m.userId || m.name || '').toLowerCase().trim())
          );
          if (filtered.length > 0) finalData = filtered;
        }
        await db.collection('shared_reports').doc(g.sharedDocId).set(
          { data: finalData, filename: result.fileName, uploadedBy: 'cron-final', guildName: g.guildName, savedAt },
          { merge: true }
        );
        if (g.isAdmin) {
          await db.collection('shared_reports').doc('ADMIN_CONFIG').update({ tgLastUpdate: savedAt });
          _tgLastUpdateAt = Date.now();
        } else if (g.docId) {
          await db.collection('guild_users').doc(g.docId).update({ tgLastUpdate: savedAt });
        }
        console.log(`[CRON 23:55] ✅ ${g.guildName}: relatório final gerado (${result.fileName})`);
        disparou++;
      } catch(e) {
        console.warn(`[CRON 23:55] ❌ ${g.guildName}: ${e.message}`);
      }
    }
    if (!disparou) console.log('[CRON 23:55] Nenhuma guild termina hoje.');
  } catch(e) {
    console.error('[CRON 23:55] Erro:', e.message);
  }
}, { timezone: 'America/Sao_Paulo' });

// ── Job 00:01 BRT — virada de semana ─────────────────────────
cron.schedule('1 0 * * *', async () => {
  const yesterday = getBRTDateStr(-1);
  console.log(`[CRON 00:01] Verificando virada de semana (fim: ${yesterday})...`);
  try {
    const guilds = await _getConfiguredGuilds();
    let virou = 0;
    for (const g of guilds) {
      const sharedSnap = await db.collection('shared_reports').doc(g.sharedDocId).get();
      if (!sharedSnap.exists()) continue;
      const goals = (sharedSnap.data().goals || {});
      if (goals.goalDateEnd !== yesterday) continue;
      const oldEnd   = new Date(yesterday + 'T12:00:00Z');
      const newStart = new Date(oldEnd); newStart.setUTCDate(newStart.getUTCDate() + 1);
      const newEnd   = new Date(newStart); newEnd.setUTCDate(newEnd.getUTCDate() + 6);
      const newStartStr = newStart.toISOString().slice(0, 10);
      const newEndStr   = newEnd.toISOString().slice(0, 10);
      await db.collection('shared_reports').doc(g.sharedDocId).update({
        'goals.goalDateStart': newStartStr,
        'goals.goalDateEnd':   newEndStr,
      });
      console.log(`[CRON 00:01] ✅ ${g.guildName}: nova semana ${newStartStr} – ${newEndStr}`);
      virou++;
    }
    if (!virou) console.log('[CRON 00:01] Nenhuma guild virou semana hoje.');
  } catch(e) {
    console.error('[CRON 00:01] Erro:', e.message);
  }
}, { timezone: 'America/Sao_Paulo' });

// ── Inicia servidor ────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`✅ GUILD SVE Server rodando na porta ${PORT}`);
  console.log(`   Projeto Firebase : ${process.env.FIREBASE_PROJECT_ID}`);
  console.log(`   Admin e-mail     : ${process.env.ADMIN_EMAIL}`);
  console.log(`   CORS origin      : ${_rawOrigins}`);

  // Inicia cliente Telegram e timer automático
  await getTgClient();

  // Restaura intervalo e último update do Firestore — evita reverter para 30min após restart
  try {
    const cfg = await db.collection('shared_reports').doc('ADMIN_CONFIG').get();
    if (cfg.exists) {
      const d = cfg.data();
      if (d.tgInterval)    _tgIntervalMs   = d.tgInterval * 60 * 1000;
      if (d.tgLastUpdate)  _tgLastUpdateAt  = new Date(d.tgLastUpdate).getTime();
      console.log(`   Telegram config restaurado: intervalo=${d.tgInterval || 30}min, último update=${d.tgLastUpdate || 'nunca'}`);
    }
  } catch(e) {
    console.warn('   [INIT] Não foi possível restaurar config Telegram do Firestore:', e.message);
  }

  // Tick a cada 30 min — cada guild decide internamente se é hora de atualizar
  // com base no seu próprio tgInterval configurado
  _tgAutoTimer = setInterval(tgAutoUpdate, 30 * 60 * 1000);
  console.log('   Telegram auto-update: tick a cada 30 min (intervalo por guild)');
});
