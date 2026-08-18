# 👟 Kicks Store — Sneaker Importer & Exporter (Extensão Chrome)

Extensão do Google Chrome (Manifest V3) criada para escanear páginas de lojas de tênis (Nike, Centauro, Netshoes, Adidas, Authentic Feet, Dafiti, Shopify, etc.), extrair fotos em alta resolução, preço, nome e descrição, e gerar um **arquivo `.json` autossuficiente que a Kicks Store lê e importa automaticamente**.

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

## 🎯 Como Usar: Fluxo de Exportação e Importação por Arquivo (.JSON)

### Passo 1: Na Extensão (Exportar o Tênis)
1. Navegue até a página de qualquer tênis em qualquer loja (ex: Nike, Centauro, Netshoes, Adidas, etc.).
2. Clique no ícone da extensão **Kicks Store**.
3. Clique no botão **"🔍 Escanear Tênis Nesta Página"**:
   - A extensão captura automaticamente o **Nome**, **Preço**, **Descrição**, **Categoria Esportiva** e todas as **Fotos em alta resolução**.
4. **Revise e Personalize**:
   - Marque ou desmarque as fotos que deseja incluir na galeria.
   - Ajuste o preço, categoria ou estoque se desejar.
5. Clique em **"💾 Baixar Arquivo do Tênis (.JSON)"**:
   - O arquivo `kicks-[nome-do-tenis].json` será baixado com todas as fotos (em Base64) e especificações.
   - *Dica:* Você também pode clicar em **"➕ Salvar no Lote"** para acumular vários tênis e baixar todos em um único arquivo de lote!

### Passo 2: Na Loja Virtual (Importar para o Catálogo)
1. Acesse o **Painel do Administrador** na sua loja Kicks Store.
2. Na seção **"📦 Importar Tênis via Arquivo (.JSON)"**, arraste ou selecione o arquivo baixado.
3. A loja lê o arquivo instantaneamente e exibe a prévia com fotos.
4. Escolha:
   - **"✨ Preencher no Formulário"**: Preenche todos os campos para você conferir antes de salvar.
   - **"⚡ Salvar Direto no Catálogo"**: Cadastra imediatamente o tênis (e faz upload de todas as fotos) no banco de dados e na vitrine!

---

## 📁 Estrutura dos Arquivos da Extensão

- `manifest.json`: Manifesto Chrome V3 com permissões `activeTab`, `scripting`, `storage` e `<all_urls>`.
- `popup.html`: Interface visual responsiva do extrator e gerenciador de lotes.
- `popup.css`: Tema dark moderno alinhado à identidade visual da Kicks Store.
- `popup.js`: Controlador do scanner, conversor de imagens em Base64, gerador de arquivos JSON e exportador em lote.
- `content.js`: Mecanismo inteligente de scraping (JSON-LD, OpenGraph, seletores DOM e galerias em alta resolução).
- `background.js`: Service worker em segundo plano.
- `icons/`: Ícones oficiais do emblema Kicks Store.
