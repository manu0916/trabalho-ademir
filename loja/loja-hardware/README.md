# Loja Hardware

## Desenvolvimento

Na pasta `loja`, execute:

```powershell
npm run start-dev
```

O comando inicia o back-end em `http://localhost:8080` e o front-end em `http://localhost:5173`.

## Pagamento e estoque

O checkout usa o Stripe Checkout hospedado. Dados de cartão e dos demais meios habilitados são preenchidos na página HTTPS do Stripe; a aplicação não recebe esses dados. Preços, itens e totais são recalculados no back-end, e somente o webhook assinado confirma a mudança de estado do pedido. A visita às páginas de sucesso ou cancelamento nunca confirma nem cancela um pagamento.

### Configuração

Defina estas variáveis somente no ambiente do back-end:

```text
STRIPE_SECRET_KEY=sk_test_sua-chave-secreta
STRIPE_WEBHOOK_SECRET=whsec_segredo-do-endpoint
STRIPE_SUCCESS_URL=https://sua-loja.com/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://sua-loja.com/pagamento/cancelado
STRIPE_CHECKOUT_EXPIRES_MINUTES=30
STRIPE_PIX_EXPIRES_MINUTES=30
STRIPE_BOLETO_EXPIRES_DAYS=1
STRIPE_LIVE_MODE=false
STRIPE_RECONCILIATION_INTERVAL_MS=60000
STRIPE_PAYMENT_METHODS=CARTAO_CREDITO,BOLETO
```

- `STRIPE_SECRET_KEY` é a chave secreta do modo correspondente (`sk_test_...` em teste e `sk_live_...` em produção).
- `STRIPE_WEBHOOK_SECRET` é específico para cada endpoint e ambiente. O segredo emitido pela Stripe CLI não deve ser reutilizado em produção.
- `STRIPE_SUCCESS_URL` deve manter literalmente `{CHECKOUT_SESSION_ID}`; o Stripe substitui esse trecho no redirecionamento.
- `STRIPE_CANCEL_URL` é a base da página de cancelamento. O back-end acrescenta `order_id` à URL para permitir que a interface consulte o pedido sem tratá-lo como cancelado automaticamente.
- `STRIPE_CHECKOUT_EXPIRES_MINUTES` é opcional e controla por quanto tempo uma nova sessão pode ser iniciada (entre 30 minutos e 24 horas).
- `STRIPE_LIVE_MODE` deve ser `false` com chaves/endpoints de teste e `true` somente no ambiente live. O back-end também valida os prefixos `sk_/rk_` e falha antes do checkout se chave e modo divergirem.
- `STRIPE_PAYMENT_METHODS` controla o que a API e a interface oferecem. Use `CARTAO_CREDITO,BOLETO` por padrão e acrescente `PIX` somente depois de confirmar essa capability na conta.
- Os prazos de Pix/boleto e o intervalo de reconciliação são opcionais. O reconciliador recupera criações ambíguas de Checkout/reembolso e consulta pagamentos ou refunds pendentes quando um webhook não chega.

Não é necessária uma chave publicável para o redirecionamento ao Checkout hospedado. Nunca inclua `sk_...`, `whsec_...`, payloads completos de webhook ou dados pessoais em código, logs, commits ou variáveis do front-end.
Esta implementação usa uma conta Stripe direta. Stripe Connect/contas conectadas não estão habilitados por uma variável parcial; se isso for necessário no futuro, todas as chamadas e webhooks devem ser isolados pela mesma connected account.

### Webhook

Cadastre no Stripe Workbench/Dashboard um endpoint HTTPS `POST` apontando para:

```text
https://seu-backend.com/api/payments/stripe/webhook
```

