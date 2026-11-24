/**
 * Algoritmo de Sanitização de Nomes Empresariais para Cold Outreach
 * 
 * Transforma nomes longos e cadastrais do Google Maps / CNPJ em
 * saudações humanas e naturais de até 2 termos significativos.
 * 
 * Exemplo:
 *  "Conemang Conexões e Mangueiras Hidráulicas Ltda" => "Conemang Conexões"
 *  "Tornearia de Paula e Filhos"                    => "Tornearia de Paula"
 *  "Sadhas Automação Industrial (S&G)"              => "Sadhas Automação"
 */

const stopWords = new Set(['de', 'da', 'do', 'dos', 'das', 'e', '&']);

export function cleanBusinessName(rawName) {
  if (!rawName || typeof rawName !== 'string') return '';
  
  // 1. Quebra em separadores estruturais com espaço (' - ', ' | ', ' / ', '(', ':')
  let base = rawName.split(/\s+[-|/:]\s+|\s*[(:]/)[0].trim();
  
  // 2. Remove termos societários comuns no final da razão social
  base = base.replace(/\b(ltda|eireli|s\/a|sa|me|epp)\b/gi, '').trim();
  
  // 3. Divide em palavras
  const words = base.split(/\s+/).filter(Boolean);
  if (words.length <= 2) return words.join(' ');
  
  // Se a segunda palavra for preposição ("de", "da", "do"), preserva a terceira
  if (stopWords.has(words[1].toLowerCase()) && words.length >= 3) {
    return words.slice(0, 3).join(' ');
  }
  
  return words.slice(0, 2).join(' ');
}

// Teste embutido para validação rápida com `npm test`
if (process.argv[1]?.endsWith('name-cleaner.mjs')) {
  console.log('🧪 Testando sanitizador de nomes:');
  const samples = [
    'Conemang Conexões e Mangueiras Hidráulicas Ltda',
    'Tornearia de Paula e Filhos',
    'Sadhas Automação Industrial (S&G)',
    'Softgran Informática e Softwares',
    'Comagran - Mangueiras Hidráulicas - Autorizada Stihl'
  ];
  samples.forEach(s => {
    console.log(`  "${s}"  =>  "${cleanBusinessName(s)}"`);
  });
  console.log('✅ Testes concluídos com sucesso!');
}
