# Senda

Senda é uma SaaS para **envio instantâneo de arquivos entre dispositivos**, com experiência semelhante a um **Pix via QR Code**: o atendente gera um QR Code (e um código numérico curto), o cliente aponta a câmera ou digita o código, escolhe o arquivo e o documento aparece imediatamente na tela do atendente.

---

## 1. Objetivo

- **Evitar quebra de fluxo de atendimento**: o cliente não precisa anotar e‑mail, adicionar contato de WhatsApp ou esperar respostas.
- **Eliminar necessidade de vínculo prévio**: não é preciso salvar número, criar conta ou ter e‑mail corporativo.
- **Agilizar o envio de documentos**: envio instantâneo de **PDF, JPG, PNG e DOCX** diretamente do celular do cliente para o computador do atendente.

---

## 2. Situação problema

Em empresas de cadastro de pessoas (clínicas, RH, escolas, etc.) é comum o cliente precisar enviar:

- Documentos pessoais (RG, CPF, CNH, comprovante de endereço, laudos, etc.).

Geralmente isso é feito:

- Por **e‑mail** da empresa; ou  
- Pelo **contato pessoal/profissional da recepcionista**.

Problemas:

- Processo é **demorado** (abre e‑mail, anexa, escreve texto).
- Pode ser **invasivo** (uso de número pessoal/WhatsApp do funcionário).
- Pode gerar **evasão** (cliente desiste por ser trabalhoso/confuso).

A Senda resolve isso com um fluxo simples, anônimo e imediato.

---

## 3. Conceito da Senda – Modo 01

**Tecnologia principal:** WebSockets (ou Socket.io) para conexão em tempo real entre **servidor** e **navegadores (atendente e cliente)**.

Fluxo simplificado:

1. **Sessão**  
   O atendente acessa a Senda no computador, faz **login** (apenas o atendente precisa de conta) e escolhe **“Receber arquivo”**.  
   O sistema cria uma **Sessão WebSocket** única e gera:
   - Um **QR Code**.
   - Um **código numérico curto de 4 dígitos**.

2. **Escaneamento / Código numérico**  
   O cliente acessa a Senda e escolhe **“Enviar arquivo”**:
   - Pode **escanear o QR Code** na tela do atendente; ou
   - Pode **digitar o código numérico de 4 dígitos**.

3. **Conexão do cliente**  
   O celular do cliente abre uma **página web simples (PWA)**:
   - Sem login.
   - Sem cadastro.
   - Sem app nativo.

4. **Upload**  
   O cliente seleciona o arquivo (PDF, JPG, PNG, DOCX) no celular e envia.

5. **Entrega em tempo real (“Pix Experience”)**  
   Assim que o upload termina:
   - O servidor notifica o **navegador do atendente via WebSocket**.
   - O arquivo aparece imediatamente na tela do atendente com opção de **download**.

6. **Encerramento**  
   Após concluído o atendimento, a **sessão é encerrada** e o link/código deixam de ser válidos.

---

## 4. Regras de uso

- **Cliente final:**
  - Nunca precisa de login.
  - Apenas escaneia o QR Code ou digita o código de 4 dígitos.
  - Envia o arquivo e encerra a interação.

- **Atendente/Empresa:**
  - Necessita criar conta e fazer login.
  - Gera sessão de recebimento, QR Code e código numérico.
  - Recebe os arquivos na sua interface autenticada.

---

## 5. Arquitetura Técnica

### 5.1 Front-end (Cliente e Atendente)

- **Tecnologia sugerida:**  
  - React.js, Vue.js ou Next.js.
- **PWA (Progressive Web App):**
  - Suporte a instalação no celular como “app”.
  - Carregamento rápido mesmo em conexões mais lentas.
  - Acesso facilitado à câmera (para leitura de QR) e aos arquivos do dispositivo.

### 5.2 Back-end (Servidor)

