import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanBusinessName } from './name-cleaner.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const inputPath = fs.existsSync(path.join(rootDir, 'input', 'leads.json'))
  ? path.join(rootDir, 'input', 'leads.json')
  : path.join(rootDir, 'input', 'leads.example.json');

const outputPath = path.join(rootDir, 'output', 'leads_com_email.json');

const ignoredDomains = [
  'instagram.com', 'facebook.com', 'linktr.ee', 'wa.me',
  'api.whatsapp.com', 'tiktok.com', 'doctoralia.com.br',
  'youtube.com', 'twitter.com', 'x.com', 'linkedin.com'
];

const dummyEmailRegex = /@(wixpress\.com|sentry\.io|example\.com|domain\.com|email\.com|wordpress\.org|bootstrap|schema\.org|w3\.org)$/i;
const invalidExtensions = /\.(png|jpg|jpeg|gif|webp|svg|css|js|woff|woff2|ttf)$/i;

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(clean)) return false;
  if (dummyEmailRegex.test(clean)) return false;
  if (invalidExtensions.test(clean)) return false;
  const user = clean.split('@')[0];
  if (user.length < 3 && !['rh', 'ti', 'sac', 'adm'].includes(user)) return false;
  return true;
}

function extractEmailsFromHtml(html) {
  if (!html) return [];
  const found = new Set();

  // 1. Extração por links mailto:
  const mailtoMatches = html.matchAll(/href=["']mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})[^"']*["']/gi);
  for (const m of mailtoMatches) {
    if (isValidEmail(m[1])) found.add(m[1].toLowerCase());
  }

  // 2. Extração por texto no HTML
  const textMatches = html.matchAll(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/gi);
  for (const m of textMatches) {
    if (isValidEmail(m[1])) found.add(m[1].toLowerCase());
  }

  return Array.from(found);
}

async function fetchHtml(urlStr, timeoutMs = 7000) {
  try {
    const res = await fetch(urlStr, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function scrapeEmailsForLead(lead) {
  const urlStr = lead.website;
  if (!urlStr || !urlStr.startsWith('http')) return null;

  try {
    const parsed = new URL(urlStr);
    if (ignoredDomains.some(d => parsed.hostname.includes(d))) return null;

    let emails = [];
    const htmlHome = await fetchHtml(urlStr);
    if (htmlHome) {
      emails = extractEmailsFromHtml(htmlHome);
    }

    if (emails.length === 0 && htmlHome) {
      const contactUrl = new URL('/contato', parsed.origin).href;
      const htmlContact = await fetchHtml(contactUrl, 5000);
      if (htmlContact) {
        emails = extractEmailsFromHtml(htmlContact);
      }
    }

    if (emails.length > 0) {
      return {
        id: lead.id || String(Date.now()),
        name: lead.name,
        cleanName: cleanBusinessName(lead.name),
        category: lead.category || '',
        phone: lead.phone || '',
        website: lead.website,
        address: lead.address || '',
        emails,
        primaryEmail: emails[0]
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

  console.log('='.repeat(70));
  console.log('  🔍 B2B MAIL MINER — EXTRATOR DE E-MAILS DE WEBSITES');
  console.log('='.repeat(70));
  console.log(`[Origem] ${inputPath}`);
  console.log(`[Destino] ${outputPath}`);

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Arquivo de entrada não encontrado: ${inputPath}`);
    process.exit(1);
  }

  const allLeads = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  let targetLeads = allLeads.filter(l => l.website && l.website.startsWith('http'));

  if (limit !== Infinity) {
    targetLeads = targetLeads.slice(0, limit);
  }

  console.log(`[Alvos] ${targetLeads.length} websites para varredura\n`);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  let existing = [];
  if (fs.existsSync(outputPath)) {
    try { existing = JSON.parse(fs.readFileSync(outputPath, 'utf8')); } catch {}
  }
  const doneIds = new Set(existing.map(e => e.id));
  const queue = targetLeads.filter(l => !doneIds.has(l.id));

  const results = [...existing];
  let index = 0;
  const concurrency = 5;

  async function processLead() {
    if (index >= queue.length) return;
    const item = queue[index++];
    process.stdout.write(`Varrendo [${index}/${queue.length}] ${cleanBusinessName(item.name)}... `);
    const hit = await scrapeEmailsForLead(item);
    if (hit) {
      results.push(hit);
      console.log(`✅ ACHO: ${hit.primaryEmail}`);
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
    } else {
      console.log(`(sem e-mail público)`);
    }
  }

  const pool = [];
  for (let i = 0; i < concurrency; i++) {
    pool.push((async () => {
      while (index < queue.length) {
        await processLead();
      }
    })());
  }

  await Promise.all(pool);

  console.log('\n' + '='.repeat(70));
  console.log(`🎉 Extração concluída! Total minerado: ${results.length}`);
  console.log(`Arquivo salvo em: ${outputPath}`);
  console.log('='.repeat(70));
}

main().catch(console.error);
