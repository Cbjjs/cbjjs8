import React, { FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Loader2, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { safeDbCall } from '../utils/dbResilience';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Role } from '../types';
import { AdminErrorState, AdminListSkeleton } from '../components/AdminShared';
import { BENEFIT_ICON_REGISTRY, BenefitIconName } from '../components/id-card/benefitIconRegistry';

interface BenefitSection {
  id: string;
  title: string;
  icon_name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface BenefitCard {
  id: string;
  section_id: string;
  title: string;
  description: string;
  icon_name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface BenefitsData {
  sections: BenefitSection[];
  cards: BenefitCard[];
}

type SectionDraft = Pick<BenefitSection, 'title' | 'icon_name' | 'sort_order' | 'is_active'>;
type CardDraft = Pick<BenefitCard, 'title' | 'description' | 'icon_name' | 'sort_order'>;

const defaultSectionDraft: SectionDraft = {
  title: '',
  icon_name: 'Sparkles',
  sort_order: 1,
  is_active: true,
};

const defaultCardDraft: CardDraft = {
  title: '',
  description: '',
  icon_name: 'Sparkles',
  sort_order: 1,
};

const validateText = (value: string, label: string, maxLength: number): string => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} é obrigatório.`);
  if (trimmed.length > maxLength) throw new Error(`${label} deve ter no máximo ${maxLength} caracteres.`);
  return trimmed;
};

const validateOrder = (value: number): number => {
  if (!Number.isInteger(value) || value < 0) throw new Error('A ordem deve ser um número inteiro igual ou maior que zero.');
  return value;
};

const IconPicker: React.FC<{ value: string; onChange: (value: BenefitIconName) => void }> = ({ value, onChange }) => (
  <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-3 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-700">
    {Object.entries(BENEFIT_ICON_REGISTRY).map(([name, Icon]) => (
      <button
        key={name}
        type="button"
        title={name}
        aria-label={`Selecionar ícone ${name}`}
        onClick={() => onChange(name as BenefitIconName)}
        className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 transition-colors ${value === name ? 'bg-cbjjs-blue text-white' : 'text-gray-500 hover:bg-white dark:hover:bg-slate-800 dark:text-gray-400'}`}
      >
        <Icon size={18} />
        <span className="text-[8px] font-bold truncate max-w-full">{name}</span>
      </button>
    ))}
  </div>
);

