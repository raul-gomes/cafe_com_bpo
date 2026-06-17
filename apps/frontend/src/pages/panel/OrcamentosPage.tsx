import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { Input } from '../../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';
import { MessageSquare } from 'lucide-react';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

interface Proposal {
  id: string;
  client_name: string;
  input_payload: any;
  result_payload: any;
  created_at: string;
}

export const OrcamentosPage: React.FC = () => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('+55');
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const navigate = useNavigate();
  const confirm = useConfirm();

  const fetchProposals = async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await apiClient.get<Proposal[]>('/proposals/');
      setProposals(resp.data);
    } catch (err) {
      console.error('Erro ao carregar propostas:', err);
      setError('Não foi possível carregar os orçamentos. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const handleDeleteClick = async (e: React.MouseEvent, proposal: Proposal) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Excluir orçamento',
      message: `Tem certeza que deseja excluir o orçamento de "${proposal.client_name}"?`,
      variant: 'danger',
      confirmLabel: 'Excluir',
    });
    if (!ok) return;
    try {
      await apiClient.delete(`/proposals/${proposal.id}`);
      setProposals(prev => prev.filter(p => p.id !== proposal.id));
    } catch {
      toast.error('Erro ao excluir orçamento.');
    }
  };

  const handleWhatsAppClick = (e: React.MouseEvent, proposal: Proposal) => {
    e.stopPropagation();
    setSelectedProposal(proposal);
    setWhatsappPhone('+55');
    setWhatsappModalOpen(true);
  };

  const handleSendWhatsApp = () => {
    if (!selectedProposal) return;
    const cleanPhone = whatsappPhone.replace(/\D/g, '');
    const value = formatPrice(selectedProposal.result_payload?.final_price || 0);
    const message = `Olá ${selectedProposal.client_name}, seguem os detalhes do orçamento: Valor: ${value}. Acesse o painel para mais informações.`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    setWhatsappModalOpen(false);
  };

  const formatPrice = (value: number) => {
    const safe = Number.isNaN(value) || value === null || value === undefined ? 0 : value;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safe);
  };

  const safeNumber = (value: number) => {
    const n = Number(value);
    return Number.isNaN(n) ? 0 : n;
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const totalValue = proposals.reduce(
    (sum, p) => sum + safeNumber(p.result_payload?.final_price),
    0
  );

  // Calendar logic
  const now = new Date();
  const monthName = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const prevMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const today = now.getDate();

  const calendarDays: { day: number; isOther: boolean; isToday: boolean }[] = [];
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    calendarDays.push({ day: prevMonthDays - i, isOther: true, isToday: false });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({ day: i, isOther: false, isToday: i === today });
  }
  const remaining = 42 - calendarDays.length;
  for (let i = 1; i <= remaining; i++) {
    calendarDays.push({ day: i, isOther: true, isToday: false });
  }

  return (
    <div className="animate-[panelFadeIn_0.4s_ease-out]">
      <Breadcrumb items={[{ label: 'Painel', to: '/painel' }, { label: 'Orçamentos' }]} />

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-[32px] font-extrabold tracking-tight text-foreground">Orçamentos</h1>
          <p className="text-[14px] text-muted-foreground">Gerencie e visualize todos os seus orçamentos salvos.</p>
        </div>
        <Button variant="default" onClick={() => navigate('/painel/novo-orcamento')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nova Precificação
        </Button>
      </div>

      {/* Stats */}
      {error ? (
        <Card className="p-12 text-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--destructive))" strokeWidth="1.5" className="mx-auto mb-4 opacity-50">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3 className="mb-2 text-[16px] font-bold text-foreground">Erro ao carregar</h3>
          <p className="mx-auto mb-5 max-w-[400px] text-[14px] text-muted-foreground">{error}</p>
          <Button variant="default" onClick={fetchProposals}>Tentar Novamente</Button>
        </Card>
      ) : (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <Card className="items-start p-5">
            <span className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total de Orçamentos</span>
            <span className="text-[24px] font-extrabold text-foreground">{loading ? '—' : proposals.length}</span>
          </Card>
          <Card className="items-start p-5">
            <span className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Valor Total</span>
            <span className="text-[24px] font-extrabold text-primary">{loading ? '—' : formatPrice(totalValue)}</span>
          </Card>
          <Card className="items-start p-5">
            <span className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Este Mês</span>
            <span className="text-[24px] font-extrabold text-foreground">
              {loading ? '—' : proposals.filter(p => {
                const d = new Date(p.created_at);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
              }).length}
            </span>
          </Card>
        </div>
      )}

      {/* Grid: List + Info Sidebar */}
      {!error && (
        <div className="grid grid-cols-[1fr_300px] gap-6">
          {/* Left - List */}
          <div className="flex flex-col gap-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-4 w-[180px]" />
                      <Skeleton className="h-3 w-[120px]" />
                    </div>
                    <Skeleton className="h-5 w-20" />
                  </div>
                </Card>
              ))
            ) : proposals.length === 0 ? (
              <Card className="p-12 text-center">
                <svg className="mx-auto mb-4 size-12 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <h3 className="mb-2 text-[16px] font-bold text-foreground">Nenhum orçamento encontrado</h3>
                <p className="mb-5 text-[14px] text-muted-foreground">Comece criando uma simulação na calculadora de preços.</p>
                <Button variant="default" onClick={() => navigate('/painel/novo-orcamento')}>Nova Precificação</Button>
              </Card>
            ) : (
              proposals.map(p => (
                <Card
                  key={p.id}
                  className="cursor-pointer p-4 transition-colors hover:bg-muted/50"
                  onClick={() => navigate(`/painel/orcamento/${p.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter') navigate(`/painel/orcamento/${p.id}`); }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-[15px] font-bold text-foreground">{p.client_name}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted-foreground">
                        <span>{formatDate(p.created_at)}</span>
                        <span className="opacity-30">|</span>
                        <span>Proposta salva</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-[18px] font-extrabold text-foreground">
                        {formatPrice(safeNumber(p.result_payload?.final_price))}
                      </div>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); navigate(`/painel/editar-orcamento/${p.id}`); }}
                          title="Editar"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleWhatsAppClick(e, p)}
                          title="Enviar via WhatsApp"
                        >
                          <MessageSquare size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={e => handleDeleteClick(e, p)}
                          title="Excluir"
                          aria-label="Excluir orçamento"
                          className="text-destructive hover:text-destructive"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Right - Info Panel */}
          <div className="flex flex-col gap-6">
            {/* Calendar */}
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[13px] font-semibold capitalize text-foreground">{monthName}</span>
                <div className="flex gap-1">
                  <button className="flex size-6 cursor-pointer items-center justify-center rounded text-[14px] text-muted-foreground hover:bg-muted" aria-label="Mês anterior">‹</button>
                  <button className="flex size-6 cursor-pointer items-center justify-center rounded text-[14px] text-muted-foreground hover:bg-muted" aria-label="Próximo mês">›</button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-px text-center text-[11px]">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                  <div key={d} className="py-1 font-bold text-muted-foreground">{d}</div>
                ))}
                {calendarDays.map((d, i) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded py-1 text-[13px]',
                      d.isToday && 'bg-primary font-bold text-primary-foreground',
                      d.isOther && 'text-muted-foreground/40',
                      !d.isToday && !d.isOther && 'text-foreground'
                    )}
                  >
                    {d.day}
                  </div>
                ))}
              </div>
            </Card>

            {/* Summary */}
            <Card className="divide-y divide-border">
              <div className="flex items-center gap-2 px-5 py-3">
                <svg className="size-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span className="text-[13px] font-semibold text-foreground">Resumo</span>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-[13px] text-muted-foreground">Orçamentos</span>
                <span className="text-[13px] font-bold text-foreground">{proposals.length}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-[13px] text-muted-foreground">Valor Médio</span>
                <span className="text-[13px] font-bold text-primary">
                  {proposals.length > 0 ? formatPrice(totalValue / proposals.length) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-[13px] text-muted-foreground">Último Criado</span>
                <span className="text-[13px] font-bold text-foreground">
                  {proposals.length > 0 ? formatDate(proposals[0].created_at) : '—'}
                </span>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* WhatsApp Dialog */}
      <Dialog open={whatsappModalOpen} onOpenChange={(open) => { if (!open) setWhatsappModalOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar via WhatsApp</DialogTitle>
            <DialogDescription>
              Digite o número do WhatsApp para {selectedProposal?.client_name}:
            </DialogDescription>
          </DialogHeader>
          <div className="px-6">
            <Input
              type="tel"
              value={whatsappPhone}
              onChange={e => setWhatsappPhone(e.target.value)}
              placeholder="+55 (11) 99999-9999"
              className="w-full"
            />
          </div>
          <DialogFooter showCloseButton={false}>
            <Button variant="ghost" onClick={() => setWhatsappModalOpen(false)}>Cancelar</Button>
            <Button variant="default" onClick={handleSendWhatsApp} disabled={whatsappPhone.replace(/\D/g, '').length < 10}>
              <MessageSquare size={16} /> Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
