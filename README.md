# ⚡ B2B Mail Miner & Outbound Cadence

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Status-Production%20Ready-success?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/Security-Zero%20Credentials-blue?style=for-the-badge&logo=shield" alt="Zero Credentials" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="License" />
</p>

> **Motor leve e modular em Node.js para prospecção outbound B2B**: minera e-mails corporativos reais em websites comerciais via web scraping, formata nomes de empresas com inteligência de linguagem natural e realiza disparos com cadência anti-spam e controle de histórico.

---

## 🎯 Por que este projeto existe?

Em prospecções comerciais B2B, a maioria dos disparadores automáticos falha por dois motivos:
1. **Parecem robôs genéricos**: Chamar uma empresa de *"Conemang Conexões e Mangueiras Hidráulicas Ltda"* em vez de *"Conemang Conexões"* entrega que você usou um bot.
2. **Criam picos de envio (Spam)**: Disparar 50 e-mails de uma vez bloqueia sua conta de e-mail e queima a reputação do seu domínio.

O **B2B Mail Miner** resolve isso de forma simples:
- 🔍 **Varredura Ativa**: Visita o site do lead, encontra links `mailto:` e vasculha páginas institucionais e `/contato`.
- 🏷️ **Sanitização Natural de Nomes**: Reduz razões sociais longas para até 2 termos amigáveis (preservando preposições).
- ⏱️ **Cadência Humana (Anti-Spam)**: Espaça os envios em intervalos programáveis (ex: 1 e-mail a cada 10 minutos).
- 💾 **Histórico Inteligente**: Salva o progresso para você pausar e continuar quando quiser sem reenviar para quem já recebeu.
- 🛡️ **Segurança Total**: Zero credenciais no código. Tudo é configurado no seu arquivo `.env` local.

---

## 🏗️ Como Funciona o Fluxo

```
  [ input/leads.json ]  (Lista de empresas com sites)
           │
           ▼
  [ 🔍 Extrator Web ]   (Vasculha homepage e /contato via mailto:)
           │
           ▼
  [ output/leads_com_email.json ] (Lista minerada com e-mails corporativos)
           │
           ▼
  [ 🏷️ Sanitizador ]   ("Empresa X do Brasil Ltda" -> "Empresa X")
           │
           ▼
  [ 📬 Disparador Cadenciado ] (1 envio a cada X minutos com anexo PDF)
           │
           ▼
  [ output/progresso.json ]   (Garante que ninguém receba e-mails duplicados)
```

---

## 🚀 Passo a Passo Rápido (3 Minutos)

### 1. Clonar o repositório e instalar dependências
```bash
git clone https://github.com/rianjoner1-dot/b2b-mail-miner.git
cd b2b-mail-miner
npm install
```

---

### 2. Configurar suas credenciais (`.env`)
Copie o modelo de exemplo para criar seu `.env`:
```bash
# No Windows PowerShell:
copy .env.example .env

# No Linux ou Mac:
cp .env.example .env
```

Abra o arquivo `.env` e preencha:
```env
# Seu endereço de e-mail (ex: Gmail)
EMAIL_USER=seu_email@gmail.com

# Senha de App de 16 letras gerada no Google Account
EMAIL_PASS=abcd efgh ijkl mnop

# Minutos de espera entre cada envio (anti-spam)
INTERVAL_MINUTES=10

# (Opcional) Caminho do seu PDF de apresentação ou portfólio
ATTACHMENT_PATH=./meu_portfolio.pdf
```

