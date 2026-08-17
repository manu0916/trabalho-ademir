import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { sendSupportMessage } from '../services/api';

const DEFAULT_FAQS = [
  {
    id: 'originalidade',
    question: 'Os tênis são 100% originais e acompanham nota e caixa?',
    shortAnswer: 'Sim! 100% autênticos com legit check garantido.',
    fullAnswer:
      'Todos os nossos pares passam por um processo rigoroso de inspeção de autenticidade (legit check) por especialistas. Cada tênis é enviado em sua caixa original, com etiquetas, tags de fábrica e nota fiscal com garantia.',
  },
  {
    id: 'frete',
    question: 'Qual é o prazo e custo de entrega para o meu CEP?',
    shortAnswer: 'Envio expresso para todo o Brasil em 2 a 7 dias úteis.',
    fullAnswer:
      'Entregamos para todo o território nacional através dos Correios (Sedex / PAC) e transportadoras privadas expressas. O prazo médio de transporte é de 2 a 7 dias úteis após a confirmação do pagamento, com código de rastreamento enviado por e-mail.',
  },
  {
    id: 'trocas',
    question: 'Como funciona a troca ou devolução se não servir o tamanho?',
    shortAnswer: '1ª troca gratuita em até 7 dias corridos.',
    fullAnswer:
      'Caso a numeração não fique perfeita, você tem até 7 dias corridos após o recebimento para solicitar a troca sem custos de frete na primeira solicitação. O par precisa estar sem marcas de uso, na caixa original e com as etiquetas preservadas.',
  },
  {
    id: 'pagamento',
    question: 'Quais são as formas de pagamento disponíveis?',
    shortAnswer: 'Cartão em até 12x, PIX instantâneo e negociação via WhatsApp.',
    fullAnswer:
      'Aceitamos Cartão de Crédito em até 12x com proteção antifraude Stripe, PIX com confirmação imediata, Boleto Bancário e atendimento consultivo direto via WhatsApp para tirar dúvidas antes de pagar.',
  },
  {
    id: 'rastreio',
    question: 'Como rastrear o envio e acompanhar o meu pedido?',
    shortAnswer: 'Rastreio em tempo real por e-mail e pelo painel da sua conta.',
    fullAnswer:
      'Assim que o pedido for faturado e despachado, o código de rastreio é enviado automaticamente para o seu e-mail de cadastro. Você também pode consultar o status atualizado a qualquer momento na aba Minha Conta.',
  },
];

