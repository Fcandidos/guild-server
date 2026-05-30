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
const admin      = require('firebase-admin');

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

// ── Express ────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// CORS — só aceita requisições do seu site
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({
  origin: allowedOrigin,
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
  res.json({
    status:   'ok',
    project:  process.env.FIREBASE_PROJECT_ID,
    version:  '2.0-pix',
    mp_token: process.env.MP_ACCESS_TOKEN ? 'configurado' : 'AUSENTE',
    routes:   ['/api/pix/criar', '/api/pix/status/:id', '/api/webhook/mercadopago', '/api/admin/subscription'],
  });
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

// ── POST /api/users — cria usuário (admin) ────────────────────
//  Body: { name, email, password, guildName }
app.post('/api/users', requireAdmin, async (req, res) => {
  const { name, email, password, guildName } = req.body;

  if (!name || !email || !password || !guildName) {
    return res.status(400).json({ error: 'Campos obrigatórios: name, email, password, guildName' });
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

    res.status(201).json({
      message: 'Usuário criado com sucesso',
      id:      docRef.id,
      uid:     userRecord.uid,
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

    const { uid } = docSnap.data();

    // 1. Remove do Firebase Auth
    if (uid) {
      try { await auth.deleteUser(uid); }
      catch (e) { console.warn('[DELETE] Auth user not found, continuing:', e.message); }
    }

    // 2. Remove do Firestore
    await docRef.delete();

    res.json({ message: 'Usuário removido com sucesso' });

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
app.get('/api/me', requireAuth, async (req, res) => {
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
app.post('/api/pix/criar', requireAuth, async (req, res) => {
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
    res.json({ status: data.status, status_detail: data.status_detail });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/pix/confirmar — libera acesso após pagamento aprovado ──
// Chamado pelo frontend quando polling detecta status=approved
// Usa Admin SDK (bypassa regras Firestore) para atualizar a assinatura
app.post('/api/pix/confirmar', requireAuth, async (req, res) => {
  const MP_TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!MP_TOKEN) return res.status(503).json({ error: 'MP não configurado' });

  const { paymentId, plano } = req.body;
  if (!paymentId || !plano) return res.status(400).json({ error: 'paymentId e plano obrigatórios' });

  try {
    // 1. Verifica status do pagamento no Mercado Pago
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${MP_TOKEN}` },
    });
    const payment = await mpRes.json();

    if (payment.status !== 'approved') {
      return res.status(402).json({ error: `Pagamento não aprovado: ${payment.status}` });
    }

    // 2. Calcula expiração baseada no plano
    const p = _subPlanos[plano];
    if (!p) return res.status(400).json({ error: 'Plano inválido' });

    const newExpiry = p.horas
      ? new Date(Date.now() + p.horas * 3600000)
      : new Date(Date.now() + (p.dias || 30) * 86400000);

    // 3. Atualiza Firestore com Admin SDK (sem restrições de regras)
    const uid  = req.decodedToken.uid;
    const snap = await db.collection('guild_users').where('uid', '==', uid).get();
    if (snap.empty) return res.status(404).json({ error: 'Usuário não encontrado' });

    await snap.docs[0].ref.update({
      subscriptionExpiresAt: newExpiry,
      subscriptionPlan:      plano,
      subscriptionPending:   false,
      lastPaymentId:         String(paymentId),
      lastPaymentAt:         new Date(),
      lastPaymentAmount:     payment.transaction_amount,
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

    const docRef = snap.docs[0].ref;

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

    await docRef.update({
      subscriptionExpiresAt: newExpiry,
      subscriptionPlan:      plano,
      subscriptionPending:   false,  // limpa pendente após pagamento confirmado
      lastPaymentId:         String(paymentId),
      lastPaymentAt:         new Date(),
      lastPaymentAmount:     payment.transaction_amount,
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

// ── Inicia servidor ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ GUILD SVE Server rodando na porta ${PORT}`);
  console.log(`   Projeto Firebase : ${process.env.FIREBASE_PROJECT_ID}`);
  console.log(`   Admin e-mail     : ${process.env.ADMIN_EMAIL}`);
  console.log(`   CORS origin      : ${allowedOrigin}`);
});
