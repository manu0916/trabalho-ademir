import { useState } from 'react';

export default function ShippingCalculator({ orderAmount = 0 }) {
  const [cep, setCep] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shippingResult, setShippingResult] = useState(null);
  const [error, setError] = useState('');

  const handleCepChange = (e) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 8);
    if (raw.length > 5) {
      raw = `${raw.slice(0, 5)}-${raw.slice(5)}`;
    }
    setCep(raw);
  };

  const handleCalculate = async (e) => {
    e?.preventDefault();
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      setError('Informe um CEP válido com 8 dígitos.');
      return;
    }

    setError('');
    setIsLoading(true);
    setShippingResult(null);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (data.erro) {
        setError('CEP não encontrado. Verifique o número digitado.');
        return;
      }

      const isFree = Number(orderAmount) >= 499;
      const pacPrice = isFree ? 0 : 24.90;
      const sedexPrice = 44.90;

      setShippingResult({
        city: data.localidade,
        state: data.uf,
        neighborhood: data.bairro,
        options: [
          {
            name: 'Entrega Padrão (PAC / Econômico)',
            time: '5 a 8 dias úteis',
            price: pacPrice,
            isFree,
          },
          {
            name: 'Entrega Expressa (Sedex / Turbo)',
            time: '2 a 4 dias úteis',
            price: sedexPrice,
            isFree: false,
          },
        ],
      });
    } catch {
      setError('Erro ao consultar o CEP. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="shipping-calculator rounded-2xl bg-[var(--bg)] p-4 border border-[var(--line)]">
      <div className="flex items-center justify-between text-xs font-semibold text-[var(--text)] mb-2">
        <span>📦 Calcular Frete &amp; Prazo de Entrega:</span>
        <span className="text-[11px] text-emerald-500 font-bold">Frete Grátis acima de R$ 499</span>
      </div>

      <form onSubmit={handleCalculate} className="flex gap-2">
        <input
          type="text"
          value={cep}
          onChange={handleCepChange}
          placeholder="00000-000"
          maxLength={9}
          className="flex-1 rounded-xl bg-[var(--surface-solid)] p-2.5 text-xs text-[var(--text)] border border-[var(--line)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={isLoading || cep.replace(/\D/g, '').length !== 8}
          className="buy-button px-4 py-2.5 rounded-xl text-xs font-bold disabled:opacity-40"
        >
          {isLoading ? '...' : 'Calcular'}
        </button>
      </form>

      {error && (
        <p className="mt-2 text-xs text-rose-500 font-semibold">{error}</p>
      )}

      {shippingResult && (
        <div className="mt-3 pt-3 border-t border-[var(--line)]/60 space-y-2">
          <p className="text-[11px] text-[var(--muted)]">
            Destino: <strong className="text-[var(--text)]">{shippingResult.city}/{shippingResult.state}</strong> {shippingResult.neighborhood && `(${shippingResult.neighborhood})`}
          </p>

          <div className="space-y-1.5">
            {shippingResult.options.map((opt, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-[var(--surface-solid)] p-2.5 rounded-xl border border-[var(--line)]">
                <div>
                  <span className="font-bold text-[var(--text)] block">{opt.name}</span>
                  <span className="text-[11px] text-[var(--muted)]">Prazo estimado: {opt.time}</span>
                </div>
                <span className={`font-black ${opt.price === 0 ? 'text-emerald-500' : 'text-[var(--accent)]'}`}>
                  {opt.price === 0 ? 'GRÁTIS' : `R$ ${opt.price.toFixed(2).replace('.', ',')}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