export const AdminMembershipBenefits: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [newSection, setNewSection] = useState<SectionDraft>(defaultSectionDraft);
  const [newCards, setNewCards] = useState<Record<string, CardDraft>>({});
  const [sectionDrafts, setSectionDrafts] = useState<Record<string, SectionDraft>>({});
  const [cardDrafts, setCardDrafts] = useState<Record<string, CardDraft>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useSupabaseQuery<BenefitsData>(
    ['membership-benefits-admin'],
    async (signal) => {
      const [sectionsResponse, cardsResponse] = await Promise.all([
        supabase
          .from('membership_benefit_sections')
          .select('id, title, icon_name, sort_order, is_active, created_at, updated_at')
          .order('sort_order', { ascending: true })
          .abortSignal(signal),
        supabase
          .from('membership_benefit_cards')
          .select('id, section_id, title, description, icon_name, sort_order, created_at, updated_at')
          .order('sort_order', { ascending: true })
          .abortSignal(signal),
      ]);

      if (sectionsResponse.error) return { data: null, error: sectionsResponse.error };
      if (cardsResponse.error) return { data: null, error: cardsResponse.error };
      return {
        data: {
          sections: sectionsResponse.data as BenefitSection[],
          cards: cardsResponse.data as BenefitCard[],
        },
        error: null,
      };
    },
    { enabled: user?.role === Role.ADMIN }
  );

  if (!user || user.role !== Role.ADMIN) return null;

  const sections = data?.data.sections || [];
  const cards = data?.data.cards || [];

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['membership-benefits-admin'] });
    await queryClient.invalidateQueries({ queryKey: ['membership-benefits'] });
  };

  const persist = async (
    label: string,
    operation: (signal: AbortSignal) => Promise<{ data: unknown; error: unknown }>
  ) => {
    const result = await safeDbCall(operation, { label });
    if (result.error) throw result.error;
    await invalidate();
  };

  const runAction = async (key: string, action: () => Promise<void>, successMessage: string) => {
    setSaving(key);
    try {
      await action();
      addToast('success', successMessage);
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Não foi possível salvar as informações.');
    } finally {
      setSaving(null);
    }
  };

  const handleAddSection = async (event: FormEvent) => {
    event.preventDefault();
    await runAction('new-section', async () => {
      const title = validateText(newSection.title, 'O título da seção', 120);
      const sortOrder = validateOrder(newSection.sort_order);
      const iconName = newSection.icon_name in BENEFIT_ICON_REGISTRY ? newSection.icon_name : 'Sparkles';
      await persist('AdminMembershipBenefit_CreateSection', async () =>
        await supabase.from('membership_benefit_sections').insert({
          title,
          icon_name: iconName,
          sort_order: sortOrder,
          is_active: newSection.is_active,
        }).select().single()
      );
      setNewSection({ ...defaultSectionDraft, sort_order: sections.length + 1 });
    }, 'Seção adicionada com sucesso.');
  };

  const handleSaveSection = async (section: BenefitSection) => {
    const draft = sectionDrafts[section.id] || section;
    await runAction(`section-${section.id}`, async () => {
      const title = validateText(draft.title, 'O título da seção', 120);
      const sortOrder = validateOrder(Number(draft.sort_order));
      const iconName = draft.icon_name in BENEFIT_ICON_REGISTRY ? draft.icon_name : 'Sparkles';
      await persist('AdminMembershipBenefit_UpdateSection', async () =>
        await supabase.from('membership_benefit_sections').update({
          title,
          icon_name: iconName,
          sort_order: sortOrder,
          is_active: draft.is_active,
          updated_at: new Date().toISOString(),
        }).eq('id', section.id).select().single()
      );
      setSectionDrafts(current => {
        const next = { ...current };
        delete next[section.id];
        return next;
      });
    }, 'Seção atualizada com sucesso.');
  };

  const handleDeleteSection = async (section: BenefitSection) => {
    if (!window.confirm(`Excluir a seção "${section.title}" e seus cartões?`)) return;
    await runAction(`delete-section-${section.id}`, async () => {
      await persist('AdminMembershipBenefit_DeleteSection', async () =>
        await supabase.from('membership_benefit_sections').delete().eq('id', section.id)
      );
    }, 'Seção excluída com sucesso.');
  };

  const handleAddCard = async (event: FormEvent, section: BenefitSection) => {
    event.preventDefault();
    const draft = newCards[section.id] || { ...defaultCardDraft, sort_order: cards.filter(card => card.section_id === section.id).length + 1 };
    await runAction(`new-card-${section.id}`, async () => {
      if (cards.filter(card => card.section_id === section.id).length >= 4) throw new Error('Cada seção pode ter no máximo 4 cartões.');
      const title = validateText(draft.title, 'O título do cartão', 160);
      const description = validateText(draft.description, 'A descrição do cartão', 2000);
      const sortOrder = validateOrder(Number(draft.sort_order));
      const iconName = draft.icon_name in BENEFIT_ICON_REGISTRY ? draft.icon_name : 'Sparkles';
      await persist('AdminMembershipBenefit_CreateCard', async () =>
        await supabase.from('membership_benefit_cards').insert({
          section_id: section.id,
          title,
          description,
          icon_name: iconName,
          sort_order: sortOrder,
        }).select().single()
      );
      setNewCards(current => {
        const next = { ...current };
        delete next[section.id];
        return next;
      });
    }, 'Cartão adicionado com sucesso.');
  };

  const handleSaveCard = async (card: BenefitCard) => {
    const draft = cardDrafts[card.id] || card;
    await runAction(`card-${card.id}`, async () => {
      const title = validateText(draft.title, 'O título do cartão', 160);
      const description = validateText(draft.description, 'A descrição do cartão', 2000);
      const sortOrder = validateOrder(Number(draft.sort_order));
      const iconName = draft.icon_name in BENEFIT_ICON_REGISTRY ? draft.icon_name : 'Sparkles';
      await persist('AdminMembershipBenefit_UpdateCard', async () =>
        await supabase.from('membership_benefit_cards').update({
          title,
          description,
          icon_name: iconName,
          sort_order: sortOrder,
          updated_at: new Date().toISOString(),
        }).eq('id', card.id).select().single()
      );
      setCardDrafts(current => {
        const next = { ...current };
        delete next[card.id];
        return next;
      });
    }, 'Cartão atualizado com sucesso.');
  };

  const handleDeleteCard = async (card: BenefitCard) => {
    if (!window.confirm(`Excluir o cartão "${card.title}"?`)) return;
    await runAction(`delete-card-${card.id}`, async () => {
      await persist('AdminMembershipBenefit_DeleteCard', async () =>
        await supabase.from('membership_benefit_cards').delete().eq('id', card.id)
      );
    }, 'Cartão excluído com sucesso.');
  };

  const getSectionDraft = (section: BenefitSection): SectionDraft => sectionDrafts[section.id] || section;
  const getCardDraft = (card: BenefitCard): CardDraft => cardDrafts[card.id] || card;
  const updateSectionDraft = (section: BenefitSection, field: keyof SectionDraft, value: string | number | boolean) => {
    const current = getSectionDraft(section);
    setSectionDrafts(drafts => ({ ...drafts, [section.id]: { ...current, [field]: value } }));
  };
  const updateCardDraft = (card: BenefitCard, field: keyof CardDraft, value: string | number) => {
    const current = getCardDraft(card);
    setCardDrafts(drafts => ({ ...drafts, [card.id]: { ...current, [field]: value } }));
  };

  return (
    <div className="space-y-10 animate-fadeIn pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black dark:text-white tracking-tight">Gestão de Benefícios</h2>
          <p className="text-sm text-gray-500 font-medium">Edite as seções e cartões exibidos em Minha Carteirinha.</p>
        </div>
        <button type="button" onClick={() => refetch()} className="self-start p-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl hover:bg-gray-50 transition-all text-cbjjs-blue" aria-label="Atualizar benefícios">
          <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      <form onSubmit={handleAddSection} className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <Plus className="text-cbjjs-blue" size={22} />
          <h3 className="text-lg font-black uppercase tracking-tight dark:text-white">Adicionar seção</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_120px] gap-4">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Título</label>
            <input required maxLength={120} value={newSection.title} onChange={event => setNewSection(current => ({ ...current, title: event.target.value }))} className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl dark:text-white" />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Ordem</label>
            <input type="number" min="0" required value={newSection.sort_order} onChange={event => setNewSection(current => ({ ...current, sort_order: Number(event.target.value) }))} className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl dark:text-white" />
          </div>
          <label className="flex items-center gap-2 self-end p-3 text-xs font-bold text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={newSection.is_active} onChange={event => setNewSection(current => ({ ...current, is_active: event.target.checked }))} /> Ativa
          </label>
        </div>
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Ícone</label>
          <IconPicker value={newSection.icon_name} onChange={icon_name => setNewSection(current => ({ ...current, icon_name }))} />
        </div>
        <button disabled={saving === 'new-section'} className="px-6 py-3 bg-cbjjs-blue text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 disabled:opacity-60">
          {saving === 'new-section' ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Adicionar seção
        </button>
      </form>

      {isLoading ? <AdminListSkeleton /> : isError ? <AdminErrorState onRetry={() => refetch()} /> : sections.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-10 text-center text-sm text-gray-500">Nenhuma seção cadastrada.</div>
      ) : (
        <div className="space-y-8">
          {sections.map(section => {
            const sectionDraft = getSectionDraft(section);
            const sectionCards = cards.filter(card => card.section_id === section.id).sort((a, b) => a.sort_order - b.sort_order);
            const newCard = newCards[section.id] || { ...defaultCardDraft, sort_order: sectionCards.length + 1 };
            return (
              <section key={section.id} className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
                <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5 border-b border-gray-100 dark:border-slate-700 pb-6">
                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_100px] gap-3">
                      <input value={sectionDraft.title} maxLength={120} onChange={event => updateSectionDraft(section, 'title', event.target.value)} className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl font-black dark:text-white" />
                      <input type="number" min="0" value={sectionDraft.sort_order} onChange={event => updateSectionDraft(section, 'sort_order', Number(event.target.value))} className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl dark:text-white" aria-label="Ordem da seção" />
                    </div>
                    <IconPicker value={sectionDraft.icon_name} onChange={icon_name => updateSectionDraft(section, 'icon_name', icon_name)} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => updateSectionDraft(section, 'is_active', !sectionDraft.is_active)} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${sectionDraft.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                      {sectionDraft.is_active ? <Eye size={14} /> : <EyeOff size={14} />} {sectionDraft.is_active ? 'Ativa' : 'Inativa'}
                    </button>
                    <button type="button" onClick={() => handleSaveSection(section)} disabled={saving === `section-${section.id}`} className="px-4 py-2 rounded-xl bg-cbjjs-blue text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-60">
                      {saving === `section-${section.id}` ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
                    </button>
                    <button type="button" onClick={() => handleDeleteSection(section)} disabled={saving === `delete-section-${section.id}`} className="p-2 rounded-xl text-red-500 hover:bg-red-50" aria-label="Excluir seção">
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-black uppercase tracking-widest dark:text-white">Cartões ({sectionCards.length}/4)</h4>
                    {sectionCards.length >= 4 && <span className="text-xs font-bold text-amber-600">Limite de 4 cartões atingido</span>}
                  </div>
                  {sectionCards.map(card => {
                    const draft = getCardDraft(card);
                    return (
                      <div key={card.id} className="p-4 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-700 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_100px] gap-3">
                          <input value={draft.title} maxLength={160} onChange={event => updateCardDraft(card, 'title', event.target.value)} className="w-full p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl font-bold dark:text-white" aria-label="Título do cartão" />
                          <input type="number" min="0" value={draft.sort_order} onChange={event => updateCardDraft(card, 'sort_order', Number(event.target.value))} className="w-full p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl dark:text-white" aria-label="Ordem do cartão" />
                        </div>
                        <textarea value={draft.description} maxLength={2000} rows={3} onChange={event => updateCardDraft(card, 'description', event.target.value)} className="w-full p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl dark:text-white" aria-label="Descrição do cartão" />
                        <IconPicker value={draft.icon_name} onChange={icon_name => updateCardDraft(card, 'icon_name', icon_name)} />
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => handleDeleteCard(card)} disabled={saving === `delete-card-${card.id}`} className="px-4 py-2 rounded-xl text-red-500 hover:bg-red-50 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Trash2 size={14} /> Excluir</button>
                          <button type="button" onClick={() => handleSaveCard(card)} disabled={saving === `card-${card.id}`} className="px-4 py-2 rounded-xl bg-cbjjs-blue text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-60">{saving === `card-${card.id}` ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar cartão</button>
                        </div>
                      </div>
                    );
                  })}

                  {sectionCards.length < 4 && (
                    <form onSubmit={event => handleAddCard(event, section)} className="p-4 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_100px] gap-3">
                        <input required maxLength={160} value={newCard.title} onChange={event => setNewCards(current => ({ ...current, [section.id]: { ...newCard, title: event.target.value } }))} placeholder="Título do novo cartão" className="w-full p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl dark:text-white" />
                        <input type="number" min="0" required value={newCard.sort_order} onChange={event => setNewCards(current => ({ ...current, [section.id]: { ...newCard, sort_order: Number(event.target.value) } }))} className="w-full p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl dark:text-white" aria-label="Ordem do novo cartão" />
                      </div>
                      <textarea required maxLength={2000} rows={3} value={newCard.description} onChange={event => setNewCards(current => ({ ...current, [section.id]: { ...newCard, description: event.target.value } }))} placeholder="Descrição do novo cartão" className="w-full p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl dark:text-white" />
                      <IconPicker value={newCard.icon_name} onChange={icon_name => setNewCards(current => ({ ...current, [section.id]: { ...newCard, icon_name } }))} />
                      <button disabled={saving === `new-card-${section.id}`} className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-60">{saving === `new-card-${section.id}` ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Adicionar cartão</button>
                    </form>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
