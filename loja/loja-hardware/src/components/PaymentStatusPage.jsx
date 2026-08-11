import { useEffect, useMemo, useState } from 'react';
import { cancelPaymentOrder, fetchOrderPaymentStatus, fetchPaymentStatusBySession } from '../services/api';
import { readPendingCheckout } from '../services/paymentStorage';
import {
  isTerminalUncapturedPaymentStatus,
  normalizePaymentStatus,
  paymentMethodLabel,
  paymentStatusMeta,
} from '../services/paymentStatus';

const INITIAL_POLL_INTERVAL_MS = 2500;
const MAX_POLL_INTERVAL_MS = 30_000;
const MAX_AUTOMATIC_CHECKS = 18;

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : null;
}

function formatDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });
}

function statusCopy(status, routeKind) {
  const normalized = normalizePaymentStatus(status);
  if (normalized === 'PAID') {
    return {
      eyebrow: 'Pagamento confirmado',
      title: 'Seu pedido está confirmado.',
      description: 'A confirmação veio do servidor após o processamento seguro do pagamento. Guarde o número do pedido para acompanhamento.',
    };
  }
  if (normalized === 'FULFILLMENT_REVIEW_REQUIRED') {
    return {
      eyebrow: 'Pagamento confirmado',
      title: 'Pagamento aprovado, expedição em revisão.',
      description: 'O valor foi confirmado, mas o pedido precisa de revisão operacional antes de ser separado ou enviado.',
    };
  }
  if (normalized === 'PAYMENT_REVIEW_REQUIRED') {
    return {
      eyebrow: 'Verificação necessária',
      title: 'Ainda não foi possível validar o pagamento.',
      description: 'O pedido exige conferência financeira. Esta página não considera o valor capturado enquanto o servidor não o validar.',
    };
  }
  if (['REFUND_PENDING', 'REFUNDED', 'PARTIALLY_REFUNDED', 'REFUND_FAILED'].includes(normalized)) {
    return {
      eyebrow: 'Atualização do pagamento',
      title: ({
        REFUND_PENDING: 'O reembolso está em processamento.',
        REFUNDED: 'O pagamento foi reembolsado.',
        PARTIALLY_REFUNDED: 'O pagamento teve reembolso parcial.',
        REFUND_FAILED: 'O reembolso precisa de atenção.',
      })[normalized],
      description: normalized === 'REFUND_FAILED'
        ? 'O pagamento original permanece confirmado, mas a tentativa de reembolso não foi concluída.'
        : 'O prazo para o valor aparecer depende do meio de pagamento e da instituição financeira.',
    };
  }
  if (normalized === 'DISPUTED') {
    return {
      eyebrow: 'Pagamento em análise',
      title: 'O pagamento está em disputa.',
      description: 'O valor chegou a ser confirmado e agora está sob análise do provedor. A entrega deve aguardar a resolução.',
    };
  }
  if (normalized === 'DISPUTE_LOST') {
    return {
      eyebrow: 'Disputa encerrada',
      title: 'A disputa foi decidida contra o pagamento.',
      description: 'O pagamento havia sido capturado, mas os fundos foram perdidos na disputa. O pedido não deve ser expedido.',
    };
  }
  if (['PAYMENT_FAILED', 'FAILED', 'DECLINED'].includes(normalized)) {
    return {
      eyebrow: 'Pagamento não concluído',
      title: 'Não foi possível confirmar o pagamento.',
      description: 'Nenhuma confirmação foi feita por esta página. Sua sacola continua salva para você tentar novamente.',
    };
  }
  if (['CANCELLED', 'CANCELED', 'PAYMENT_CANCELED', 'EXPIRED', 'PAYMENT_EXPIRED'].includes(normalized)) {
    return {
      eyebrow: 'Checkout encerrado',
      title: 'O pagamento não foi concluído.',
      description: 'Sua sacola continua salva neste dispositivo. Você pode voltar à loja e iniciar uma nova tentativa.',
    };
  }
  return {
    eyebrow: routeKind === 'cancelled' ? 'Retorno do checkout' : 'Confirmação em andamento',
    title: 'Estamos aguardando a confirmação.',
    description: 'Alguns meios de pagamento levam mais tempo para confirmar. Esta página consulta somente o status processado pelo servidor.',
  };
}

