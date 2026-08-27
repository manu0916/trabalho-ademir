# 👟 Kicks Store — Sneaker Importer & Exporter (Extensão Chrome)

Extensão do Google Chrome (Manifest V3) criada para escanear páginas de lojas e fornecedores de tênis (inclusive páginas em chinês), extrair fotos em alta resolução, preço, nome, descrição e **divisões de cor**, e gerar um **arquivo `.json` autossuficiente que a Kicks Store lê e importa automaticamente**. Antes da exportação, todas as fotos selecionadas são convertidas de verdade para **WebP** (máximo de 1800 px e 2 MB por arquivo).

Na versão 1.2, a extensão reconhece grupos de cor em estruturas comuns de SKU/variantes, associa a galeria exibida por cada opção, traduz nomes como `白蓝` para **Branco e Azul** e `黑红` para **Preto e Vermelho**, e mantém o nome original como referência no arquivo. Ao importar, cada cor selecionada vira uma entrada separada do mesmo modelo na vitrine, sem misturar as fotos das outras cores.

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
   - A extensão captura automaticamente o **Nome**, **Preço**, **Descrição**, **Categoria Esportiva**, todas as **Fotos em alta resolução** e as **opções de cor** disponíveis.
   - Nomes chineses de cores são traduzidos para português sem depender de um serviço externo.
4. **Revise e Personalize**:
   - Marque ou desmarque as cores que deseja levar para a loja.
   - Marque ou desmarque até 8 fotos para incluir na galeria geral.
   - Ajuste o preço, categoria ou estoque se desejar.
5. Clique em **"💾 Baixar Arquivo do Tênis (.JSON)"**:
   - O arquivo `kicks-[nome-do-tenis].json` será baixado no formato 1.2 com todas as fotos em Data URLs Base64 WebP (`data:image/webp;base64,...`), as especificações e as divisões de cor.
   - *Dica:* Você também pode clicar em **"➕ Salvar no Lote"** para acumular vários tênis e baixar todos em um único arquivo de lote!

### Passo 2: Na Loja Virtual (Importar para o Catálogo)
1. Acesse o **Painel do Administrador** na sua loja Kicks Store.
2. Na seção **"📦 Importar Tênis via Arquivo (.JSON)"**, arraste ou selecione o arquivo baixado.
3. A loja lê o arquivo, separa cada cor como uma entrada do tênis e exibe a prévia com as fotos correspondentes.
4. Escolha:
   - **"✨ Preencher no Formulário"**: Preenche todos os campos para você conferir antes de salvar.
   - **"⚡ Salvar Direto no Catálogo"**: Cadastra imediatamente o tênis (e faz upload de todas as fotos) no banco de dados e na vitrine!

---

## 📁 Estrutura dos Arquivos da Extensão

- `manifest.json`: Manifesto Chrome V3 com permissões `activeTab`, `scripting`, `storage`, `unlimitedStorage` e acesso HTTP/HTTPS para baixar as imagens e conectar à API configurada.
- `popup.html`: Interface visual responsiva do extrator e gerenciador de lotes.
- `popup.css`: Tema dark moderno alinhado à identidade visual da Kicks Store.
- `image-processing.js`: Baixa, decodifica, redimensiona e codifica as imagens em WebP, validando MIME, assinatura RIFF/WEBP, dimensões e tamanho final.
- `color-translation.js`: Tradutor local de cores chinesas e inglesas para português.
- `popup.js`: Controlador do scanner, seletor de cores, gerador de arquivos JSON 1.2, exportador em lote e envio multipart direto à API.
- `content.js`: Mecanismo inteligente de scraping (JSON-LD, dados estruturados, grupos de SKU/variantes, seletores DOM e galerias em alta resolução).
- `background.js`: Service worker em segundo plano.
- `icons/`: Ícones oficiais do emblema Kicks Store.

## 🔌 Conexão direta com a API

1. Abra a aba **Conexão API** da extensão.
2. Informe a URL do back-end (`http://localhost:8080` em desenvolvimento ou a URL HTTPS da implantação).
3. Informe o e-mail e a senha de administrador configurados **no seu ambiente do back-end**. A extensão não inclui credenciais padrão.
4. Clique em **Salvar Configurações** e depois em **Testar Conexão**.

O envio direto obtém um token stateless em `POST /api/admin/auth/token` e usa o Bearer retornado no upload multipart para `POST /api/products`. As credenciais precisam coincidir com a configuração do back-end em execução.