> 💡 **Como gerar a Senha de App no Google?**  
> 1. Acesse [myaccount.google.com/security](https://myaccount.google.com/security).  
> 2. Verifique se a **Verificação em 2 etapas** está ativa.  
> 3. Na busca de configurações, digite **"Senhas de app"** (ou acesse [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)).  
> 4. Crie uma senha com o nome `Mail Miner` e cole as 16 letras no seu `.env`.

---

### 3. Testar a formatação de nomes
Para ver o algoritmo de sanitização em ação:
```bash
npm test
```
*Saída esperada:*
```text
  "Conemang Conexões e Mangueiras Hidráulicas Ltda"  =>  "Conemang Conexões"
  "Tornearia de Paula e Filhos"                    =>  "Tornearia de Paula"
  "Sadhas Automação Industrial (S&G)"              =>  "Sadhas Automação"
```

---

### 4. Extrair e-mails dos sites
Coloque sua lista de empresas em `input/leads.json` (ou use a lista de exemplo que já vem pronta):
```bash
npm run extract
```
*O script visitará cada website em paralelo e criará o arquivo `output/leads_com_email.json`.*

---

### 5. Pré-visualizar sem enviar nada (Dry-Run Seguro)
Antes de disparar qualquer e-mail real, você pode conferir como ficará a mensagem, o assunto e a saudação de cada empresa:
```bash
npm run preview
```
*Nenhum e-mail é enviado neste modo. Ele apenas exibe na tela o preview dos próximos envios.*

---

### 6. Iniciar os disparos reais
Quando estiver pronto para iniciar o envio outbound:
```bash
npm run send
```
O disparador autenticará no servidor de e-mail, enviará o primeiro lead, aguardará a contagem regressiva e prosseguirá automaticamente:
```text
[1/15] Enviando para: Conemang Conexões <contato@empresa.com.br>...
  ✅ Enviado! ID: <123456789@mail.gmail.com>
  ⏳ Aguardando 10 minutos para o próximo disparo (anti-spam)...
     Próximo envio em 10 min (570s restantes)...
```

---

## ⚙️ Opções e Comandos Avançados

Você pode passar parâmetros adicionais diretamente pelo terminal:

| Comando | Descrição |
| :--- | :--- |
| `npm run preview` | Mostra os próximos envios na tela sem enviar nada |
| `npm run send` | Inicia o envio real com intervalo padrão |
| `node src/sender.mjs --send --limit=5` | Envia apenas os primeiros 5 leads da fila |
| `node src/sender.mjs --send --interval=5` | Ajusta o tempo de espera para 5 minutos |
| `node src/sender.mjs --send --attachment=./doc.pdf` | Anexa um arquivo específico na mensagem |
| `node src/extractor.mjs --limit=20` | Executa a extração apenas nos primeiros 20 websites |

---

## 📁 Estrutura de Pastas

```text
b2b-mail-miner/
├── input/
│   └── leads.example.json      # Modelo de entrada de leads
├── output/
│   ├── leads_com_email.example.json # Modelo de e-mails extraídos
│   └── progresso.json          # (Gerado localmente) Registro de quem já recebeu
├── src/
│   ├── extractor.mjs           # Motor de web scraping de e-mails
│   ├── name-cleaner.mjs        # Algoritmo de limpeza e saudação humana
│   └── sender.mjs              # Disparador com controle de cadência SMTP
├── .env.example                # Modelo de configuração de variáveis
├── .gitignore                  # Impede o upload de senhas e dados sensíveis
├── package.json                # Manifesto e dependências do projeto
└── README.md                   # Documentação oficial
```

---

## 🔒 Boas Práticas e Segurança

- **Nunca compartilhe seu arquivo `.env`**: Ele já está incluído no `.gitignore` para nunca ser enviado ao GitHub.
- **Respeite o intervalo anti-spam**: Recomendamos manter entre **8 a 15 minutos** entre cada e-mail para contas gratuitas do Gmail (limite seguro de até 40-50 e-mails por dia).
- **Mantenha a abordagem cordial**: Use mensagens consultivas e ofereça sempre uma forma simples da pessoa responder se tem interesse ou não.

---

## 👨‍💻 Autor

Desenvolvido por **Rian Guilherme Joner**  
- **GitHub**: [@rianjoner1-dot](https://github.com/rianjoner1-dot)  
- **LinkedIn**: [rian-joner](https://www.linkedin.com/in/rianjoner/)

---

## 📄 Licença

Distribuído sob a licença **MIT**. Consulte o arquivo `LICENSE` para mais detalhes.
