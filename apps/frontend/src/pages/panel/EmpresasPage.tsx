import React, { useState, useEffect } from 'react';
import { getClients, createClient, updateClient, deleteClient, ClientData } from '../../api/clients';
import { MaskedCNPJ, MaskedPhone } from '../../components/ui/MaskedInput';
import { maskCNPJ, maskPhone } from '../../lib/formatters';
import { useTasks } from '../../api/hooks/useTasks';
import { X, Link, Unlink, FileText } from 'lucide-react';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';

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
  const { data: templates } = useTemplatesList();
  const { data: currentAssignments, refetch: refetchAssignments } = useClientAssignments(linkClientId || '');
  const assignTemplate = useAssignTemplate();
  const removeAssignment = useRemoveAssignment();
  const confirm = useConfirm();
  const toast = useToast();

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
      title: 'Excluir cliente',
      message: `Deseja excluir o cliente "${name}"?`,
      variant: 'danger',
      confirmLabel: 'Excluir',
    });
    if (!ok) return;
    try {
      setClients(prev => prev.filter(c => c.id !== id));
      await deleteClient(id);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao excluir cliente.');
      await loadClients();
    }
  };

  return (
    <div className="panel-content">
      <div className="panel-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '12px', fontWeight: 600 }}>
        <span style={{ color: 'var(--ds-text-muted)', cursor: 'pointer', textDecoration: 'none' }} onClick={() => window.location.href = '/painel'}>Painel</span>
        <span style={{ color: 'var(--ds-text-subtle)' }}>/</span>
        <span style={{ color: 'var(--ds-primary)' }}>Meus Clientes</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1>Meus Clientes</h1>
          <p style={{ color: 'var(--ds-text-muted)', fontSize: '14px' }}>Gerencie os clientes da sua carteira.</p>
        </div>
        <button className="ds-btn ds-btn-primary" onClick={() => { resetForm(); setExpandedCardId(null); setShowForm(true); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Novo Cliente
        </button>
      </div>

      {showForm && !expandedCardId && (
        <div style={{ backgroundColor: 'var(--ds-surface)', padding: '24px', borderRadius: '12px', border: '1px solid var(--ds-border)', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Novo Cliente</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div className="ds-input-group">
              <label className="ds-label">Nome do Cliente *</label>
              <input type="text" className="ds-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Razão social ou nome fantasia" />
            </div>
            <div className="ds-input-group">
              <label className="ds-label">CNPJ</label>
              <MaskedCNPJ value={formData.cnpj} onChange={(raw) => setFormData({...formData, cnpj: raw})} className="ds-input" />
            </div>
            <div className="ds-input-group">
              <label className="ds-label">Telefone</label>
              <MaskedPhone value={formData.phone} onChange={(raw) => setFormData({...formData, phone: raw})} className="ds-input" />
            </div>
            <div className="ds-input-group">
              <label className="ds-label">E-mail de Contato</label>
              <input type="email" className="ds-input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="contato@empresa.com" />
            </div>
            <div className="ds-input-group">
              <label className="ds-label">Segmento</label>
              <select className="ds-input" value={formData.segment} onChange={e => setFormData({...formData, segment: e.target.value})}>
                <option value="">Selecione...</option>
                {BPO_SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="ds-input-group">
              <label className="ds-label">Cor</label>
              <input type="color" className="ds-input" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} style={{ height: '42px', padding: '4px', cursor: 'pointer' }} />
            </div>
            <div className="ds-input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="ds-label">Descrição do Cliente</label>
              <textarea className="ds-input" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Descreva o cliente, seus serviços principais, etc." rows={3} style={{ resize: 'vertical', minHeight: '80px' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
            <button className="ds-btn ds-btn-ghost" onClick={resetForm}>Cancelar</button>
            <button className="ds-btn ds-btn-primary" onClick={handleSubmit} disabled={!formData.name}>Criar Cliente</button>
          </div>
        </div>
      )}

      {error ? (
        <div className="panel-card" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ds-error)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', opacity: 0.5 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Erro ao carregar</h3>
          <p style={{ color: 'var(--ds-text-muted)', marginBottom: '20px', maxWidth: '400px', margin: '0 auto 20px' }}>{error}</p>
          <button className="ds-btn ds-btn-primary" onClick={loadClients}>Tentar Novamente</button>
        </div>
      ) : loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="panel-skeleton" style={{ height: '80px', borderRadius: '8px' }} />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="panel-empty">
          <svg className="panel-empty__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
          </svg>
          <h3>Nenhum cliente cadastrado</h3>
          <p>Comece adicionando um cliente à sua carteira.</p>
          <button className="ds-btn ds-btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>Novo Cliente</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {clients.map(c => {
            const isExpanded = expandedCardId === c.id;
            return (
              <div key={c.id} className="orcamento-card" style={{ cursor: isExpanded ? 'default' : 'pointer' }} onClick={isExpanded ? undefined : () => handleStartEdit(c)}>
                {isExpanded ? (
                  /* --- Inline edit form inside the card --- */
                  <div onClick={e => e.stopPropagation()} style={{ padding: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Editar Cliente</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                      <div className="ds-input-group">
                        <label className="ds-label">Nome do Cliente *</label>
                        <input type="text" className="ds-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Razão social ou nome fantasia" />
                      </div>
                      <div className="ds-input-group">
                        <label className="ds-label">CNPJ</label>
                        <MaskedCNPJ value={formData.cnpj} onChange={(raw) => setFormData({...formData, cnpj: raw})} className="ds-input" />
                      </div>
                      <div className="ds-input-group">
                        <label className="ds-label">Telefone</label>
                        <MaskedPhone value={formData.phone} onChange={(raw) => setFormData({...formData, phone: raw})} className="ds-input" />
                      </div>
                      <div className="ds-input-group">
                        <label className="ds-label">E-mail de Contato</label>
                        <input type="email" className="ds-input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="contato@empresa.com" />
                      </div>
                      <div className="ds-input-group">
                        <label className="ds-label">Segmento</label>
                        <select className="ds-input" value={formData.segment} onChange={e => setFormData({...formData, segment: e.target.value})}>
                          <option value="">Selecione...</option>
                          {BPO_SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="ds-input-group">
                        <label className="ds-label">Cor</label>
                        <input type="color" className="ds-input" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} style={{ height: '42px', padding: '4px', cursor: 'pointer' }} />
                      </div>
                      <div className="ds-input-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="ds-label">Descrição do Cliente</label>
                        <textarea className="ds-input" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Descreva o cliente, seus serviços principais, etc." rows={3} style={{ resize: 'vertical', minHeight: '80px' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
                      <button className="ds-btn ds-btn-ghost" onClick={resetForm}>Cancelar</button>
                      <button className="ds-btn ds-btn-primary" onClick={handleSubmit} disabled={!formData.name}>Salvar Alterações</button>
                    </div>
                  </div>
                ) : (
                  /* --- Card info view --- */
                  <>
                    <div className="orcamento-card__info" style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: c.color || '#4287f5', flexShrink: 0 }} />
                        <div>
                          <span className="orcamento-card__client">{c.name}</span>
                          <div className="orcamento-card__meta" style={{ marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {c.segment && <span style={{ backgroundColor: 'var(--ds-primary)', color: 'var(--ds-primary-text)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>{c.segment}</span>}
                            {c.cnpj && <span>{maskCNPJ(c.cnpj)}</span>}
                            {c.phone && <><span className="orcamento-card__meta-dot" /><span>{maskPhone(c.phone)}</span></>}
                            {c.email && <><span className="orcamento-card__meta-dot" /><span style={{ textTransform: 'none' }}>{c.email}</span></>}
                          </div>
                          {c.description && (
                            <p style={{ fontSize: '12px', color: 'var(--ds-text-muted)', marginTop: '4px', maxWidth: '500px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {c.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="orcamento-card__actions" onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button className="ds-btn ds-btn-ghost ds-btn-sm" onClick={() => setLinkClientId(c.id)} title="Vincular Rotinas" style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px' }}>
                        <Link size={14} /> Rotinas
                      </button>
                      <button className="ds-btn ds-btn-ghost ds-btn-sm" onClick={() => handleStartEdit(c)} title="Editar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button className="orcamento-card__action-btn orcamento-card__action-btn--delete" onClick={() => handleDelete(c.id, c.name)} title="Excluir">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Vincular Templates */}
      {linkClientId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setLinkClientId(null)}>
          <div className="ds-card" style={{
            width: '500px', maxHeight: '80vh', overflow: 'auto',
            background: 'var(--ds-surface)', border: '1px solid var(--ds-border)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--ds-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Link size={20} color="var(--ds-primary)" />
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Vincular Rotinas</h2>
              </div>
              <button onClick={() => setLinkClientId(null)} style={{ background: 'none', border: 'none', color: 'var(--ds-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              <p style={{ fontSize: '13px', color: 'var(--ds-text-muted)', marginBottom: '16px' }}>
                Selecione as rotinas que este cliente contratou. 
                As tarefas serão geradas automaticamente com base nas atividades de cada rotina.
              </p>

              {!templates || templates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--ds-text-muted)', fontSize: '13px' }}>
                  Nenhuma rotina disponível. Crie rotinas primeiro em <strong>Rotinas</strong>.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {templates.map(tmpl => {
                    const isLinked = currentAssignments?.some(a => a.template_id === tmpl.id);
                    return (
                      <div key={tmpl.id} style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '14px 16px', borderRadius: 'var(--radius-md)',
                        background: isLinked ? 'rgba(34,197,94,0.05)' : 'var(--ds-surface-1)',
                        border: `1px solid ${isLinked ? 'rgba(34,197,94,0.2)' : 'var(--ds-border)'}`,
                      }}>
                        <FileText size={20} style={{ color: isLinked ? '#22c55e' : 'var(--ds-text-muted)' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '14px' }}>{tmpl.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--ds-text-muted)' }}>
                            {tmpl.activity_count} atividades • {tmpl.recurrence === 'once' ? 'Uma só vez' : tmpl.recurrence === 'daily' ? 'Diário' : tmpl.recurrence === 'weekly' ? 'Semanal' : tmpl.recurrence === 'monthly' ? 'Mensal' : tmpl.recurrence === 'yearly' ? 'Anual' : tmpl.recurrence}
                          </div>
                        </div>
                        {isLinked ? (
                          <button
                            onClick={async () => {
                              const assignment = currentAssignments?.find(a => a.template_id === tmpl.id);
                              if (assignment) {
                                await removeAssignment.mutateAsync(assignment.id);
                                refetchAssignments();
                              }
                            }}
                            className="ds-btn ds-btn-ghost ds-btn-sm"
                            style={{ color: 'var(--ds-error)', display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px' }}
                          >
                            <Unlink size={14} /> Desvincular
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              await assignTemplate.mutateAsync({
                                client_id: linkClientId,
                                template_id: tmpl.id,
                              });
                              refetchAssignments();
                            }}
                            className="ds-btn ds-btn-primary ds-btn-sm"
                            style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px' }}
                            disabled={assignTemplate.isPending}
                          >
                            <Link size={14} /> Vincular
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ marginTop: '16px', padding: '12px', borderRadius: 'var(--radius-sm)', background: 'rgba(59,130,246,0.05)', fontSize: '12px', color: 'var(--ds-text-muted)' }}>
                💡 Ao vincular uma rotina, as tarefas são geradas automaticamente para o período atual.
                Você pode gerenciar as rotinas em <strong>Rotinas</strong> no menu lateral.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