- **Linguagem:** Node.js (ótimo para operações I/O assíncronas).
- **Tempo real:** WebSockets puros ou Socket.io.
- **Responsabilidades principais:**
  - Autenticação e gestão das contas de atendentes.
  - Criação e gerenciamento das **sessões de envio**.
  - Geração e validação de:
    - **ID de sessão** interno.
    - **QR Code** (URL contendo o ID da sessão).
    - **Código numérico de 4 dígitos** (mapeado ao ID da sessão).
  - Recebimento e armazenamento temporário dos arquivos.
  - Emissão de eventos em tempo real via WebSocket para o atendente.

---

## 6. Fluxo de Uso – Tela Inicial

1. O usuário (cliente ou atendente) acessa o site da Senda.
2. A página inicial apresenta duas ações:
   - **Enviar arquivo**
   - **Receber arquivo**

### 6.1 Fluxo “Receber arquivo” (Atendente)

1. Atendente faz login.
2. Clica em **“Receber arquivo”**.
3. O servidor:
   - Cria uma **sessão** com:
     - `sessionId` (interno/único).
     - `codigo4d` (4 dígitos, curto e fácil de digitar).
   - Associa `sessionId` ↔ `codigo4d`.
   - Gera uma **URL curta** para cliente:  
     `https://senda.app/s/{sessionId}`
   - Gera um **QR Code** dessa URL.
4. O front-end exibe para o atendente:
   - O **QR Code**.
   - O **código numérico de 4 dígitos** logo abaixo.
5. O navegador do atendente abre uma **conexão WebSocket** com o servidor e:
   - Entra em uma **“sala” da sessão** (por ex. `room:sessionId`).
   - Fica aguardando eventos de arquivo recebido.

### 6.2 Fluxo “Enviar arquivo” (Cliente)

1. O cliente escolhe **“Enviar arquivo”**.
2. A tela oferece duas opções:
   - **Escanear QR Code** (abre a câmera e lê a URL).
   - **Digitar código de 4 dígitos**.
3. Se o cliente:
   - **Escanear o QR Code**:
     - É redirecionado para a URL da sessão (`/s/{sessionId}`).
   - **Digitar o código de 4 dígitos**:
     - O front-end envia o código `codigo4d` ao servidor.
     - O servidor procura o `sessionId` correspondente.
     - Se encontrar, redireciona o cliente para a sessão `/s/{sessionId}`.
     - Se não encontrar, retorna erro de sessão inválida ou expirada.

4. Na página `/s/{sessionId}` o cliente vê:
   - Texto simples: “Selecione o arquivo para enviar ao atendente”.
   - Um campo de seleção de arquivo (input type `file`).
   - Botão **“Enviar”**.

5. Ao clicar em **“Enviar”**:
   - O front-end realiza o **upload**:
     - Via HTTP tradicional (POST `/upload/{sessionId}`); ou
     - Via WebSocket (enviando o binário pela conexão).
   - O servidor:
     - Valida o tipo do arquivo (PDF, JPG, PNG, DOCX).
     - Aplica regras de tamanho máximo (se definidas).
     - Armazena temporariamente (disco, storage S3, etc.).
     - Gera um identificador e/ou URL de download seguro.

6. Após salvar o arquivo, o servidor:
   - Emite um evento WebSocket para a sala da sessão (`room:sessionId`):
     - Exemplo de payload:  
       `{ tipo: "novo_arquivo", nome: "documento.pdf", urlDownload: "..." }`

7. O navegador do atendente:
   - Recebe o evento em tempo real.
   - Atualiza a interface exibindo:
     - Nome do arquivo.
     - Botão de download.
     - Estado de “Novo arquivo recebido”.

---

## 7. Algoritmo Detalhado (Passo a Passo)

### 7.1 Criação da sessão de recebimento (Atendente)

1. Atendente autentica (login).
2. Clica em “Receber arquivo”.
3. Servidor:
   1. Gera `sessionId` único.
   2. Gera `codigo4d` (4 dígitos aleatórios, validando que não esteja em uso).
   3. Cria registro em banco de dados:
      - `sessionId`
      - `codigo4d`
      - `atendenteId`
      - `status = "aberta"`
      - `expiraEm` (timestamp para expiração automática).
   4. Gera URL da sessão: `/s/{sessionId}`.
   5. Gera QR Code para essa URL.
