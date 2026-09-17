import React, { FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Eye, EyeOff, Loader2, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { safeDbCall } from '../utils/dbResilience';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Role } from '../types';
import { AdminErrorState, AdminListSkeleton } from '../components/AdminShared';
import { BENEFIT_ICON_REGISTRY, BenefitIconName, getBenefitIcon } from '../components/id-card/benefitIconRegistry';

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

interface NewSection {
  id: string;
  draft: SectionDraft;
}

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

const getSafeIconName = (value: string): BenefitIconName => (
  value in BENEFIT_ICON_REGISTRY ? value as BenefitIconName : 'Sparkles'
);

const IconPicker: React.FC<{ value: string; onChange: (value: BenefitIconName) => void }> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const SelectedIcon = getBenefitIcon(value);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-cbjjs-blue transition-colors hover:border-cbjjs-blue hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-slate-800"
        aria-label={`Ícone selecionado: ${value}. Abrir galeria de ícones`}
        aria-haspopup="dialog"
      >
        <SelectedIcon size={22} />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="presentation"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="max-h-[min(680px,90vh)] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-800"
            role="dialog"
            aria-modal="true"
            aria-labelledby="benefit-icon-picker-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p id="benefit-icon-picker-title" className="text-base font-black dark:text-white">Selecionar ícone</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Escolha um ícone para este benefício.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-slate-700 dark:hover:text-white"
                aria-label="Fechar galeria de ícones"
              >
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7">
              {Object.entries(BENEFIT_ICON_REGISTRY).map(([name, Icon]) => {
                const isSelected = value === name;
                return (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    aria-label={`Selecionar ícone ${name}`}
                    aria-pressed={isSelected}
                    onClick={() => {
                      onChange(name as BenefitIconName);
                      setIsOpen(false);
                    }}
                    className={`relative flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl p-2 text-center transition-colors ${isSelected ? 'bg-cbjjs-blue text-white' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-700'}`}
                  >
                    <Icon size={20} />
                    <span className="max-w-full truncate text-[9px] font-bold">{name}</span>
                    {isSelected && <Check size={13} className="absolute right-2 top-2" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const AdminMembershipBenefits: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [newSection, setNewSection] = useState<SectionDraft>(defaultSectionDraft);
  const [newSections, setNewSections] = useState<NewSection[]>([]);
  const [newCards, setNewCards] = useState<Record<string, BenefitCard[]>>({});
  const [newCardDrafts, setNewCardDrafts] = useState<Record<string, CardDraft>>({});
  const [sectionDrafts, setSectionDrafts] = useState<Record<string, SectionDraft>>({});
  const [cardDrafts, setCardDrafts] = useState<Record<string, CardDraft>>({});
  const [deletedSections, setDeletedSections] = useState<Record<string, boolean>>({});
  const [deletedCards, setDeletedCards] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

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
  const newSectionIds = new Set(newSections.map(section => section.id));
  const editorSections = [
    ...sections
      .filter(section => !deletedSections[section.id])
      .map(section => section),
    ...newSections.map(section => ({
      id: section.id,
      title: section.draft.title,
      icon_name: section.draft.icon_name,
      sort_order: section.draft.sort_order,
      is_active: section.draft.is_active,
      created_at: '',
      updated_at: '',
    })),
  ].sort((a, b) => a.sort_order - b.sort_order);

  const getSectionDraft = (section: BenefitSection): SectionDraft => sectionDrafts[section.id] || section;
  const getCardDraft = (card: BenefitCard): CardDraft => cardDrafts[card.id] || card;
  const getSectionCards = (sectionId: string): BenefitCard[] => [
    ...cards.filter(card => card.section_id === sectionId && !deletedCards[card.id]),
    ...(newCards[sectionId] || []).filter(card => !deletedCards[card.id]),
  ].sort((a, b) => a.sort_order - b.sort_order);
  const hasPendingChanges = newSections.length > 0
    || Object.keys(newCards).some(sectionId => newCards[sectionId].length > 0)
    || Object.keys(sectionDrafts).length > 0
    || Object.keys(cardDrafts).length > 0
    || Object.keys(deletedSections).length > 0
    || Object.keys(deletedCards).length > 0;

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['membership-benefits-admin'] });
    await queryClient.invalidateQueries({ queryKey: ['membership-benefits'] });
  };

  const persist = async <T,>(
    label: string,
    operation: (signal?: AbortSignal) => Promise<{ data: T | null; error: unknown }>
  ): Promise<T | null> => {
    const result = await safeDbCall(operation, { label });
    if (result.error) throw result.error;
    return result.data;
  };

  const updateSectionDraft = (section: BenefitSection, field: keyof SectionDraft, value: string | number | boolean) => {
    const current = getSectionDraft(section);
    setSectionDrafts(drafts => ({ ...drafts, [section.id]: { ...current, [field]: value } }));
  };

  const updateCardDraft = (card: BenefitCard, field: keyof CardDraft, value: string | number) => {
    const current = getCardDraft(card);
    setCardDrafts(drafts => ({ ...drafts, [card.id]: { ...current, [field]: value } }));
  };

  const handleAddSection = (event: FormEvent) => {
    event.preventDefault();
    try {
      const draft: SectionDraft = {
        title: validateText(newSection.title, 'O título da seção', 120),
        icon_name: getSafeIconName(newSection.icon_name),
        sort_order: validateOrder(Number(newSection.sort_order)),
        is_active: newSection.is_active,
      };
      const id = `new-section-${Date.now()}-${newSections.length}`;
      setNewSections(current => [...current, { id, draft }]);
      setNewSection({ ...defaultSectionDraft, sort_order: sections.length + newSections.length + 2 });
      addToast('success', 'Seção adicionada às alterações pendentes.');
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Não foi possível adicionar a seção.');
    }
  };

  const handleAddCard = (event: FormEvent, section: BenefitSection) => {
    event.preventDefault();
    const draft = newCardDrafts[section.id] || { ...defaultCardDraft, sort_order: getSectionCards(section.id).length + 1 };
    try {
      if (getSectionCards(section.id).length >= 4) throw new Error('Cada seção pode ter no máximo 4 cartões.');
      const validatedDraft: CardDraft = {
        title: validateText(draft.title, 'O título do cartão', 160),
        description: validateText(draft.description, 'A descrição do cartão', 2000),
        icon_name: getSafeIconName(draft.icon_name),
        sort_order: validateOrder(Number(draft.sort_order)),
      };
      const id = `new-card-${Date.now()}-${section.id}`;
      const card: BenefitCard = {
        id,
        section_id: section.id,
        ...validatedDraft,
        created_at: '',
        updated_at: '',
      };
      setNewCards(current => ({ ...current, [section.id]: [...(current[section.id] || []), card] }));
      setNewCardDrafts(current => {
        const next = { ...current };
        delete next[section.id];
        return next;
      });
      addToast('success', 'Cartão adicionado às alterações pendentes.');
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Não foi possível adicionar o cartão.');
    }
  };

  const handleDeleteSection = (section: BenefitSection) => {
    if (!window.confirm(`Excluir a seção "${section.title}" e seus cartões?`)) return;
    if (newSectionIds.has(section.id)) {
      const stagedCardIds = (newCards[section.id] || []).map(card => card.id);
      setNewSections(current => current.filter(item => item.id !== section.id));
      setNewCards(current => {
        const next = { ...current };
        delete next[section.id];
        return next;
      });
      setNewCardDrafts(current => {
        const next = { ...current };
        delete next[section.id];
        return next;
      });
      setCardDrafts(current => {
        const next = { ...current };
        stagedCardIds.forEach(id => delete next[id]);
        return next;
      });
      return;
    }
    setDeletedSections(current => ({ ...current, [section.id]: true }));
    setSectionDrafts(current => {
      const next = { ...current };
      delete next[section.id];
      return next;
    });
  };

  const handleDeleteCard = (card: BenefitCard) => {
    if (!window.confirm(`Excluir o cartão "${card.title}"?`)) return;
    if (card.id.startsWith('new-card-')) {
      setNewCards(current => ({
        ...current,
        [card.section_id]: (current[card.section_id] || []).filter(item => item.id !== card.id),
      }));
      setCardDrafts(current => {
        const next = { ...current };
        delete next[card.id];
        return next;
      });
      return;
    }
    setDeletedCards(current => ({ ...current, [card.id]: true }));
    setCardDrafts(current => {
      const next = { ...current };
      delete next[card.id];
      return next;
    });
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const preparedSections = editorSections.map(section => {
        const draft = getSectionDraft(section);
        return {
          id: section.id,
          title: validateText(draft.title, 'O título da seção', 120),
          icon_name: getSafeIconName(draft.icon_name),
          sort_order: validateOrder(Number(draft.sort_order)),
          is_active: draft.is_active,
        };
      });
      const preparedCards = editorSections.flatMap(section => getSectionCards(section.id).map(card => {
        const draft = getCardDraft(card);
        return {
          id: card.id,
          section_id: section.id,
          title: validateText(draft.title, 'O título do cartão', 160),
          description: validateText(draft.description, 'A descrição do cartão', 2000),
          icon_name: getSafeIconName(draft.icon_name),
          sort_order: validateOrder(Number(draft.sort_order)),
        };
      }));
      const deletedSectionIdSet = new Set(Object.keys(deletedSections));
      const sectionIdMap = new Map<string, string>();

      for (const sectionId of deletedSectionIdSet) {
        if (!newSectionIds.has(sectionId)) {
          await persist('AdminMembershipBenefit_DeleteSection', async () =>
            await supabase.from('membership_benefit_sections').delete().eq('id', sectionId)
          );
        }
      }

      for (const cardId of Object.keys(deletedCards)) {
        const card = cards.find(item => item.id === cardId);
        if (card && !deletedSectionIdSet.has(card.section_id)) {
          await persist('AdminMembershipBenefit_DeleteCard', async () =>
            await supabase.from('membership_benefit_cards').delete().eq('id', cardId)
          );
        }
      }

      for (const section of preparedSections.filter(item => newSectionIds.has(item.id))) {
        const inserted = await persist<{ id: string }>('AdminMembershipBenefit_CreateSection', async () =>
          await supabase.from('membership_benefit_sections').insert({
            title: section.title,
            icon_name: section.icon_name,
            sort_order: section.sort_order,
            is_active: section.is_active,
          }).select('id').single()
        );
        if (!inserted?.id) throw new Error('A nova seção não retornou um identificador.');
        sectionIdMap.set(section.id, inserted.id);
      }

      for (const section of preparedSections.filter(item => !newSectionIds.has(item.id) && !deletedSectionIdSet.has(item.id) && sectionDrafts[item.id])) {
        await persist('AdminMembershipBenefit_UpdateSection', async () =>
          await supabase.from('membership_benefit_sections').update({
            title: section.title,
            icon_name: section.icon_name,
            sort_order: section.sort_order,
            is_active: section.is_active,
            updated_at: new Date().toISOString(),
          }).eq('id', section.id).select('id').single()
        );
      }

      for (const card of preparedCards) {
        if (deletedSectionIdSet.has(card.section_id) || deletedCards[card.id]) continue;
        const mappedSectionId = sectionIdMap.get(card.section_id) || card.section_id;
        if (card.id.startsWith('new-card-')) {
          await persist('AdminMembershipBenefit_CreateCard', async () =>
            await supabase.from('membership_benefit_cards').insert({
              section_id: mappedSectionId,
              title: card.title,
              description: card.description,
              icon_name: card.icon_name,
              sort_order: card.sort_order,
            }).select('id').single()
          );
        } else if (cardDrafts[card.id]) {
          await persist('AdminMembershipBenefit_UpdateCard', async () =>
            await supabase.from('membership_benefit_cards').update({
              title: card.title,
              description: card.description,
              icon_name: card.icon_name,
              sort_order: card.sort_order,
              updated_at: new Date().toISOString(),
            }).eq('id', card.id).select('id').single()
          );
        }
      }

      await invalidate();
      await refetch();
      setSectionDrafts({});
      setCardDrafts({});
      setNewSections([]);
      setNewCards({});
      setNewCardDrafts({});
      setDeletedSections({});
      setDeletedCards({});
      addToast('success', 'Todas as alterações foram salvas com sucesso.');
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Não foi possível salvar todas as alterações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-10 animate-fadeIn pb-36">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-3xl font-black tracking-tight dark:text-white">Gestão de Benefícios</h2>
          <p className="text-sm font-medium text-gray-500">Edite as seções e cartões exibidos em Minha Carteirinha.</p>
        </div>
        <button type="button" onClick={() => refetch()} className="self-start rounded-xl border border-gray-100 bg-white p-3 text-cbjjs-blue transition-all hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800" aria-label="Atualizar benefícios">
          <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      <form onSubmit={handleAddSection} className="space-y-5 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-slate-800 md:p-8">
        <div className="flex items-center gap-3">
          <Plus className="text-cbjjs-blue" size={22} />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-cbjjs-blue">Conteúdo</p>
            <h3 className="text-lg font-black uppercase tracking-tight dark:text-white">Adicionar seção</h3>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_120px_120px]">
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-400">Título</label>
            <div className="flex items-center gap-2">
              <IconPicker value={newSection.icon_name} onChange={icon_name => setNewSection(current => ({ ...current, icon_name }))} />
              <input required maxLength={120} value={newSection.title} onChange={event => setNewSection(current => ({ ...current, title: event.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-400">Ordem</label>
            <input type="number" min="0" required value={newSection.sort_order} onChange={event => setNewSection(current => ({ ...current, sort_order: Number(event.target.value) }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </div>
          <label className="flex items-center gap-2 self-end p-3 text-xs font-bold text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={newSection.is_active} onChange={event => setNewSection(current => ({ ...current, is_active: event.target.checked }))} /> Ativa
          </label>
        </div>
        <button disabled={saving} className="flex items-center gap-2 rounded-xl bg-cbjjs-blue px-6 py-3 text-xs font-black uppercase tracking-widest text-white disabled:opacity-60">
          <Plus size={16} /> Adicionar seção
        </button>
      </form>

      {isLoading ? <AdminListSkeleton /> : isError ? <AdminErrorState onRetry={() => refetch()} /> : editorSections.length === 0 ? (
        <div className="rounded-3xl bg-white p-10 text-center text-sm text-gray-500 dark:bg-slate-800">Nenhuma seção cadastrada.</div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {editorSections.map(section => {
            const sectionDraft = getSectionDraft(section);
            const sectionCards = getSectionCards(section.id);
            const newCard = newCardDrafts[section.id] || { ...defaultCardDraft, sort_order: sectionCards.length + 1 };
            return (
              <section key={section.id} className="flex flex-col gap-6 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-slate-800 md:p-8">
                <div className="flex flex-col gap-5 border-b border-gray-100 pb-6 dark:border-slate-700">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-cbjjs-blue">Seção de benefícios</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Organize o título, a ordem e a visibilidade desta seção.</p>
                    </div>
                    <button type="button" onClick={() => handleDeleteSection(section)} disabled={saving} className="rounded-xl p-2 text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50" aria-label="Excluir seção">
                      <Trash2 size={17} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_100px]">
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-400">Título da seção</label>
                      <div className="flex items-center gap-2">
                        <IconPicker value={sectionDraft.icon_name} onChange={icon_name => {
                          if (newSectionIds.has(section.id)) {
                            setNewSections(current => current.map(item => item.id === section.id ? { ...item, draft: { ...item.draft, icon_name } } : item));
                          } else {
                            updateSectionDraft(section, 'icon_name', icon_name);
                          }
                        }} />
                        <input value={sectionDraft.title} maxLength={120} onChange={event => {
                          if (newSectionIds.has(section.id)) {
                            setNewSections(current => current.map(item => item.id === section.id ? { ...item, draft: { ...item.draft, title: event.target.value } } : item));
                          } else {
                            updateSectionDraft(section, 'title', event.target.value);
                          }
                        }} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 font-black dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-400">Ordem</label>
                      <input type="number" min="0" value={sectionDraft.sort_order} onChange={event => {
                        const value = Number(event.target.value);
                        if (newSectionIds.has(section.id)) {
                          setNewSections(current => current.map(item => item.id === section.id ? { ...item, draft: { ...item.draft, sort_order: value } } : item));
                        } else {
                          updateSectionDraft(section, 'sort_order', value);
                        }
                      }} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" aria-label="Ordem da seção" />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button type="button" onClick={() => {
                      if (newSectionIds.has(section.id)) {
                        setNewSections(current => current.map(item => item.id === section.id ? { ...item, draft: { ...item.draft, is_active: !item.draft.is_active } } : item));
                      } else {
                        updateSectionDraft(section, 'is_active', !sectionDraft.is_active);
                      }
                    }} className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest ${sectionDraft.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                      {sectionDraft.is_active ? <Eye size={14} className="mr-2 inline" /> : <EyeOff size={14} className="mr-2 inline" />} {sectionDraft.is_active ? 'Ativa' : 'Inativa'}
                    </button>
                    {newSectionIds.has(section.id) && <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Nova · pendente</span>}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Conteúdo da seção</p>
                      <h4 className="text-sm font-black uppercase tracking-widest dark:text-white">Cartões ({sectionCards.length}/4)</h4>
                    </div>
                    {sectionCards.length >= 4 && <span className="text-xs font-bold text-amber-600">Limite atingido</span>}
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {sectionCards.map(card => {
                      const draft = getCardDraft(card);
                      return (
                        <div key={card.id} className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                          <div>
                            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-400">Título do cartão</label>
                            <div className="flex items-center gap-2">
                              <IconPicker value={draft.icon_name} onChange={icon_name => updateCardDraft(card, 'icon_name', icon_name)} />
                              <input value={draft.title} maxLength={160} onChange={event => updateCardDraft(card, 'title', event.target.value)} className="w-full rounded-xl border border-gray-200 bg-white p-3 font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white" aria-label="Título do cartão" />
                            </div>
                          </div>
                          <textarea value={draft.description} maxLength={2000} rows={4} onChange={event => updateCardDraft(card, 'description', event.target.value)} className="w-full rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white" aria-label="Descrição do cartão" />
                          <div className="flex items-center gap-3">
                            <label className="flex-1">
                              <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-400">Ordem</span>
                              <input type="number" min="0" value={draft.sort_order} onChange={event => updateCardDraft(card, 'sort_order', Number(event.target.value))} className="w-full rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white" aria-label="Ordem do cartão" />
                            </label>
                            <button type="button" onClick={() => handleDeleteCard(card)} disabled={saving} className="mt-6 rounded-xl px-3 py-2 text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50" aria-label="Excluir cartão">
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {sectionCards.length < 4 && (
                    <form onSubmit={event => handleAddCard(event, section)} className="space-y-4 rounded-2xl border-2 border-dashed border-gray-200 p-4 dark:border-slate-700">
                      <p className="text-[10px] font-black uppercase tracking-widest text-cbjjs-blue">Adicionar cartão pendente</p>
                      <div>
                        <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-400">Título do cartão</label>
                        <div className="flex items-center gap-2">
                          <IconPicker value={newCard.icon_name} onChange={icon_name => setNewCardDrafts(current => ({ ...current, [section.id]: { ...newCard, icon_name } }))} />
                          <input required maxLength={160} value={newCard.title} onChange={event => setNewCardDrafts(current => ({ ...current, [section.id]: { ...newCard, title: event.target.value } }))} placeholder="Título do novo cartão" className="w-full rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                        </div>
                      </div>
                      <textarea required maxLength={2000} rows={3} value={newCard.description} onChange={event => setNewCardDrafts(current => ({ ...current, [section.id]: { ...newCard, description: event.target.value } }))} placeholder="Descrição do novo cartão" className="w-full rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                      <div className="flex items-end gap-3">
                        <label className="flex-1">
                          <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-400">Ordem</span>
                          <input type="number" min="0" required value={newCard.sort_order} onChange={event => setNewCardDrafts(current => ({ ...current, [section.id]: { ...newCard, sort_order: Number(event.target.value) } }))} className="w-full rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white" aria-label="Ordem do novo cartão" />
                        </label>
                        <button disabled={saving} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white dark:bg-white dark:text-slate-900 disabled:opacity-60"><Plus size={14} /> Adicionar</button>
                      </div>
                    </form>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {hasPendingChanges && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 p-3 shadow-[0_-8px_30px_rgba(15,23,42,0.12)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 sm:p-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black dark:text-white">Alterações pendentes</p>
              <p className="hidden text-xs text-gray-500 sm:block">Revise o conteúdo e salve tudo de uma vez.</p>
            </div>
            <button type="button" onClick={handleSaveAll} disabled={saving} className="flex shrink-0 items-center gap-2 rounded-xl bg-cbjjs-blue px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-900/20 disabled:opacity-60 sm:px-7">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Salvando...' : 'Salvar tudo'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
