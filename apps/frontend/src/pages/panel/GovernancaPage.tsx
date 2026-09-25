import React, { useEffect, useMemo, useState } from 'react';
import { DealStatus, getGovernanca, GovernancaResponse, Deal } from '../../api/governanca';
import { unreproveProspect } from '../../api/prospects';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Popover, PopoverTrigger, PopoverContent } from '../../components/ui/popover';
import { DealCard } from '../../components/governanca/DealCard';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { toast } from 'sonner';
import { formatBRL } from '../../lib/formatters';
import { cn } from '../../lib/utils';

type GovernancaTab = DealStatus | 'todos';

const TAB_ORDER: GovernancaTab[] = ['todos', 'conquistado', 'em_negociacao', 'perdido'];

const TAB_LABEL: Record<GovernancaTab, string> = {
  todos: 'Todos',
  conquistado: 'Conquistados',
  em_negociacao: 'Em negociação',
  perdido: 'Perdidos',
};

const MONTH_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

const ChevronIcon = ({ className }: { className?: string }) => (
  <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const formatMonth = (ym: string): string => {
  const date = new Date(`${ym}-01T12:00:00`);
  if (Number.isNaN(date.getTime())) return ym;
  return date
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase());
};

const currentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const addMonths = (ym: string, delta: number): string => {
  const [year, month] = ym.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const GovernancaPage: React.FC = () => {
  const [data, setData] = useState<GovernancaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMonth, setActiveMonth] = useState<string>(() => currentMonth());
  const [tab, setTab] = useState<GovernancaTab>('todos');
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState<number>(() => {
    const now = new Date();
    return now.getFullYear();
  });
  const confirm = useConfirm();

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getGovernanca();
      setData(result);
      const fallback = result.months.length ? result.months[0] : currentMonth();
      setActiveMonth(prev => (prev && result.months.includes(prev) ? prev : fallback));
    } catch (err) {
      console.error('Erro ao carregar governança:', err);
      setError('Não foi possível carregar a governança. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const months = useMemo(() => data?.months ?? [], [data]);

  const normalized = useMemo(() => {
    if (!data) return [];
    return data.deals.map(d => ({
      ...d,
      month: d.reference_date.slice(0, 7),
    }));
  }, [data]);

  const visibleDeals = useMemo(() => {
    const term = search.trim().toLowerCase();
    return normalized.filter(deal => {
      const inMonth = activeMonth ? deal.month === activeMonth : true;
      if (!inMonth) return false;
      if (tab !== 'todos' && deal.status !== tab) return false;
      if (!term) return true;
      return [deal.name, deal.cnpj, deal.segment, deal.city, deal.state, deal.email]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(term));
    });
  }, [normalized, activeMonth, tab, search]);

  const counts = useMemo(() => {
    const base = { conquistado: 0, em_negociacao: 0, perdido: 0 };
    for (const deal of normalized) {
      if (activeMonth && deal.month !== activeMonth) continue;
      base[deal.status] += 1;
    }
    return base;
  }, [normalized, activeMonth]);

  const conqueredRevenue = useMemo(() => {
    return normalized
      .filter(d => d.status === 'conquistado' && (!activeMonth || d.month === activeMonth))
      .reduce((sum, d) => sum + (d.proposal?.final_price ?? 0), 0);
  }, [normalized, activeMonth]);

  const canGoForward = activeMonth < currentMonth();

  const goBack = () => setActiveMonth(prev => addMonths(prev, -1));
  const goForward = () => {
    if (canGoForward) setActiveMonth(prev => addMonths(prev, 1));
  };

  const handleUnreprove = async (deal: Deal) => {
    const ok = await confirm({
      title: 'Voltar à negociação?',
      message: `"${deal.name}" voltará para Meus Prospectos e para o grupo Em negociação, junto com seus orçamentos e contratos.`,
      variant: 'warning',
      confirmLabel: 'Voltar à negociação',
    });
    if (!ok) return;
    try {
      await unreproveProspect(deal.id);
      toast.success(`"${deal.name}" voltou para a negociação.`);
      await load();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao reverter o status.');
    }
  };

  const filteredByTab = (t: GovernancaTab) =>
    t === 'todos' ? visibleDeals : visibleDeals.filter(d => d.status === t);

  return (
    <div className="animate-[panelFadeIn_0.4s_ease-out]">
      <Breadcrumb items={[{ label: 'Painel', to: '/painel' }, { label: 'Governança' }]} />

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-extrabold tracking-tight text-foreground">Governança</h1>
          <p className="text-[14px] text-muted-foreground">
            Acompanhe mês a mês todos os negócios da sua captação: conquistados, em negociação e perdidos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goBack} aria-label="Mês anterior" data-testid="month-prev">
            <ChevronIcon />
          </Button>

          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger
              aria-label="Escolher mês da governança"
              data-testid="month-picker"
              className="flex h-9 items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-[13px] font-semibold text-foreground outline-none transition-colors hover:bg-muted focus:border-ring focus:ring-3 focus:ring-ring/50"
            >
              <CalendarIcon className="size-4 text-muted-foreground" />
              {formatMonth(activeMonth)}
            </PopoverTrigger>
            <PopoverContent align="end" side="bottom" className="w-60 p-2">
              <div className="mb-1 flex items-center justify-between rounded-md px-1">
                <button
                  type="button"
                  onClick={() => setPickerYear(y => y - 1)}
                  aria-label="Ano anterior"
                  data-testid="year-prev"
                  className="flex h-7 w-7 items-center justify-center rounded-md outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <ChevronIcon className="size-3.5" />
                </button>
                <span className="text-[13px] font-bold text-foreground" data-testid="picker-year">{pickerYear}</span>
                <button
                  type="button"
                  onClick={() => setPickerYear(y => y + 1)}
                  aria-label="Próximo ano"
                  data-testid="year-next"
                  className="flex h-7 w-7 items-center justify-center rounded-md outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <ChevronIcon className="size-3.5 rotate-180" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {MONTH_SHORT.map((label, i) => {
                  const ym = `${pickerYear}-${String(i + 1).padStart(2, '0')}`;
                  const active = ym === activeMonth;
                  const hasData = months.includes(ym);
                  return (
                    <button
                      key={ym}
                      type="button"
                      onClick={() => {
                        setActiveMonth(ym);
                        setPickerYear(Number(ym.slice(0, 4)));
                        setPickerOpen(false);
                      }}
                      aria-current={active ? 'date' : undefined}
                      data-testid={`month-option-${i + 1}`}
                      className={cn(
                        'relative rounded-md px-2 py-1.5 text-[13px] font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50',
                        active
                          ? 'bg-foreground text-background hover:bg-foreground'
                          : hasData
                            ? 'text-foreground'
                            : 'text-muted-foreground',
                      )}
                    >
                      {label}
                      {hasData && (
                        <span aria-hidden className="absolute right-1.5 top-1.5 size-1 rounded-full bg-current opacity-60" />
                      )}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="icon" onClick={goForward} disabled={!canGoForward} aria-label="Próximo mês" data-testid="month-next">
            <ChevronIcon className="rotate-180" />
          </Button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="governanca-stats">
        <Card className="p-4">
          <span className="text-[12px] font-medium text-muted-foreground">Conquistados ({formatMonth(activeMonth)})</span>
          <p className="mt-1 text-[26px] font-extrabold text-emerald-600 dark:text-emerald-400" data-testid="stat-conquistado">{counts.conquistado}</p>
        </Card>
        <Card className="p-4">
          <span className="text-[12px] font-medium text-muted-foreground">Em negociação ({formatMonth(activeMonth)})</span>
          <p className="mt-1 text-[26px] font-extrabold text-amber-600 dark:text-amber-400" data-testid="stat-em_negociacao">{counts.em_negociacao}</p>
        </Card>
        <Card className="p-4">
          <span className="text-[12px] font-medium text-muted-foreground">Perdidos ({formatMonth(activeMonth)})</span>
          <p className="mt-1 text-[26px] font-extrabold text-red-600 dark:text-red-400" data-testid="stat-perdido">{counts.perdido}</p>
        </Card>
        <Card className="p-4">
          <span className="text-[12px] font-medium text-muted-foreground">Faturamento conquistado ({formatMonth(activeMonth)})</span>
          <p className="mt-1 text-[22px] font-extrabold text-foreground" data-testid="stat-faturamento">{formatBRL(conqueredRevenue)}</p>
        </Card>
      </div>

      {error ? (
        <Card className="p-12 text-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--destructive))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 opacity-50">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3 className="mb-2 text-[16px] font-bold text-foreground">Erro ao carregar</h3>
          <p className="mx-auto mb-5 max-w-[400px] text-[14px] text-muted-foreground">{error}</p>
          <Button variant="default" onClick={load}>Tentar Novamente</Button>
        </Card>
      ) : loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <Tabs
          value={tab}
          onValueChange={value => setTab(value as GovernancaTab)}
          className="w-full"
          data-testid="governanca-tabs"
        >
          <TabsList variant="line">
            {TAB_ORDER.map(t => {
              const count = t === 'todos' ? counts.conquistado + counts.em_negociacao + counts.perdido : counts[t];
              return (
                <TabsTrigger key={t} value={t} data-testid={`tab-${t}`}>
                  {TAB_LABEL[t]}
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {count}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="mt-4 max-w-md">
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome, CNPJ, segmento ou cidade..."
              data-testid="governanca-search"
            />
          </div>

          {TAB_ORDER.map(t => {
            const deals = filteredByTab(t);
            return (
              <TabsContent key={t} value={t} className="mt-4">
                {deals.length === 0 ? (
                  <Card className="p-12 text-center">
                    <svg className="mx-auto mb-4 size-12 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 3v18h18" /><rect x="7" y="9" width="3" height="7" /><rect x="13" y="5" width="3" height="11" />
                    </svg>
                    <h3 className="mb-2 text-[16px] font-bold text-foreground">
                      Nenhum negócio {t === 'todos' ? '' : TAB_LABEL[t].toLowerCase()} neste mês
                    </h3>
                    <p className="mx-auto max-w-[420px] text-[14px] text-muted-foreground">
                      {search
                        ? 'Nenhum resultado para a busca atual. Tente outro termo ou limpe a busca.'
                        : t === 'todos'
                          ? 'Monte seus prospectos, crie orçamentos e acompanhe aqui a evolução da captação.'
                          : 'Nenhum negócio com este status no mês selecionado.'}
                    </p>
                  </Card>
                ) : (
                  <div className="flex flex-col gap-3">
                    {deals.map(deal => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        onUnreprove={deal.status === 'perdido' ? handleUnreprove : undefined}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
};