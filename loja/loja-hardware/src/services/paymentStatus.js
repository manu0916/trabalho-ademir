const STATUS_META = {
  CREATED: { label: 'Checkout criado', tone: 'pending', poll: true },
  OPEN: { label: 'Checkout aberto', tone: 'pending', poll: true },
  PENDING: { label: 'Pagamento pendente', tone: 'pending', poll: true },
  PENDING_PAYMENT: { label: 'Aguardando pagamento', tone: 'pending', poll: true },
  PROCESSING: { label: 'Pagamento em processamento', tone: 'pending', poll: true },
  PAYMENT_PROCESSING: { label: 'Pagamento em processamento', tone: 'pending', poll: true },
  REQUIRES_ACTION: { label: 'Aguardando ação do cliente', tone: 'pending', poll: true },
  PAID: { label: 'Pagamento aprovado', tone: 'success', poll: false },
  PAYMENT_REVIEW_REQUIRED: { label: 'Pagamento em revisão', tone: 'danger', poll: false },
  FULFILLMENT_REVIEW_REQUIRED: { label: 'Pago — revisar expedição', tone: 'danger', poll: false },
  PAYMENT_FAILED: { label: 'Pagamento não aprovado', tone: 'danger', poll: false },
  FAILED: { label: 'Pagamento não aprovado', tone: 'danger', poll: false },
  DECLINED: { label: 'Pagamento recusado', tone: 'danger', poll: false },
  CANCELLED: { label: 'Pagamento cancelado', tone: 'neutral', poll: false },
  CANCELED: { label: 'Pagamento cancelado', tone: 'neutral', poll: false },
  PAYMENT_CANCELED: { label: 'Pagamento cancelado', tone: 'neutral', poll: false },
  EXPIRED: { label: 'Checkout expirado', tone: 'neutral', poll: false },
  PAYMENT_EXPIRED: { label: 'Checkout expirado', tone: 'neutral', poll: false },
  REFUND_PENDING: { label: 'Reembolso em processamento', tone: 'pending', poll: true },
  REFUNDED: { label: 'Pagamento reembolsado', tone: 'neutral', poll: false },
  PARTIALLY_REFUNDED: { label: 'Pagamento parcialmente reembolsado', tone: 'neutral', poll: false },
  REFUND_FAILED: { label: 'Falha no reembolso', tone: 'danger', poll: false },
  DISPUTED: { label: 'Pagamento em disputa', tone: 'danger', poll: true },
  DISPUTE_LOST: { label: 'Disputa perdida', tone: 'danger', poll: false },
};

const TERMINAL_UNCAPTURED_STATUSES = new Set([
  'PAYMENT_FAILED',
  'FAILED',
  'DECLINED',
  'CANCELLED',
  'CANCELED',
  'PAYMENT_CANCELED',
  'EXPIRED',
  'PAYMENT_EXPIRED',
]);

export function normalizePaymentStatus(status) {
  return String(status || 'PENDING_PAYMENT').trim().toUpperCase();
}

export function paymentStatusMeta(status) {
  const normalized = normalizePaymentStatus(status);
  return STATUS_META[normalized] || {
    label: 'Status desconhecido',
    tone: 'danger',
    poll: false,
  };
}

export function isTerminalUncapturedPaymentStatus(status) {
  return TERMINAL_UNCAPTURED_STATUSES.has(normalizePaymentStatus(status));
}

export function paymentMethodLabel(paymentMethod) {
  const normalized = String(paymentMethod || '').trim().toUpperCase();
  return ({
    CARD: 'Cartão de crédito',
    CARTAO_CREDITO: 'Cartão de crédito',
    PIX: 'Pix',
    BOLETO: 'Boleto',
  })[normalized] || normalized.replaceAll('_', ' ').toLocaleLowerCase('pt-BR') || 'Não informado';
}
