# Loja Hardware

## Desenvolvimento

Na pasta `loja`, execute:

```powershell
npm run start-dev
```

O comando inicia o back-end em `http://localhost:8080` e o front-end em `http://localhost:5173`.

## Pagamento e estoque

O checkout usa o Mercado Pago Checkout Pro: os dados de pagamento são preenchidos na página HTTPS do próprio gateway e a chave secreta fica somente no back-end. Antes de publicar, configure no ambiente do back-end:

```text
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-seu-token-secreto
MERCADO_PAGO_WEBHOOK_URL=https://seu-backend.com/api/payments/mercado-pago/webhook
MERCADO_PAGO_SUCCESS_URL=https://sua-loja.com/pagamento/sucesso
MERCADO_PAGO_FAILURE_URL=https://sua-loja.com/pagamento/falhou
MERCADO_PAGO_PENDING_URL=https://sua-loja.com/pagamento/pendente
```

No painel do Mercado Pago, use a mesma URL de webhook. Em instalações Supabase, execute também o arquivo `../hardware/supabase-schema.sql` para criar/atualizar as colunas de estoque e pagamento.

Para o primeiro uso, instale as dependências do front-end:

```powershell
cd loja-hardware
npm install
```
