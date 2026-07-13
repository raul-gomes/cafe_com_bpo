import React, { useState, useEffect } from 'react';
import { getClients, createClient, updateClient, deleteClient, ClientData } from '../../api/clients';
import { MaskedCNPJ, MaskedPhone } from '../../components/ui/MaskedInput';
import { maskCNPJ, maskPhone } from '../../lib/formatters';
import { useTasks } from '../../api/hooks/useTasks';
import { Link, Unlink, FileText } from 'lucide-react';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { Users, UserPlus, Trash2, Check } from 'lucide-react';
import {
  inviteCollaborator,
  listTeamMembers,
  removeTeamMember,
  TeamMemberResponse,
} from '../../api/team';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { EmailChipInput, type EmailChip } from '../../components/ui/EmailChipInput';
import { useUserLookup } from '../../api/hooks/useUserLookup';

const BPO_SEGMENTS = [
  'BPO Financeiro',
  'BPO Contábil',
  'BPO Fiscal',
  'BPO RH / Departamento Pessoal',
  'Cobrança e Recebimento',
  'Faturamento',
  'Tesouraria',
  'Consultoria Financeira',
  'Gestão de Fluxo de Caixa',
  'Conciliação Bancária',
  'Emissão de NF / Notas Fiscais',
  'Outro',
];

