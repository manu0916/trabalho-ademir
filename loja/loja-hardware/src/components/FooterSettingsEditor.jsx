import { useEffect, useState } from 'react';
import { fetchFooterSettings, saveFooterSettings } from '../services/api';
import { playUiSound } from '../utils/soundEffects';

const INITIAL_DEFAULTS = {
  wordmark: 'KICKS STORE',
  brandTagline: 'Calce a felicidade. Viva o seu ritmo.',
  locationTitle: '',
  addressLine1: '',
  addressLine2: '',
  hoursTitle: '',
  storeHoursLine1: '',
  storeHoursLine2: '',
  authTitle: '',
  authBadgeTitle: '',
  authBadgeDetail: '',
  navTitle: '',
  backToTopText: '',
  contactEmail: '',
  contactPhone: '',
  cnpjText: '',
  instagramHandle: '',
  citiesRail: '',
  copyrightText: 'Todos os direitos reservados.',
};

export default function FooterSettingsEditor({ onFooterUpdated }) {
  const [settings, setSettings] = useState(INITIAL_DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    fetchFooterSettings()
      .then((data) => {
        if (data) {
          setSettings((prev) => ({
            ...prev,
            ...data,
          }));
        }
      })
      .catch(() => {
        // use defaults
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleChange = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess('');
    setIsSaving(true);

    try {
      const saved = await saveFooterSettings(settings);
      playUiSound('success');
      setSaveSuccess('Todas as informações do rodapé foram atualizadas com sucesso no banco de dados!');
      if (onFooterUpdated) onFooterUpdated(saved || settings);
      setTimeout(() => setSaveSuccess(''), 6000);
    } catch (err) {
      playUiSound('pop');
      setSaveError(err.message || 'Erro ao salvar alterações no rodapé.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle =
    'w-full rounded-xl px-3.5 py-2 text-xs font-mono-tech bg-[#FFFDF5] border border-black/[0.1] text-[#1C1714] focus:border-[#FFB400] focus:ring-2 focus:ring-[#FFB400]/20 placeholder-[#B0A89E] outline-none transition-colors';

  const groupCardStyle =
    'p-5 rounded-2xl bg-[#FFF8E8] border border-black/[0.08] space-y-3.5 shadow-sm';

  if (isLoading) {
    return (
      <section className="admin-section rounded-3xl p-6 sm:p-8 bg-white border border-black/[0.08] shadow-[0_2px_16px_rgba(180,120,0,0.06)]">
        <p className="font-mono-tech text-xs text-[#9A8F85] text-center py-6">Carregando configurações do rodapé...</p>
      </section>
    );
  }

  return (
    <section className="admin-section rounded-3xl p-6 sm:p-8 bg-white border border-black/[0.08] shadow-[0_2px_16px_rgba(180,120,0,0.06)] space-y-6">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center pb-4 border-b border-black/[0.08]">
        <div>
          <span className="font-mono-tech text-[10px] text-[#FFB400] uppercase tracking-widest block mb-1">
            CUSTOMIZAÇÃO COMPLETA // RODAPÉ DA LOJA
          </span>
          <h2 className="font-syne text-xl font-extrabold uppercase text-[#1C1714]">
            Gerenciador de Todas as Informações do Rodapé
          </h2>
          <p className="font-mono-tech text-xs text-[#7A6E65] mt-1">
            Publique apenas informações reais e verificadas. Campos opcionais vazios não aparecem na vitrine.
          </p>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono-tech text-xs flex items-center gap-2">
          <span>✓</span>
          <span>{saveSuccess}</span>
        </div>
      )}

      {saveError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono-tech text-xs flex items-center gap-2">
          <span>✕</span>
          <span>{saveError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Bloco 1: Identidade da Marca (Wordmark & Tagline) */}
        <div className={groupCardStyle}>
          <div className="flex items-center gap-2 pb-2 border-b border-black/[0.08]">
            <span className="text-[#FFB400] text-xs font-mono-tech font-bold">01.</span>
            <h3 className="font-mono-tech text-xs font-bold uppercase text-[#1C1714] tracking-wider">
              Identidade Visual da Marca (Letreiro &amp; Slogan)
            </h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-mono-tech text-[11px] text-[#7A6E65] mb-1.5 uppercase">
                Letreiro da Marca (Wordmark Gigante):
              </label>
              <input
                type="text"
                value={settings.wordmark}
                onChange={(e) => handleChange('wordmark', e.target.value)}
                placeholder="Ex: KICKS STORE"
                className={inputStyle}
                required
              />
            </div>
            <div>
              <label className="block font-mono-tech text-[11px] text-[#7A6E65] mb-1.5 uppercase">
                Slogan / Tagline do Rodapé:
              </label>
              <input
                type="text"
                value={settings.brandTagline}
                onChange={(e) => handleChange('brandTagline', e.target.value)}
                placeholder="Ex: Calce a felicidade. Viva o seu ritmo."
                className={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Bloco 2: Colunas Superiores (Localização, Horários, Autenticidade) */}
        <div className="grid gap-5 md:grid-cols-3">
          
          {/* Card: Localização */}
          <div className={groupCardStyle}>
            <div className="flex items-center gap-2 pb-2 border-b border-black/[0.08]">
              <span className="text-[#FFB400] text-xs font-mono-tech font-bold">02.</span>
              <h3 className="font-mono-tech text-xs font-bold uppercase text-[#1C1714] tracking-wider">
                Localização Física
              </h3>
            </div>
            <div>
              <label className="block font-mono-tech text-[11px] text-[#7A6E65] mb-1 uppercase">
                Título do Bloco:
              </label>
              <input
                type="text"
                value={settings.locationTitle}
                onChange={(e) => handleChange('locationTitle', e.target.value)}
                placeholder="Ex: Nossa loja"
                className={inputStyle}
              />
            </div>
            <div>
              <label className="block font-mono-tech text-[11px] text-[#7A6E65] mb-1 uppercase">
                Endereço Linha 1:
              </label>
              <input
                type="text"
                value={settings.addressLine1}
                onChange={(e) => handleChange('addressLine1', e.target.value)}
                placeholder="Informe somente um endereço real"
                className={inputStyle}
              />
            </div>
            <div>
              <label className="block font-mono-tech text-[11px] text-[#7A6E65] mb-1 uppercase">
                Endereço Linha 2 (Bairro/Cidade):
              </label>
              <input
                type="text"
                value={settings.addressLine2}
                onChange={(e) => handleChange('addressLine2', e.target.value)}
                placeholder="Bairro e cidade verificados"
                className={inputStyle}
              />
            </div>
          </div>

          {/* Card: Horários */}
          <div className={groupCardStyle}>
            <div className="flex items-center gap-2 pb-2 border-b border-black/[0.08]">
              <span className="text-[#FFB400] text-xs font-mono-tech font-bold">03.</span>
              <h3 className="font-mono-tech text-xs font-bold uppercase text-[#1C1714] tracking-wider">
                Horário de Atendimento
              </h3>
            </div>
            <div>
              <label className="block font-mono-tech text-[11px] text-[#7A6E65] mb-1 uppercase">
                Título do Bloco:
              </label>
              <input
                type="text"
                value={settings.hoursTitle}
                onChange={(e) => handleChange('hoursTitle', e.target.value)}
                placeholder="Ex: Horário de atendimento"
                className={inputStyle}
              />
            </div>
            <div>
              <label className="block font-mono-tech text-[11px] text-[#7A6E65] mb-1 uppercase">
                Dias Úteis:
              </label>
              <input
                type="text"
                value={settings.storeHoursLine1}
                onChange={(e) => handleChange('storeHoursLine1', e.target.value)}
                placeholder="Informe apenas horários reais"
                className={inputStyle}
              />
            </div>
            <div>
              <label className="block font-mono-tech text-[11px] text-[#7A6E65] mb-1 uppercase">
                Finais de Semana / Feriados:
              </label>
              <input
                type="text"
                value={settings.storeHoursLine2}
                onChange={(e) => handleChange('storeHoursLine2', e.target.value)}
                placeholder="Deixe vazio se não houver outro horário"
                className={inputStyle}
              />
            </div>
          </div>

          {/* Card: Garantia & Selo */}
          <div className={groupCardStyle}>
            <div className="flex items-center gap-2 pb-2 border-b border-black/[0.08]">
              <span className="text-[#FFB400] text-xs font-mono-tech font-bold">04.</span>
              <h3 className="font-mono-tech text-xs font-bold uppercase text-[#1C1714] tracking-wider">
                Declarações sobre os Produtos
              </h3>
            </div>
            <div>
              <label className="block font-mono-tech text-[11px] text-[#7A6E65] mb-1 uppercase">
                Título do Bloco:
              </label>
              <input
                type="text"
                value={settings.authTitle}
                onChange={(e) => handleChange('authTitle', e.target.value)}
                placeholder="Preencha somente se a declaração for verificável"
                className={inputStyle}
              />
            </div>
            <div>
              <label className="block font-mono-tech text-[11px] text-[#7A6E65] mb-1 uppercase">
                Destaque do Selo (Verde Destaque):
              </label>
              <input
                type="text"
                value={settings.authBadgeTitle}
                onChange={(e) => handleChange('authBadgeTitle', e.target.value)}
                placeholder="Título da declaração verificada"
                className={inputStyle}
              />
            </div>
            <div>
              <label className="block font-mono-tech text-[11px] text-[#7A6E65] mb-1 uppercase">
                Detalhe da Declaração:
              </label>
              <input
                type="text"
                value={settings.authBadgeDetail}
                onChange={(e) => handleChange('authBadgeDetail', e.target.value)}
                placeholder="Detalhe objetivo e comprovável"
                className={inputStyle}
              />
            </div>
          </div>

        </div>

        {/* Bloco 3: Navegação, Contato, SAC & Redes Sociais */}
        <div className={groupCardStyle}>
          <div className="flex items-center gap-2 pb-2 border-b border-black/[0.08]">
            <span className="text-[#FFB400] text-xs font-mono-tech font-bold">05.</span>
            <h3 className="font-mono-tech text-xs font-bold uppercase text-[#1C1714] tracking-wider">
              Navegação, Suporte, SAC &amp; Contatos
            </h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block font-mono-tech text-[11px] text-[#7A6E65] mb-1.5 uppercase">
                Título do Bloco de Navegação:
              </label>
              <input
                type="text"
                value={settings.navTitle}
                onChange={(e) => handleChange('navTitle', e.target.value)}
                placeholder="Ex: Explore"
                className={inputStyle}
              />
            </div>
            <div>
              <label className="block font-mono-tech text-[11px] text-[#7A6E65] mb-1.5 uppercase">
                Texto do Botão Subir ao Topo:
              </label>
              <input
                type="text"
                value={settings.backToTopText}
                onChange={(e) => handleChange('backToTopText', e.target.value)}
                placeholder="Ex: Voltar ao topo"
                className={inputStyle}
              />
            </div>
            <div>
              <label className="block font-mono-tech text-[11px] text-[#7A6E65] mb-1.5 uppercase">
                E-mail de Atendimento SAC:
              </label>
              <input
                type="email"
                value={settings.contactEmail}
                onChange={(e) => handleChange('contactEmail', e.target.value)}
                placeholder="nome@dominio.com"
                className={inputStyle}
              />
            </div>
            <div>
              <label className="block font-mono-tech text-[11px] text-[#7A6E65] mb-1.5 uppercase">
                Telefone / WhatsApp SAC:
              </label>
              <input
                type="text"
                value={settings.contactPhone}
                onChange={(e) => handleChange('contactPhone', e.target.value)}
                placeholder="(DDD) número verificado"
                className={inputStyle}
              />
            </div>
            <div>
              <label className="block font-mono-tech text-[11px] text-[#7A6E65] mb-1.5 uppercase">
                Instagram da Loja:
              </label>
              <input
                type="text"
                value={settings.instagramHandle}
                onChange={(e) => handleChange('instagramHandle', e.target.value)}
                placeholder="@perfil_verificado"
                className={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Bloco 4: Rodapé Inferior, Unidades & Direitos */}
        <div className={groupCardStyle}>
          <div className="flex items-center gap-2 pb-2 border-b border-black/[0.08]">
            <span className="text-[#FFB400] text-xs font-mono-tech font-bold">06.</span>
            <h3 className="font-mono-tech text-xs font-bold uppercase text-[#1C1714] tracking-wider">
              Linha Inferior, Unidades &amp; Dados Legais (CNPJ &amp; Copyright)
            </h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block font-mono-tech text-[11px] text-[#7A6E65] mb-1.5 uppercase">
                Trilho de Cidades / Unidades:
              </label>
              <input
                type="text"
                value={settings.citiesRail}
                onChange={(e) => handleChange('citiesRail', e.target.value)}
                placeholder="Liste somente unidades reais"
                className={inputStyle}
              />
            </div>
            <div>
              <label className="block font-mono-tech text-[11px] text-[#7A6E65] mb-1.5 uppercase">
                CNPJ / Razão Social:
              </label>
              <input
                type="text"
                value={settings.cnpjText}
                onChange={(e) => handleChange('cnpjText', e.target.value)}
                placeholder="Informe somente dados empresariais oficiais"
                className={inputStyle}
              />
            </div>
            <div>
              <label className="block font-mono-tech text-[11px] text-[#7A6E65] mb-1.5 uppercase">
                Texto de Direitos Autorais / Copyright:
              </label>
              <input
                type="text"
                value={settings.copyrightText}
                onChange={(e) => handleChange('copyrightText', e.target.value)}
                placeholder="Ex: Todos os direitos reservados."
                className={inputStyle}
                required
              />
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="pt-4 border-t border-black/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-mono-tech text-[11px] text-[#9A8F85]">
            As alterações salvas são refletidas instantaneamente no rodapé de toda a vitrine.
          </p>
          <button
            type="submit"
            disabled={isSaving}
            className="btn-brutalist !py-3 !px-8 text-xs font-bold uppercase cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-lg"
          >
            {isSaving ? 'Salvando no Banco...' : 'Salvar Alterações do Rodapé →'}
          </button>
        </div>
      </form>
    </section>
  );
}

