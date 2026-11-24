import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dns from 'node:dns/promises';
import nodeDns from 'node:dns';
import nodemailer from 'nodemailer';
import { cleanBusinessName } from './name-cleaner.mjs';

try {
  nodeDns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Parser leve de .env sem necessidade de dependência externa
function loadEnv() {
  const envPath = path.join(rootDir, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx !== -1) {
        const key = line.slice(0, eqIdx).trim();
        const val = line.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

// Resolução dos arquivos de entrada e progresso
const primaryDataPath = path.join(rootDir, 'output', 'leads_com_email.json');
const fallbackDataPath = path.join(rootDir, 'output', 'leads_com_email.example.json');
const dataPath = fs.existsSync(primaryDataPath) ? primaryDataPath : fallbackDataPath;
const progressPath = path.join(rootDir, 'output', 'progresso.json');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadProgress() {
  if (fs.existsSync(progressPath)) {
    try {
      return JSON.parse(fs.readFileSync(progressPath, 'utf8'));
    } catch {
      return { sent: [] };
    }
  }
  return { sent: [] };
}

function saveProgress(data) {
  fs.mkdirSync(path.dirname(progressPath), { recursive: true });
  fs.writeFileSync(progressPath, JSON.stringify(data, null, 2), 'utf8');
}

// Gera o corpo do e-mail de abordagem personalizado
function generateEmailBody(empresaNome) {
  const clean = cleanBusinessName(empresaNome);
  return `Olá, equipe da ${clean}! Tudo bem?

Escrevo para apresentar uma oportunidade de modernização digital focada em empresas de destaque no setor.

Sou desenvolvedor de software e desenvolvo soluções sob medida para empresas aumentarem suas vendas e otimizarem operações:
• Portais corporativos e vitrines digitais de alta conversão
• Automação de orçamentos e cardápios inteligentes integrados ao WhatsApp
• Ferramentas internas para redução de tarefas manuais e captação de clientes

Disponibilizei em anexo meu portfólio completo com projetos recentes.

Vocês teriam 5 minutos esta semana para um café rápido ou uma troca de mensagens sobre como podemos potencializar os canais da ${clean}?

Atenciosamente,

Rian Guilherme Joner
Desenvolvedor de Software & Automação B2B
GitHub: https://github.com/rianjoner1-dot
LinkedIn: https://linkedin.com/in/rian-joner-854737227
`;
}

async function main() {
  const args = process.argv.slice(2);
  const isSend = args.includes('--send');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

  const intervalArg = args.find(a => a.startsWith('--interval='));
  const intervalMinutes = intervalArg
    ? parseFloat(intervalArg.split('=')[1])
    : parseFloat(process.env.INTERVAL_MINUTES || '10');

  const attachmentArg = args.find(a => a.startsWith('--attachment='));
  const attachmentPath = attachmentArg
    ? attachmentArg.split('=')[1]
    : process.env.ATTACHMENT_PATH;

  console.log('='.repeat(70));
  console.log('  📬 B2B MAIL MINER — MOTOR DE DISPARO OUTBOUND');
  console.log('='.repeat(70));

  if (!fs.existsSync(dataPath)) {
    console.error(`❌ Arquivo de leads não encontrado: ${dataPath}`);
    console.error(`Dica: execute primeiro 'npm run extract' ou crie 'output/leads_com_email.json'.`);
    process.exit(1);
  }

  const rawLeads = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const leads = rawLeads.map(l => ({
    ...l,
    email: l.primaryEmail || (Array.isArray(l.emails) ? l.emails[0] : l.email)
  })).filter(l => l.email);

  const progress = loadProgress();
  const sentEmails = new Set(progress.sent.map(s => s.email.toLowerCase()));
  const pendingLeads = leads.filter(l => !sentEmails.has(l.email.toLowerCase()));

  console.log(`[Base total]     : ${leads.length} leads com e-mail`);
  console.log(`[Já disparados]  : ${sentEmails.size}`);
  console.log(`[Fila pendente]  : ${pendingLeads.length}`);
  console.log(`[Modo de operação]: ${isSend ? '🚀 ENVIO REAL ATIVADO' : '🔍 PREVIEW / DRY-RUN (Nenhum e-mail será enviado)'}`);
  console.log(`[Cadência]       : 1 e-mail a cada ${intervalMinutes} minutos`);

  if (attachmentPath) {
    const fullAttach = path.isAbsolute(attachmentPath) ? attachmentPath : path.resolve(rootDir, attachmentPath);
    if (fs.existsSync(fullAttach)) {
      console.log(`[Anexo]          : 📎 ${path.basename(fullAttach)}`);
    } else {
      console.log(`[Aviso Anexo]    : ⚠️ Arquivo não encontrado: ${fullAttach}`);
    }
  }

  console.log('='.repeat(70) + '\n');

  if (pendingLeads.length === 0) {
    console.log('🎉 Todos os leads da fila já receberam e-mails! Nada pendente.');
    return;
  }

  // MODO PREVIEW (DRY-RUN)
  if (!isSend) {
    console.log('👀 PRÉVIA DOS PRÓXIMOS ENVIOS (DRY-RUN):');
    const previewList = pendingLeads.slice(0, Math.min(5, limit));
    previewList.forEach((lead, idx) => {
      const cleanName = cleanBusinessName(lead.name);
      console.log(`\n--- [Exemplo ${idx + 1}] ---`);
      console.log(`Empresa : ${lead.name} -> Saudação: "${cleanName}"`);
      console.log(`Destino : ${lead.email}`);
      console.log(`Assunto : Soluções digitais & modernização para a ${cleanName}`);
      console.log(`Primeiras linhas:`);
      const bodySnippet = generateEmailBody(lead.name).split('\n').slice(0, 5).join('\n');
      console.log(bodySnippet);
      console.log('...');
    });

    console.log('\n' + '='.repeat(70));
    console.log('💡 DICA: Para iniciar os disparos reais com controle de cadência:');
    console.log('   npm run send');
    console.log('   ou: node src/sender.mjs --send --interval=10');
    console.log('='.repeat(70));
    return;
  }

  // MODO ENVIO REAL
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass || user.includes('seu_email') || pass.includes('sua_senha')) {
    console.error('❌ ERRO: Credenciais de e-mail não configuradas no arquivo .env.');
    console.error('Configure EMAIL_USER e EMAIL_PASS (App Password de 16 letras) no arquivo .env.');
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });

  try {
    await transporter.verify();
    console.log('✅ Conexão SMTP autenticada com sucesso no Gmail!\n');
  } catch (err) {
    console.error('❌ Falha na autenticação SMTP:', err.message);
    process.exit(1);
  }

  const toSend = pendingLeads.slice(0, limit);
  console.log(`🚀 Iniciando sequência de ${toSend.length} disparos...\n`);

  for (let i = 0; i < toSend.length; i++) {
    const lead = toSend[i];
    const cleanName = cleanBusinessName(lead.name);
    const subject = `Soluções digitais & modernização para a ${cleanName}`;
    const text = generateEmailBody(lead.name);

    // Validação preventiva de MX do domínio antes do envio
    const domain = lead.email.split('@')[1];
    let hasMx = false;
    try {
      const mx = await dns.resolveMx(domain);
      hasMx = mx && mx.length > 0;
    } catch {}

    if (!hasMx) {
      console.warn(`[${i + 1}/${toSend.length}] ⚠️ Pulado: domínio @${domain} não possui servidor MX ativo.`);
      continue;
    }

    console.log(`[${i + 1}/${toSend.length}] Enviando para: ${cleanName} <${lead.email}>...`);

    const mailOptions = {
      from: `"Rian Guilherme Joner" <${user}>`,
      to: lead.email,
      subject,
      text
    };

    if (attachmentPath) {
      const fullAttach = path.isAbsolute(attachmentPath) ? attachmentPath : path.resolve(rootDir, attachmentPath);
      if (fs.existsSync(fullAttach)) {
        mailOptions.attachments = [{
          filename: path.basename(fullAttach),
          path: fullAttach
        }];
      }
    }

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`  ✅ Enviado! ID: ${info.messageId}`);

      progress.sent.push({
        id: lead.id,
        name: lead.name,
        cleanName,
        email: lead.email,
        sentAt: new Date().toISOString(),
        messageId: info.messageId
      });
      saveProgress(progress);
    } catch (err) {
      console.error(`  ❌ Erro ao enviar: ${err.message}`);
    }

    // Se houver próximo e intervalo configurado, aguarda a cadência
    if (i < toSend.length - 1 && intervalMinutes > 0) {
      console.log(`  ⏳ Aguardando ${intervalMinutes} minutos para o próximo disparo (anti-spam)...`);
      const totalSec = Math.round(intervalMinutes * 60);
      for (let s = totalSec; s > 0; s -= 30) {
        process.stdout.write(`\r     Próximo envio em ${Math.ceil(s / 60)} min (${s}s restantes)... `);
        await sleep(Math.min(30000, s * 1000));
      }
      console.log('\n');
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`🎉 Ciclo de envio concluído! Total nesta rodada: ${toSend.length}`);
  console.log(`Progresso registrado em: ${progressPath}`);
  console.log('='.repeat(70));
}

main().catch(console.error);