export default function FaqSection({ customerSession }) {
  const [openFaqId, setOpenFaqId] = useState('originalidade');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success'|'error', text: '' }

  const formRef = useRef(null);

  // Pre-fill customer data if logged in
  useEffect(() => {
    if (customerSession?.account) {
      if (customerSession.account.fullName) setFullName(customerSession.account.fullName);
      if (customerSession.account.email) setEmail(customerSession.account.email);
    }
  }, [customerSession]);

  const toggleFaq = (id) => {
    setOpenFaqId((current) => (current === id ? null : id));
  };

  // 1-Click action: populate form with this specific question and scroll to form
  const handleQuickQuestionClick = (faq) => {
    setSubject(`Dúvida sobre: ${faq.question}`);
    setMessage(`Olá equipe Kicks Store! Gostaria de mais detalhes sobre: "${faq.question}".`);
    setStatusMessage(null);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatusMessage(null);

    if (!fullName.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setStatusMessage({ type: 'error', text: 'Por favor, preencha todos os campos da mensagem.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await sendSupportMessage({ fullName, email, subject, message });
      setStatusMessage({
        type: 'success',
        text: 'Sua mensagem foi enviada com sucesso ao nosso SAC! Entraremos em contato em breve por e-mail.',
      });
      setSubject('');
      setMessage('');
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Não foi possível enviar a mensagem. Tente novamente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="faq" className="faq-section mx-auto max-w-[90rem] px-5 py-16 sm:px-8 sm:py-24 border-t border-[var(--line)]">
      <div className="text-center max-w-3xl mx-auto mb-14">
        <p className="section-kicker">Suporte & Perguntas Frequentes</p>
        <h2 className="section-title mt-1">Dúvidas Frequentes & Atendimento (SAC)</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Veja as respostas instantâneas para as 5 principais dúvidas sobre autenticidade, entregas e trocas, ou envie uma mensagem direta para a nossa equipe com 1 clique.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
        {/* Accordion Column (5 Main FAQs) */}
        <div className="lg:col-span-7 space-y-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
              Perguntas Mais Frequentes
            </span>
            <span className="text-xs text-[var(--muted)]">5 respostas automáticas</span>
          </div>

          {DEFAULT_FAQS.map((faq, index) => {
            const isOpen = openFaqId === faq.id;
            return (
              <div
                key={faq.id}
                className={`overflow-hidden rounded-2xl border transition-all ${isOpen ? 'border-[var(--accent)] bg-[var(--surface-solid)] shadow-md' : 'border-[var(--line)] bg-[var(--bg)] hover:border-[var(--border-focus)]'}`}
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(faq.id)}
                  className="flex w-full items-center justify-between p-5 text-left transition-colors cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-3 pr-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-xs font-black text-[var(--accent)] border border-[var(--line)]">
                      0{index + 1}
                    </span>
                    <h3 className="text-sm font-bold text-[var(--text)] sm:text-base">
                      {faq.question}
                    </h3>
                  </div>
                  <span className={`text-xl font-bold text-[var(--muted)] transition-transform duration-300 ${isOpen ? 'rotate-45 text-[var(--accent)]' : ''}`}>
                    +
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="px-5 pb-5 pt-1 border-t border-[var(--line)]/60 text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
                        <p>{faq.fullAnswer}</p>

                        {/* 1-Click Action to Send Question */}
                        <div className="mt-4 pt-3 border-t border-[var(--line)]/40 flex items-center justify-between flex-wrap gap-2">
                          <span className="text-xs font-medium text-[var(--text)]">Ainda com dúvidas sobre isso?</span>
                          <button
                            type="button"
                            onClick={() => handleQuickQuestionClick(faq)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                          >
                            ✉ Enviar esta dúvida com 1 clique
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Support Message Form Column */}
        <div ref={formRef} className="lg:col-span-5">
          <div className="rounded-3xl bg-[var(--surface-solid)] p-6 sm:p-8 border border-[var(--line)] shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="section-kicker">Fale Conosco</span>
              <span className="text-[11px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                SAC Online
              </span>
            </div>
            <h3 className="text-xl font-bold text-[var(--text)]">Envie uma Mensagem</h3>
            <p className="mt-1 text-xs text-[var(--muted)] mb-5">
              Recebemos sua mensagem diretamente no painel do lojista e respondemos com agilidade.
            </p>

            {statusMessage && (
              <div
                className={`mb-4 rounded-xl p-3.5 text-xs font-semibold border ${statusMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}
              >
                {statusMessage.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[var(--text)] mb-1" htmlFor="faq-fullName">
                  Seu Nome:
                </label>
                <input
                  id="faq-fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nome e Sobrenome"
                  maxLength={160}
                  className="w-full rounded-xl bg-[var(--bg)] p-3 text-xs text-[var(--text)] border border-[var(--line)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text)] mb-1" htmlFor="faq-email">
                  Seu E-mail:
                </label>
                <input
                  id="faq-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com"
                  maxLength={254}
                  className="w-full rounded-xl bg-[var(--bg)] p-3 text-xs text-[var(--text)] border border-[var(--line)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text)] mb-1" htmlFor="faq-subject">
                  Assunto / Pergunta:
                </label>
                <input
                  id="faq-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ex: Dúvida sobre numeração ou modelo específico"
                  maxLength={200}
                  className="w-full rounded-xl bg-[var(--bg)] p-3 text-xs text-[var(--text)] border border-[var(--line)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text)] mb-1" htmlFor="faq-message">
                  Mensagem detalhada:
                </label>
                <textarea
                  id="faq-message"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Descreva sua dúvida, tamanho desejado ou solicitação..."
                  maxLength={4000}
                  className="w-full rounded-xl bg-[var(--bg)] p-3 text-xs text-[var(--text)] border border-[var(--line)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                  required
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="buy-button w-full cursor-pointer rounded-xl py-3 text-xs font-bold transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 shadow-lg"
                >
                  {isSubmitting ? 'Enviando mensagem...' : 'Enviar Mensagem ao Atendimento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
