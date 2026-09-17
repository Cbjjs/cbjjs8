import React from 'react';
import { Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { getBenefitIcon } from './benefitIconRegistry';

interface BenefitCard {
  id: string;
  section_id: string;
  title: string;
  description: string;
  icon_name: string;
  sort_order: number;
}

interface BenefitSection {
  id: string;
  title: string;
  icon_name: string;
  sort_order: number;
  is_active: boolean;
  membership_benefit_cards?: BenefitCard[];
}

const FALLBACK_SECTIONS: BenefitSection[] = [
  {
    id: 'fallback-membership',
    title: 'Carteirinha e Certificados',
    icon_name: 'CreditCard',
    sort_order: 1,
    is_active: true,
    membership_benefit_cards: [
      {
        id: 'fallback-card',
        section_id: 'fallback-membership',
        title: 'Carteirinha de Filiação',
        description: 'Identificação oficial com anuidade de apenas R$ 30,00. Contém seus dados de registro, academia e faixa, validando sua trajetória no esporte.',
        icon_name: 'CreditCard',
        sort_order: 1,
      },
      {
        id: 'fallback-certificate',
        section_id: 'fallback-membership',
        title: 'Certificados Oficiais',
        description: 'Solicite certificados oficiais de competições para fortalecer seu currículo esportivo e facilitar a obtenção de patrocínios e Bolsa Atleta.',
        icon_name: 'FileBadge',
        sort_order: 2,
      },
    ],
  },
  {
    id: 'fallback-services',
    title: 'Saúde e Serviços',
    icon_name: 'HeartPulse',
    sort_order: 2,
    is_active: true,
    membership_benefit_cards: [
      {
        id: 'fallback-medical',
        section_id: 'fallback-services',
        title: 'PLANO DE CONSULTA MÉDICA ONLINE',
        description: 'Atletas filiados podem contratar consultas médicas online por apenas R$ 15,00 mensais (ou R$ 120,00 anuais). Evite filas e inclua sua família pelo mesmo valor por pessoa. Saúde acessível para o campeão e sua família.',
        icon_name: 'Stethoscope',
        sort_order: 1,
      },
      {
        id: 'fallback-optics',
        section_id: 'fallback-services',
        title: 'Óticas Parceiras',
        description: 'Até 50% de desconto na compra de óculos em nossa rede conveniada.',
        icon_name: 'Percent',
        sort_order: 2,
      },
      {
        id: 'fallback-legal',
        section_id: 'fallback-services',
        title: 'Assistência Jurídica',
        description: '15% de desconto em honorários para assistência em todas as áreas.',
        icon_name: 'Scale',
        sort_order: 3,
      },
      {
        id: 'fallback-accounting',
        section_id: 'fallback-services',
        title: 'Contabilidade',
        description: 'Suporte contábil com 15% de desconto nos honorários para atletas e equipes.',
        icon_name: 'Calculator',
        sort_order: 4,
      },
    ],
  },
  {
    id: 'fallback-teams',
    title: 'Equipes e Competições',
    icon_name: 'Trophy',
    sort_order: 3,
    is_active: true,
    membership_benefit_cards: [
      {
        id: 'fallback-social',
        section_id: 'fallback-teams',
        title: 'Apoio Social',
        description: 'As equipes filiadas participam do ranking anual com premiação até o 7º lugar e podem receber cestas básicas como suporte social.',
        icon_name: 'Apple',
        sort_order: 1,
      },
      {
        id: 'fallback-events',
        section_id: 'fallback-teams',
        title: 'Eventos Sociais',
        description: 'Acesso a competições com valores de inscrição reduzidos, mantendo o alto nível técnico e organização oficial da confederação.',
        icon_name: 'ShieldCheck',
        sort_order: 2,
      },
    ],
  },
];

const sortSections = (sections: BenefitSection[]) => sections
  .map(section => ({
    ...section,
    membership_benefit_cards: [...(section.membership_benefit_cards || [])].sort((a, b) => a.sort_order - b.sort_order),
  }))
  .sort((a, b) => a.sort_order - b.sort_order);

export const MembershipBenefits: React.FC = () => {
  const { data, isError } = useSupabaseQuery<BenefitSection[]>(
    ['membership-benefits'],
    async (signal) => {
      const response = await supabase
        .from('membership_benefit_sections')
        .select('id, title, icon_name, sort_order, is_active, membership_benefit_cards (id, section_id, title, description, icon_name, sort_order)')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .abortSignal(signal);

      if (response.error) return { data: null, error: response.error };
      return { data: response.data as BenefitSection[], error: null };
    }
  );

  const sections = sortSections(isError ? FALLBACK_SECTIONS : (data?.data || []));
  const sectionTitleClass = 'text-xl font-black text-gray-900 dark:text-white mb-6 flex items-center gap-3 uppercase tracking-tighter';
  const cardClass = 'bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all';
  const benefitTitleClass = 'font-black text-sm text-cbjjs-blue dark:text-blue-400 uppercase tracking-tight mb-2';
  const benefitDescClass = 'text-sm text-gray-600 dark:text-gray-400 leading-relaxed';

  return (
    <div className="mt-16 space-y-12 animate-fadeIn max-w-4xl mx-auto">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 px-4 py-1.5 rounded-full text-cbjjs-blue dark:text-blue-300 text-xs font-black uppercase tracking-widest">
          <Sparkles size={14} />Bem-vindo à CBJJS
        </div>
        <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tighter">Vantagens em se filiar</h2>
        <p className="text-gray-500 font-medium italic">A primeira Confederação do Social – Esporte que transforma vidas.</p>
      </div>

      {sections.map(section => {
        const cards = section.membership_benefit_cards || [];
        const SectionIcon = getBenefitIcon(section.icon_name);
        const cardCountClass = cards.length === 1
          ? 'md:grid-cols-1'
          : cards.length === 2
            ? 'md:grid-cols-2'
            : 'md:grid-cols-3';

        return (
          <div key={section.id} className="space-y-6">
            <h3 className={sectionTitleClass}>
              <SectionIcon className={section.icon_name === 'HeartPulse' ? 'text-red-500' : section.icon_name === 'Trophy' ? 'text-cbjjs-gold' : 'text-cbjjs-blue'} />
              {section.title}
            </h3>
            <div className={`grid grid-cols-1 ${cardCountClass} gap-6`}>
              {cards.map((card, index) => {
                const CardIcon = getBenefitIcon(card.icon_name);
                const isMedicalPlan = card.icon_name === 'Stethoscope';
                const isFourCardLead = cards.length === 4 && index === 0;

                if (isMedicalPlan) {
                  return (
                    <div key={card.id} className={`${cardClass} ${isFourCardLead ? 'md:col-span-3' : ''} ${cards.length === 4 ? 'md:col-span-3 border-l-4 border-l-cbjjs-green' : 'border-l-4 border-l-cbjjs-green'}`}>
                      <div className="flex flex-col md:flex-row gap-6 items-start">
                        <div className="w-14 h-14 bg-green-50 dark:bg-green-900/30 rounded-2xl flex items-center justify-center text-cbjjs-green shrink-0">
                          <CardIcon size={28} />
                        </div>
                        <div>
                          <h4 className="font-black text-lg text-gray-900 dark:text-white mb-2 uppercase tracking-tighter">{card.title}</h4>
                          <p className={benefitDescClass}>{card.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={card.id} className={`${cardClass} ${isFourCardLead ? 'md:col-span-3' : ''}`}>
                    <div className="flex gap-4">
                      <CardIcon className="text-indigo-500 shrink-0" size={24} />
                      <div>
                        <h4 className={benefitTitleClass}>{card.title}</h4>
                        <p className={benefitDescClass}>{card.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="pt-10 border-t dark:border-slate-800 text-center">
        <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Confederação Brasileira de Jiu-Jitsu Social</p>
      </div>
    </div>
  );
};