Selecione estes eventos:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
payment_intent.processing
payment_intent.requires_action
payment_intent.succeeded
payment_intent.payment_failed
payment_intent.canceled
charge.refunded
refund.created
refund.updated
refund.failed
charge.refund.updated
charge.dispute.created
charge.dispute.updated
charge.dispute.closed
charge.dispute.funds_withdrawn
charge.dispute.funds_reinstated
```

O back-end valida o corpo bruto com o cabeçalho `Stripe-Signature`, rejeita assinaturas inválidas e trata reentregas de forma idempotente. Sessões concluídas ainda podem estar com pagamento pendente; somente o estado informado e validado pelo webhook libera estoque, permissões ou entrega. Eventos de processamento mantêm o pedido pendente, enquanto falhas, expiração, reembolsos e disputas atualizam o estado correspondente sem registrar dados sensíveis.

Configure o endpoint com uma versão de API igual ou posterior a `2024-10-28.acacia`. A partir dessa versão, `refund.created`, `refund.updated` e `refund.failed` cobrem todos os reembolsos; `charge.refund.updated` fica assinado durante a transição de endpoints antigos. A aplicação mantém ledgers por `event_id`, `refund_id` e `dispute_id`, tolera reentrega e ordem diferente e deriva pagamento, reembolso, disputa, estoque e fulfillment separadamente.

### Teste local

Instale a [Stripe CLI](https://docs.stripe.com/stripe-cli), autentique uma conta de teste e encaminhe somente os eventos usados pela aplicação:

```powershell
stripe login
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,payment_intent.processing,payment_intent.requires_action,payment_intent.succeeded,payment_intent.payment_failed,payment_intent.canceled,charge.refunded,refund.created,refund.updated,refund.failed,charge.refund.updated,charge.dispute.created,charge.dispute.updated,charge.dispute.closed,charge.dispute.funds_withdrawn,charge.dispute.funds_reinstated --forward-to localhost:8080/api/payments/stripe/webhook
```

Copie o `whsec_...` exibido pelo segundo comando para `STRIPE_WEBHOOK_SECRET` no ambiente local, reinicie o back-end e conclua um checkout criado pela própria loja usando um meio de pagamento de teste. `stripe trigger checkout.session.completed` é útil para verificar conexão e assinatura, mas o evento sintético pode ser ignorado por não corresponder a um pedido existente.

Use apenas credenciais e [meios de pagamento de teste](https://docs.stripe.com/testing). Para cartão, por exemplo, use `4242 4242 4242 4242`, uma data futura e qualquer CVC válido no modo de teste. Confirme no banco e nos logs que reentregar o mesmo evento não duplica baixa de estoque, e teste também falha, expiração e reembolso.

### Supabase e publicação

Antes de publicar o novo back-end, faça backup e aplique a versão atual de `hardware/supabase-schema.sql` no SQL Editor do projeto Supabase. Execute o script inteiro no ambiente de homologação primeiro, valide as novas colunas, índices, tabelas de ledger e restrições de pagamento e só então repita em produção. O script preserva referências legadas para auditoria, habilita RLS e revoga `anon`/`authenticated` das tabelas acessadas exclusivamente pelo back-end. O schema deve estar implantado antes de aceitar o primeiro checkout Stripe.

Ative `SPRING_PROFILES_ACTIVE=supabase` somente em uma publicação atrás de um proxy TLS confiável. Esse perfil exige HTTPS, mantém o cookie de sessão como `Secure` e usa a estratégia nativa para interpretar `Forwarded`/`X-Forwarded-*`. O proxy deve remover valores desses cabeçalhos enviados pelo cliente e gravar os dados reais da conexão; não exponha a porta do back-end diretamente à internet. Configure também health checks do proxy para informar `https` como protocolo original e evitar redirecionamentos indevidos.

Para o corte de provedor:

1. Pause temporariamente a criação de novos checkouts.
2. Exporte e reconcilie todos os pagamentos do provedor anterior, incluindo valor/moeda, e preserve seus identificadores para auditoria. Como a integração antiga não validava valor/moeda, o SQL mantém a referência mas move aprovações antigas para `PAYMENT_REVIEW_REQUIRED` até conferência manual, sem inventar um `captured_amount`.
3. Aguarde um estado terminal ou cancele/expire cada cobrança pendente quando permitido. Não transforme uma cobrança antiga em uma sessão Stripe.
4. Implante o schema, as variáveis, o back-end e o front-end; depois valide um pagamento completo e uma reentrega de webhook em modo de teste.
5. Reabra o checkout somente após confirmar o endpoint de produção e o segredo do modo live. Qualquer pagamento legado que mudar depois do corte deve ser reconciliado manualmente no provedor em que foi criado.

Ative recibos e instruções por e-mail nas configurações da conta Stripe se eles fizerem parte do fluxo da loja; o back-end envia `receipt_email`, mas não mantém um servidor SMTP próprio. Reembolsos de pagamentos Stripe devem ser iniciados no Dashboard ou por uma operação administrativa autenticada e serão reconciliados pelos eventos de webhook acima; uma visita à página de retorno não solicita reembolso. O reembolso financeiro não recoloca automaticamente um produto físico no estoque: devolução e condição de revenda exigem um processo operacional separado. Respeite as limitações de cada meio: boleto exige devolução bancária externa, e prazos/disponibilidade de reembolso de Pix dependem das regras vigentes da conta. Cobranças legadas devem ser reembolsadas no provedor original.

Pix no Stripe é disponibilizado apenas por convite para contas brasileiras elegíveis. Confirme a habilitação no Dashboard antes de oferecê-lo; se Pix for obrigatório e a conta não tiver acesso, avalie Pagar.me como alternativa antes da publicação. A passagem para produção exige ativação da conta, KYC, representante dentro da idade mínima, CPF/CNPJ e conta bancária compatível. Não há atalho técnico para esses requisitos nem para regras legais, fiscais ou dos provedores.

Para o primeiro uso, instale as dependências do front-end:

```powershell
cd loja-hardware
npm ci
```