4. Retorna para o front-end:
   - `sessionId`, `codigo4d`, `qrCodeBase64` (por exemplo).

### 7.2 Conexão WebSocket do Atendente

1. Front-end do atendente abre WebSocket: `ws://senda.app/ws`.
2. Envia mensagem de entrada na sessão:
   - `{ tipo: "entrar_sessao", sessionId }`
3. Servidor:
   - Valida se a sessão existe e está aberta.
   - Coloca a conexão do atendente na sala `room:sessionId`.
   - Envia confirmação:
     - `{ tipo: "sessao_ok", sessionId }`

### 7.3 Entrada do Cliente via QR Code

1. Cliente escaneia o QR Code → abre URL `/s/{sessionId}`.
2. Front-end carrega tela de upload para essa sessão.
3. Opcional: front-end também abre WebSocket para feedback de status.

### 7.4 Entrada do Cliente via Código Numérico (4 dígitos)

1. Cliente digita `codigo4d` na tela “Enviar”.
2. Front-end envia requisição:
   - `POST /resolver-codigo` com `{ codigo4d }`.
3. Servidor:
   - Busca sessão com esse código e status "aberta" e não expirada.
   - Se encontrar: responde com `sessionId` ou redirecionamento para `/s/{sessionId}`.
   - Se não: responde com erro “Sessão não encontrada ou expirada”.

### 7.5 Upload do Arquivo

1. Na tela `/s/{sessionId}`:
   - Cliente seleciona arquivo (`PDF`, `JPG`, `PNG`, `DOCX`).
   - Clica em “Enviar”.
2. Front-end:
   - Envia `POST /upload/{sessionId}` com o arquivo.
3. Servidor:
   - Valida:
     - Sessão existe e está aberta.
     - Extensão do arquivo é permitida.
     - Tamanho está dentro do limite.
   - Salva o arquivo (em disco ou storage).
   - Gera `arquivoId` e `urlDownload`.
   - Cria registro em banco `arquivos`:
     - `arquivoId`, `sessionId`, `nome`, `tipo`, `tamanho`, `urlDownload`, `criadoEm`.

4. Após salvar:
   - Emite evento WebSocket para `room:sessionId`:
     - `{ tipo: "arquivo_recebido", arquivoId, nome, urlDownload }`

### 7.6 Exibição no Atendente

1. Navegador do atendente (conectado à sessão via WebSocket) recebe evento:
   - `tipo: "arquivo_recebido"`.
2. Atualiza a UI:
   - Lista ou card com o novo arquivo.
   - Botão para “Baixar” ou “Abrir”.

---

## 8. Encerramento da Sessão

A sessão pode ser encerrada:

- **Manual**:
  - Atendente clica em “Encerrar sessão”.
- **Automática**:
  - O servidor verifica `expiraEm` e fecha sessões antigas.

Quando encerrada:

1. `status` da sessão muda para `"encerrada"`.
2. Novas entradas por QR Code ou código de 4 dígitos são bloqueadas.
3. WebSockets na sala podem receber evento:
   - `{ tipo: "sessao_encerrada" }`
4. Opcional: arquivos podem ser:
   - Mantidos por um tempo definido.
   - Ou removidos para garantir privacidade.

---

## 9. Privacidade e Segurança (conceitual)

- **Sem cadastro para o cliente**: reduz exposição de dados pessoais.
- **Sessões temporárias**: QR Code e código de 4 dígitos têm validade curta.
- **Arquivos temporários**: armazenados apenas pelo tempo necessário ao atendimento.
- **Canal seguro**: uso de HTTPS/WSS para proteger dados em trânsito.

---

## 10. Resumo

A Senda é um **canal rápido, efêmero e seguro de envio de arquivos**, pensado para:

- Manter o fluxo de atendimento fluido.
- Evitar trocas de contatos pessoais.
- Reproduzir a sensação de simplicidade de um **Pix via QR Code**, mas para **documentos**.

Este README descreve o **algoritmo de funcionamento** e o **fluxo completo** da plataforma no **Modo 01** (envio de arquivos via sessão única entre atendente e cliente).