export default function PaymentStatusPage({
  routeKind,
  storeName,
  customerSession,
  onAuthenticationRequired,
  onSwitchAccount,
  onPaymentConfirmed,
  onPaymentTerminated,
}) {
  const lookup = useMemo(() => {
    const query = new URLSearchParams(window.location.search);
    const sessionId = query.get('session_id') || query.get('sessionId');
    const queryOrderId = query.get('order_id') || query.get('orderId');
    const savedOrderId = readPendingCheckout()?.orderId;
    return { sessionId, orderId: queryOrderId || savedOrderId };
  }, []);
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);
  const [canSwitchAccount, setCanSwitchAccount] = useState(false);
  const [pollingPause, setPollingPause] = useState('');
  const [refreshRequest, setRefreshRequest] = useState(0);

  useEffect(() => {
    if (customerSession === undefined) {
      setCanSwitchAccount(false);
      setIsLoading(true);
      return undefined;
    }
    if (customerSession === null) {
      setCanSwitchAccount(false);
      setError('Entre na sua conta para consultar este pedido. A consulta será retomada automaticamente depois do acesso.');
      setIsLoading(false);
      return undefined;
    }
    if (!lookup.sessionId && !lookup.orderId) {
      setCanSwitchAccount(false);
      setError('Não encontramos o identificador deste pagamento. Volte à loja e consulte o pedido novamente.');
      setIsLoading(false);
      return undefined;
    }

    let isActive = true;
    let pollTimer;
    let activeController;
    let automaticChecks = 0;
    let shouldKeepPolling = false;
    let waitingForVisibility = false;

    const scheduleNextCheck = () => {
      if (!isActive || !shouldKeepPolling) return;
      if (automaticChecks >= MAX_AUTOMATIC_CHECKS) {
        setPollingPause('limit');
        return;
      }
      if (document.visibilityState !== 'visible') {
        waitingForVisibility = true;
        setPollingPause('hidden');
        return;
      }

      const delay = Math.min(
        INITIAL_POLL_INTERVAL_MS * (1.6 ** Math.floor(automaticChecks / 3)),
        MAX_POLL_INTERVAL_MS,
      );
      automaticChecks += 1;
      setPollingPause('');
      pollTimer = window.setTimeout(checkStatus, delay);
    };

    const checkStatus = async () => {
      if (!isActive || activeController) return;
      activeController = new AbortController();
      setError('');
      setCanSwitchAccount(false);
      try {
        const nextPayment = lookup.sessionId
          ? await fetchPaymentStatusBySession(lookup.sessionId, { signal: activeController.signal })
          : await fetchOrderPaymentStatus(lookup.orderId, { signal: activeController.signal });
        if (!isActive) return;

        setPayment(nextPayment);
        setIsLoading(false);
        const normalizedStatus = normalizePaymentStatus(nextPayment?.status);
        if (nextPayment?.paymentVerified === true) {
          onPaymentConfirmed(nextPayment);
        } else if (isTerminalUncapturedPaymentStatus(normalizedStatus)) {
          onPaymentTerminated(nextPayment?.orderId);
        }

        shouldKeepPolling = paymentStatusMeta(normalizedStatus).poll;
        scheduleNextCheck();
      } catch (requestError) {
        if (!isActive || requestError?.name === 'AbortError') return;
        setIsLoading(false);
        if (requestError?.status === 401 || requestError?.status === 403) {
          shouldKeepPolling = false;
          setError('Sua sessão expirou. Entre novamente para retomar a consulta deste pedido.');
          onAuthenticationRequired();
          return;
        }
        if (requestError?.status === 404) {
          shouldKeepPolling = false;
          setCanSwitchAccount(true);
          setError('Não foi possível acessar este pagamento com a sessão atual. Você pode tentar entrar com outra conta.');
          return;
        }

        setError(requestError.message || 'Não foi possível consultar o pagamento agora.');
        shouldKeepPolling = !requestError?.status || requestError.status >= 500 || requestError.status === 429;
        scheduleNextCheck();
      } finally {
        activeController = undefined;
      }
    };

    const handleVisibilityChange = () => {
      if (!isActive) return;
      if (document.visibilityState !== 'visible') {
        if (pollTimer) {
          window.clearTimeout(pollTimer);
          pollTimer = undefined;
          waitingForVisibility = shouldKeepPolling;
          if (waitingForVisibility) setPollingPause('hidden');
        }
        return;
      }
      if (waitingForVisibility) {
        waitingForVisibility = false;
        setPollingPause('');
        checkStatus();
      }
    };

    setIsLoading(true);
    setPollingPause('');
    document.addEventListener('visibilitychange', handleVisibilityChange);
    checkStatus();
    return () => {
      isActive = false;
      activeController?.abort();
      window.clearTimeout(pollTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [customerSession, lookup, onAuthenticationRequired, onPaymentConfirmed, onPaymentTerminated, refreshRequest]);

  const normalizedStatus = normalizePaymentStatus(payment?.status);
  const meta = paymentStatusMeta(normalizedStatus);
  const copy = statusCopy(normalizedStatus, routeKind);
  const total = formatCurrency(payment?.total);
  const refundedAmount = Number(payment?.refundedAmount) > 0 ? formatCurrency(payment.refundedAmount) : null;
  const paidAt = formatDateTime(payment?.paidAt);
  const updatedAt = formatDateTime(payment?.paymentUpdatedAt);
  const isPaymentVerified = payment?.paymentVerified === true;
  const cancelOrderId = payment?.orderId || lookup.orderId;
  const canCancelCheckout = routeKind === 'cancelled'
    && Boolean(cancelOrderId)
    && Boolean(payment)
    && payment?.canCancel === true;

  const handleCancelCheckout = async () => {
    if (!canCancelCheckout || isCanceling) return;
    if (!window.confirm('Cancelar este checkout? O pedido não pago será encerrado, mas os itens continuarão na sua sacola.')) return;

    setIsCanceling(true);
    setCancelError('');
    try {
      const canceledPayment = await cancelPaymentOrder(cancelOrderId);
      const nextPayment = canceledPayment && typeof canceledPayment === 'object'
        ? { ...payment, ...canceledPayment }
        : { ...payment, status: typeof canceledPayment === 'string' ? canceledPayment : payment?.status };
      setPayment(nextPayment);
      if (isTerminalUncapturedPaymentStatus(nextPayment.status)) onPaymentTerminated(nextPayment.orderId || cancelOrderId);
      setRefreshRequest((value) => value + 1);
    } catch (requestError) {
      if (requestError?.status === 401 || requestError?.status === 403) onAuthenticationRequired();
      setCancelError(requestError.message || 'Não foi possível cancelar este checkout. Atualize o status e tente novamente.');
    } finally {
      setIsCanceling(false);
    }
  };

  const requestRefresh = () => {
    setIsLoading(true);
    setRefreshRequest((value) => value + 1);
  };

  const handleSwitchAccount = async () => {
    if (isSwitchingAccount) return;
    setIsSwitchingAccount(true);
    try {
      await onSwitchAccount();
    } catch {
      // App still opens the access modal so a new login can replace the session.
    } finally {
      setIsSwitchingAccount(false);
    }
  };

  const isWaitingForSession = customerSession === undefined;
  const headlineError = !isWaitingForSession && error;

  return (
    <main id="main-content" className="payment-return">
      <div className="payment-return-brand"><span aria-hidden="true">N</span><strong>{storeName}</strong></div>
      <section className={`payment-status-card payment-status-${headlineError ? 'danger' : meta.tone}`} aria-live="polite" aria-busy={isLoading}>
        <div className="payment-status-symbol" aria-hidden="true">
          {isLoading ? <span className="payment-status-spinner" /> : isPaymentVerified && meta.tone === 'success' ? '✓' : meta.tone === 'danger' ? '!' : meta.tone === 'neutral' ? '×' : '…'}
        </div>
        <p className="section-kicker">{isWaitingForSession ? 'Verificando acesso' : isLoading ? 'Verificando pagamento' : headlineError ? 'Não foi possível consultar' : copy.eyebrow}</p>
        <h1>{isWaitingForSession ? 'Só um instante…' : isLoading ? 'Consultando o servidor…' : headlineError ? 'O status está temporariamente indisponível.' : copy.title}</h1>
        <p className="payment-status-description">
          {isWaitingForSession
            ? 'Estamos confirmando sua sessão antes de mostrar os dados do pedido.'
            : isLoading
              ? 'A página de retorno não aprova pagamentos por conta própria.'
              : headlineError || copy.description}
        </p>

        {payment && !headlineError && (
          <dl className="payment-status-details">
            <div><dt>Pedido</dt><dd>#{payment.orderId}</dd></div>
            <div><dt>Status</dt><dd><span className={`payment-status-badge payment-status-badge-${meta.tone}`}>{meta.label}</span></dd></div>
            {total && <div><dt>Total</dt><dd>{total}</dd></div>}
            {refundedAmount && <div><dt>Reembolsado</dt><dd>{refundedAmount}</dd></div>}
            <div><dt>Forma de pagamento</dt><dd>{paymentMethodLabel(payment.paymentMethod)}</dd></div>
            {paidAt && <div><dt>Pago em</dt><dd>{paidAt}</dd></div>}
            {updatedAt && <div><dt>Última atualização</dt><dd>{updatedAt}</dd></div>}
          </dl>
        )}

        {!isLoading && meta.poll && !headlineError && !pollingPause && <p className="payment-polling-note"><span aria-hidden="true" /> Atualização automática ativa</p>}
        {!isLoading && pollingPause === 'hidden' && <p className="payment-polling-note">A consulta foi pausada enquanto esta aba está em segundo plano.</p>}
        {!isLoading && pollingPause === 'limit' && <p className="payment-polling-note">A consulta automática atingiu o limite. Use “Atualizar agora” para consultar novamente.</p>}
        {cancelError && <p className="payment-cancel-error" role="alert">{cancelError}</p>}
        <div className="payment-status-actions">
          <a className="admin-primary" href={isPaymentVerified ? '/' : '/?carrinho=1'}>{isPaymentVerified ? 'Voltar à loja' : 'Voltar à sacola'}</a>
          {!isWaitingForSession && customerSession !== null && !isLoading && <button type="button" onClick={requestRefresh}>Atualizar agora</button>}
          {canSwitchAccount && <button type="button" disabled={isSwitchingAccount} onClick={handleSwitchAccount}>{isSwitchingAccount ? 'Encerrando sessão...' : 'Entrar com outra conta'}</button>}
          {canCancelCheckout && <button type="button" className="payment-cancel-action" disabled={isCanceling} onClick={handleCancelCheckout}>{isCanceling ? 'Cancelando checkout...' : 'Cancelar este checkout'}</button>}
        </div>
        {!isPaymentVerified && <p className="payment-cart-note">A sacola só será reconciliada depois que o servidor confirmar a captura. Pagamentos antigos nunca removem itens de uma compra atual.</p>}
      </section>
    </main>
  );
}
