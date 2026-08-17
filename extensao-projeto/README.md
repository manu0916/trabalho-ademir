# 👟 Kicks Store — Sneaker Importer (Extensão Chrome)

Extensão do Google Chrome (Manifest V3) criada para escanear páginas de lojas de tênis (Nike, Centauro, Netshoes, Adidas, Authentic Feet, Dafiti, Shopify, etc.), extrair fotos em alta resolução, preço, nome e descrição, e cadastrar o produto **diretamente no catálogo da Kicks Store**.

---

## 🚀 Como Instalar a Extensão no Google Chrome / Brave / Edge

1. Abra o navegador Google Chrome (ou Brave / Edge / Opera).
2. Acesse a página de extensões digitando na barra de endereços:
   ```text
   chrome://extensions
   ```
3. No canto superior direito, ative a chave **"Modo do desenvolvedor"** (Developer Mode).
4. No canto superior esquerdo, clique no botão **"Carregar sem compactação"** (Load unpacked).
5. Selecione a pasta:
   ```text
   C:\Users\monse\OneDrive\Desktop\atualizado 1855 0608\extensao-projeto
   ```
6. Pronto! A extensão **"Kicks Store — Sneaker Importer"** aparecerá na barra de ferramentas do seu navegador. Fixe o ícone na barra clicando no botão de quebra-cabeça 🧩.

---

## ⚙️ Configuração de Conexão

1. Clique no ícone da extensão.
2. Acesse a aba **"⚙️ Conexão API"** (ou clique na engrenagem no topo).
3. Verifique os dados:
   - **URL da API (Back-end)**:
     - Desenvolvimento local: `http://localhost:8080`
     - Produção no Render: `https://seu-backend.onrender.com`
   - **E-mail do Administrador**: `admin@example.test` (ou seu e-mail configurado)
   - **Senha do Administrador**: `password1234`
4. Clique em **"⚡ Testar Conexão"**. Quando aparecer o indicador verde 🟢, sua extensão está conectada e autenticada!

---

## 🎯 Como Usar para Importar Tênis

1. Navegue até a página de qualquer tênis em qualquer loja (ex: Nike, Centauro, Netshoes, Adidas, etc.).
2. Clique no ícone da extensão **Kicks Store**.
3. Clique no botão **"🔍 Escanear Tênis Nesta Página"**:
   - A extensão captura automaticamente o **Nome**, **Preço**, **Descrição**, **Categoria Esportiva** e todas as **Fotos em alta resolução**.
4. **Revise e Personalize**:
   - Marque ou desmarque as fotos que deseja incluir na galeria.
   - Ajuste o preço ou categoria (*Basquete, Vôlei, Handball, Futsal, Futebol*), se desejar.
   - Defina a quantidade em estoque (padrão: 10).
5. Clique em **"🚀 Enviar para a Kicks Store"**.
6. A extensão baixa as fotos e envia a requisição multipart para a API da sua loja. O tênis aparecerá **imediatamente na vitrine da Kicks Store**!

---

## 📁 Estrutura dos Arquivos

- `manifest.json`: Manifesto Chrome V3 com permissões `activeTab`, `scripting`, `storage` e `<all_urls>`.
- `popup.html`: Interface visual responsiva do importador.
- `popup.css`: Tema dark moderno alinhado à identidade visual da Kicks Store.
- `popup.js`: Controlador do scanner, gerenciamento de tokens admin, conversão de imagens e envio multipart.
- `content.js`: Mecanismo inteligente de scraping (JSON-LD, OpenGraph, seletores DOM e galerias).
- `background.js`: Service worker em segundo plano.
- `icons/`: Ícones oficiais do emblema Kicks Store.
