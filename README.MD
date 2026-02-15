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