export const EmpresasPage: React.FC = () => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', cnpj: '', phone: '', email: '', description: '', segment: '', color: '#4287f5' });
  const { useTemplatesList, useAssignTemplate, useClientAssignments, useRemoveAssignment } = useTasks();
  const [linkClientId, setLinkClientId] = useState<string | null>(null);
  const [teamClientId, setTeamClientId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberResponse[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmails, setInviteEmails] = useState<EmailChip[]>([]);
  const [inviteTemplateIds, setInviteTemplateIds] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [lookedUpEmails, setLookedUpEmails] = useState<Set<string>>(new Set());
  const [userDataMap, setUserDataMap] = useState<Map<string, { name?: string | null; avatar_url?: string | null }>>(new Map());
  const { data: templates } = useTemplatesList();
  const { data: currentAssignments, refetch: refetchAssignments } = useClientAssignments(linkClientId || '');
  const { data: teamAssignments } = useClientAssignments(teamClientId || '');

  // Derive linked templates (with name) from assignments + templates list
  const linkedTemplates = React.useMemo(() => {
    if (!teamAssignments || !templates) return [];
    const tmplMap = new Map(templates.map(t => [t.id, t]));
    return teamAssignments
      .map(a => tmplMap.get(a.template_id))
      .filter((t): t is NonNullable<typeof t> => !!t);
  }, [teamAssignments, templates]);
  const assignTemplate = useAssignTemplate();
  const removeAssignment = useRemoveAssignment();
  const confirm = useConfirm();
  const userLookup = useUserLookup();

  // When teamClientId changes, reset invite form
  useEffect(() => {
    setShowInvite(false);
    setInviteEmails([]);
    setInviteTemplateIds([]);
    setLookedUpEmails(new Set());
    setUserDataMap(new Map());
  }, [teamClientId]);

  // Auto-lookup emails when chips change
  useEffect(() => {
    const unchecked = inviteEmails
      .map(c => c.email)
      .filter(e => !lookedUpEmails.has(e));
    if (unchecked.length === 0) return;

    userLookup.mutate(unchecked, {
      onSuccess: (data) => {
        setLookedUpEmails(prev => {
          const s = new Set(prev);
          unchecked.forEach(e => s.add(e));
          return s;
        });
        if (data.found.length > 0) {
          setUserDataMap(prev => {
            const m = new Map(prev);
            data.found.forEach(u => m.set(u.email, { name: u.name, avatar_url: u.avatar_url }));
            return m;
          });
        }
      },
    });
  }, [inviteEmails.length]);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getClients();
      setClients(data);
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
      setError('Não foi possível carregar os clientes. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', cnpj: '', phone: '', email: '', description: '', segment: '', color: '#4287f5' });
    setShowForm(false);
    setExpandedCardId(null);
  };

  const handleStartEdit = (client: ClientData) => {
    setExpandedCardId(client.id);
    setFormData({
      name: client.name,
      cnpj: client.cnpj || '',
      phone: client.phone || '',
      email: client.email || '',
      description: client.description || '',
      segment: client.segment || '',
      color: client.color || '#4287f5',
    });
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!formData.name) return;

    const payload = {
      name: formData.name,
      cnpj: formData.cnpj || undefined,
      phone: formData.phone || undefined,
      email: formData.email.trim() || undefined,
      description: formData.description || undefined,
      segment: formData.segment || undefined,
      color: formData.color,
    };

    try {
      if (expandedCardId) {
        await updateClient(expandedCardId, payload);
      } else {
        await createClient(payload);
      }
      resetForm();
      await loadClients();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar cliente.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Excluir cliente permanentemente?',
      message: `Tem certeza que deseja excluir "${name}"? Esta ação é irreversível e **todas as tarefas e orçamentos vinculados** a este cliente também serão permanentemente removidos do sistema.`,
      variant: 'danger',
      confirmLabel: 'Sim, excluir tudo',
    });
    if (!ok) return;
    try {
      setClients(prev => prev.filter(c => c.id !== id));
      await deleteClient(id);
      toast.success(`Cliente "${name}" e todos os dados associados foram excluídos.`);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao excluir cliente.');
      await loadClients();
    }
  };

  /* ── Team ── */
  const loadTeam = async (clientId: string) => {
    setLoadingTeam(true);
    try {
      const { data } = await listTeamMembers(clientId);
      setTeamMembers(data.members);
    } catch {
      toast.error('Erro ao carregar equipe');
    } finally {
      setLoadingTeam(false);
    }
  };

  const handleInvite = async () => {
    if (inviteEmails.length === 0 || inviteTemplateIds.length === 0 || !teamClientId) return;
    setInviting(true);
    try {
      const { data } = await inviteCollaborator(teamClientId, {
        emails: inviteEmails.map(c => c.email),
        template_ids: inviteTemplateIds,
      });
      if (data.total_sent > 0) {
        toast.success(`${data.total_sent} convite(s) enviado(s) com sucesso!`);
      }
      if (data.total_errors > 0) {
        data.results.filter(r => r.status === 'error').forEach(r => {
          toast.error(`${r.email}: ${r.error}`);
        });
      }
      setShowInvite(false);
      setInviteEmails([]);
      setInviteTemplateIds([]);
      loadTeam(teamClientId);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Erro ao enviar convites');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string, name: string) => {
    if (!teamClientId) return;
    const ok = await confirm({
      title: 'Remover membro',
      message: `Tem certeza que deseja remover "${name}" da equipe?`,
      variant: 'danger',
      confirmLabel: 'Remover',
    });
    if (!ok) return;
    try {
      await removeTeamMember(teamClientId, userId);
      toast.success('Membro removido');
      loadTeam(teamClientId);
    } catch {
      toast.error('Erro ao remover membro');
    }
  };

  /* ── Shared form fields ── */
  const renderFormFields = () => (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-foreground">Nome do Cliente *</label>
        <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Razão social ou nome fantasia" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-foreground">CNPJ</label>
        <MaskedCNPJ value={formData.cnpj} onChange={(raw) => setFormData({ ...formData, cnpj: raw })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-foreground">Telefone</label>
        <MaskedPhone value={formData.phone} onChange={(raw) => setFormData({ ...formData, phone: raw })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-foreground">E-mail de Contato</label>
        <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="contato@empresa.com" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-foreground">Segmento</label>
        <select
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-[13px] text-foreground outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"
          value={formData.segment}
          onChange={e => setFormData({ ...formData, segment: e.target.value })}
        >
          <option value="">Selecione...</option>
          {BPO_SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-foreground">Cor</label>
        <input type="color" value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })}
          className="h-[42px] w-full cursor-pointer rounded-lg border border-input bg-transparent p-1" />
      </div>
      <div className="flex flex-col gap-1.5" style={{ gridColumn: '1 / -1' }}>
        <label className="text-[13px] font-medium text-foreground">Descrição do Cliente</label>
        <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
          placeholder="Descreva o cliente, seus serviços principais, etc." rows={3} className="min-h-[80px] resize-y" />
      </div>
    </div>
  );

  /* ── Render ── */
  return (
    <div className="animate-[panelFadeIn_0.4s_ease-out]">
      <Breadcrumb items={[{ label: 'Painel', to: '/painel' }, { label: 'Meus Clientes' }]} />

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[32px] font-extrabold tracking-tight text-foreground">Meus Clientes</h1>
          <p className="text-[14px] text-muted-foreground">Gerencie os clientes da sua carteira.</p>
        </div>
        <Button variant="default" onClick={() => { resetForm(); setExpandedCardId(null); setShowForm(true); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Novo Cliente
        </Button>
      </div>

      {/* Create form (top, not editing) */}
      {showForm && !expandedCardId && (
        <Card className="mb-6 p-6">
          <h3 className="mb-4 text-[16px] font-semibold text-foreground">Novo Cliente</h3>
          {renderFormFields()}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={resetForm}>Cancelar</Button>
            <Button variant="default" onClick={handleSubmit} disabled={!formData.name}>Criar Cliente</Button>
          </div>
        </Card>
      )}

      {/* Error state */}
      {error ? (
        <Card className="p-12 text-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--destructive))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 opacity-50">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3 className="mb-2 text-[16px] font-bold text-foreground">Erro ao carregar</h3>
          <p className="mx-auto mb-5 max-w-[400px] text-[14px] text-muted-foreground">{error}</p>
          <Button variant="default" onClick={loadClients}>Tentar Novamente</Button>
        </Card>
      ) : loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <Card className="p-12 text-center">
          <svg className="mx-auto mb-4 size-12 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
          </svg>
          <h3 className="mb-2 text-[16px] font-bold text-foreground">Nenhum cliente cadastrado</h3>
          <p className="mb-5 text-[14px] text-muted-foreground">Comece adicionando um cliente à sua carteira.</p>
          <Button variant="default" onClick={() => { resetForm(); setShowForm(true); }}>Novo Cliente</Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {clients.map(c => {
            const isExpanded = expandedCardId === c.id;
            return (
              <Card
                key={c.id}
                className={cn('cursor-pointer p-0 transition-colors', isExpanded && 'cursor-default')}
                onClick={isExpanded ? undefined : () => handleStartEdit(c)}
              >
                {isExpanded ? (
                  /* Inline edit form */
                  <div onClick={e => e.stopPropagation()} className="p-4">
                    <h3 className="mb-4 text-[16px] font-semibold text-foreground">Editar Cliente</h3>
                    {renderFormFields()}
                    <div className="mt-4 flex justify-end gap-2">
                      <Button variant="ghost" onClick={resetForm}>Cancelar</Button>
                      <Button variant="default" onClick={handleSubmit} disabled={!formData.name}>Salvar Alterações</Button>
                    </div>
                  </div>
                ) : (
                  /* Card info view */
                  <div className="flex items-center justify-between p-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="size-3 shrink-0 rounded-full" style={{ backgroundColor: c.color || '#4287f5' }} />
                        <div>
                          <span className="text-[15px] font-bold text-foreground">{c.name}</span>
                          <div className="mt-1 flex flex-wrap gap-2 text-[12px] text-muted-foreground">
                            {c.segment && (
                              <span className="rounded-sm bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground">{c.segment}</span>
                            )}
                            {c.cnpj && <span>{maskCNPJ(c.cnpj)}</span>}
                            {c.phone && <><span className="opacity-30">|</span><span>{maskPhone(c.phone)}</span></>}
                            {c.email && <><span className="opacity-30">|</span><span className="normal-case">{c.email}</span></>}
                          </div>
                          {c.description && (
                            <p className="mt-1 max-w-[500px] truncate text-[12px] text-muted-foreground">{c.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => { setLinkClientId(c.id); }} title="Vincular Rotinas">
                        <Link size={14} /> Rotinas
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setTeamClientId(c.id); loadTeam(c.id); }} title="Equipe">
                        <Users size={14} /> Equipe
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleStartEdit(c)} title="Editar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id, c.name)} title="Excluir" className="text-destructive hover:text-destructive">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog: Vincular Rotinas */}
      <Dialog open={!!linkClientId} onOpenChange={(open) => { if (!open) setLinkClientId(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Link size={20} className="text-primary" />
              <DialogTitle>Vincular Rotinas</DialogTitle>
            </div>
            <DialogDescription>
              Selecione as rotinas que este cliente contratou. As tarefas serão geradas automaticamente com base nas atividades de cada rotina.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-6">
            {!templates || templates.length === 0 ? (
              <div className="py-5 text-center text-[13px] text-muted-foreground">
                Nenhuma rotina disponível. Crie rotinas primeiro em <strong>Rotinas</strong>.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {templates.map(tmpl => {
                  const isLinked = currentAssignments?.some(a => a.template_id === tmpl.id);
                  return (
                    <div
                      key={tmpl.id}
                      className={cn(
                        'flex items-center gap-3 rounded-md border p-3.5',
                        isLinked ? 'border-green-500/20 bg-green-500/5' : 'border-border bg-muted'
                      )}
                    >
                      <FileText size={20} className={isLinked ? 'text-green-500' : 'text-muted-foreground'} />
                      <div className="flex-1">
                        <div className="text-[14px] font-semibold text-foreground">{tmpl.name}</div>
                        <div className="text-[12px] text-muted-foreground">
                          {tmpl.activity_count} atividades • {tmpl.recurrence === 'once' ? 'Uma só vez' : tmpl.recurrence === 'daily' ? 'Diário' : tmpl.recurrence === 'weekly' ? 'Semanal' : tmpl.recurrence === 'monthly' ? 'Mensal' : tmpl.recurrence === 'yearly' ? 'Anual' : tmpl.recurrence}
                        </div>
                      </div>
                      {isLinked ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            const assignment = currentAssignments?.find(a => a.template_id === tmpl.id);
                            if (assignment) {
                              await removeAssignment.mutateAsync(assignment.id);
                              refetchAssignments();
                            }
                          }}
                          className="text-destructive"
                        >
                          <Unlink size={14} /> Desvincular
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={async () => {
                            await assignTemplate.mutateAsync({ client_id: linkClientId!, template_id: tmpl.id });
                            refetchAssignments();
                          }}
                          disabled={assignTemplate.isPending}
                        >
                          <Link size={14} /> Vincular
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 rounded-sm bg-blue-500/5 p-3 text-[12px] text-muted-foreground">
              💡 Ao vincular uma rotina, as tarefas são geradas automaticamente para o período atual.
              Você pode gerenciar as rotinas em <strong>Rotinas</strong> no menu lateral.
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Equipe */}
      <Dialog open={!!teamClientId} onOpenChange={(open) => { if (!open) { setTeamClientId(null); setShowInvite(false); } }}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Users size={20} className="text-primary" />
              <DialogTitle>Equipe do Cliente</DialogTitle>
            </div>
            <DialogDescription>
              Gerencie os colaboradores que têm acesso a este cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-6">
            {/* Invite button */}
            {!showInvite && (
              <Button
                variant="outline"
                size="sm"
                className="mb-4 w-full"
                onClick={() => setShowInvite(true)}
              >
                <UserPlus size={15} /> Convidar Colaborador
              </Button>
            )}

            {/* Invite form */}
            {showInvite && (
              <div className="mb-4 rounded-lg border border-primary/20 bg-muted p-4 space-y-3">
                <h4 className="text-sm font-semibold">Convidar Colaborador</h4>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Emails dos colaboradores <span className="text-muted-foreground/60">(digite e pressione vírgula ou Enter)</span>
                  </label>
                  <EmailChipInput
                    value={inviteEmails}
                    onChange={setInviteEmails}
                    placeholder="email@exemplo.com"
                    userData={userDataMap}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Rotinas com acesso</label>
                  {linkedTemplates.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground py-2">
                      Nenhuma rotina vinculada a este cliente. Vincule rotinas primeiro em <strong>Rotinas</strong>.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
                      {linkedTemplates.map(tmpl => (
                        <label
                          key={tmpl.id}
                          className={cn(
                            'flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors',
                            inviteTemplateIds.includes(tmpl.id)
                              ? 'border-primary/30 bg-primary/5'
                              : 'border-border'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={inviteTemplateIds.includes(tmpl.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setInviteTemplateIds(prev => [...prev, tmpl.id]);
                              } else {
                                setInviteTemplateIds(prev => prev.filter(id => id !== tmpl.id));
                              }
                            }}
                            className="size-4"
                          />
                          <span>{tmpl.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {inviteEmails.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Check size={12} className="text-green-500" />
                    {inviteEmails.length} destinatário(s) adicionado(s)
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => { setShowInvite(false); setInviteEmails([]); setInviteTemplateIds([]); }}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleInvite}
                    disabled={inviteEmails.length === 0 || inviteTemplateIds.length === 0 || inviting}
                  >
                    {inviting ? 'Enviando...' : `Enviar Convite${inviteEmails.length > 1 ? `s (${inviteEmails.length})` : ''}`}
                  </Button>
                </div>
              </div>
            )}

            {/* Team members list */}
            {loadingTeam ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : teamMembers.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Nenhum colaborador na equipe ainda.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {teamMembers.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center gap-3 rounded-md border border-border p-3"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {(member.name || member.email)[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{member.name || 'Sem nome'}</div>
                      <div className="text-xs text-muted-foreground">{member.email}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {member.routines.map(r => (
                          <span key={r.template_id} className="rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                            {r.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-destructive shrink-0"
                      onClick={() => handleRemoveMember(member.user_id, member.name || member.email)}
                      title="Remover"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
