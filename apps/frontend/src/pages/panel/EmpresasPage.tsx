import React, { useState, useEffect } from 'react';
import { getClients, createClient, updateClient, deleteClient, ClientData } from '../../api/clients';
import { MaskedCNPJ, MaskedPhone } from '../../components/ui/MaskedInput';
import { maskCNPJ, maskPhone } from '../../lib/formatters';

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', cnpj: '', phone: '', email: '', description: '', segment: '', color: '#4287f5' });

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
      console.error('Erro ao carregar empresas:', err);
      setError('Não foi possível carregar as empresas. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', cnpj: '', phone: '', email: '', description: '', segment: '', color: '#4287f5' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleStartEdit = (client: ClientData) => {
    setEditingId(client.id);
    setFormData({
      name: client.name,
      cnpj: client.cnpj || '',
      phone: client.phone || '',
      email: client.email || '',
      description: client.description || '',
      segment: client.segment || '',
      color: client.color || '#4287f5',
    });
    setShowForm(true);
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
      if (editingId) {
        await updateClient(editingId, payload);
      } else {
        await createClient(payload);
      }
      resetForm();
      await loadClients();
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar empresa.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Deseja excluir a empresa "${name}"?`)) return;
    try {
      setClients(prev => prev.filter(c => c.id !== id));
      await deleteClient(id);
    } catch (e) {
      console.error(e);
      alert('Erro ao excluir empresa.');
      await loadClients();
    }
  };

  return (
    <div className="panel-content">
      <div className="panel-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '12px', fontWeight: 600 }}>
        <span style={{ color: 'var(--ds-text-muted)', cursor: 'pointer', textDecoration: 'none' }} onClick={() => window.location.href = '/painel'}>Painel</span>
        <span style={{ color: 'var(--ds-text-subtle)' }}>/</span>
        <span style={{ color: 'var(--ds-primary)' }}>Minhas Empresas</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1>Minhas Empresas</h1>
          <p style={{ color: 'var(--ds-text-muted)', fontSize: '14px' }}>Gerencie as empresas e clientes da sua carteira.</p>
        </div>
        <button className="ds-btn ds-btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nova Empresa
        </button>
      </div>

      {showForm && (
        <div style={{ backgroundColor: 'var(--ds-surface)', padding: '24px', borderRadius: '12px', border: '1px solid var(--ds-border)', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>{editingId ? 'Editar Empresa' : 'Nova Empresa'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div className="ds-input-group">
              <label className="ds-label">Nome da Empresa *</label>
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
              <label className="ds-label">Descrição da Empresa</label>
              <textarea className="ds-input" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Descreva a empresa, seus serviços principais, etc." rows={3} style={{ resize: 'vertical', minHeight: '80px' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
            <button className="ds-btn ds-btn-ghost" onClick={resetForm}>Cancelar</button>
            <button className="ds-btn ds-btn-primary" onClick={handleSubmit} disabled={!formData.name}>{editingId ? 'Salvar Alterações' : 'Criar Empresa'}</button>
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
          <h3>Nenhuma empresa cadastrada</h3>
          <p>Comece adicionando uma empresa à sua carteira.</p>
          <button className="ds-btn ds-btn-primary" onClick={() => setShowForm(true)}>Nova Empresa</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {clients.map(c => (
            <div key={c.id} className="orcamento-card" style={{ cursor: 'pointer' }} onClick={() => handleStartEdit(c)}>
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
              <div className="orcamento-card__actions" onClick={e => e.stopPropagation()}>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
