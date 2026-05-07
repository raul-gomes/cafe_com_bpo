import React, { useState } from 'react';
import { apiClient } from '../../api/client';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { CreditCard, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface Payment {
  id: string;
  amount: number;
  description: string;
  status: string;
  payment_method: string;
  due_date: string;
  created_at: string;
}

export const PaymentsPage: React.FC = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    amount: '',
    description: '',
    payment_method: 'credit_card',
    due_date: '',
  });

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await apiClient.get('/payments/');
      setPayments(data);
    } catch (err) {
      console.error('Erro ao carregar pagamentos:', err);
      setError('Não foi possível carregar os pagamentos. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchPayments();
  }, []);

  const handleCreatePayment = async () => {
    if (!form.amount || !form.due_date) {
      alert('Preencha o valor e a data de vencimento.');
      return;
    }
    try {
      setCreating(true);
      const amount = parseFloat(form.amount.replace(/[^\d,]/g, '').replace(',', '.'));
      await apiClient.post('/payments/create', {
        payment: {
          amount,
          description: form.description || 'Pagamento Café com BPO',
          payment_method: form.payment_method,
          due_date: form.due_date,
          success_url: `${window.location.origin}/painel/pagamentos?status=success`,
          error_url: `${window.location.origin}/painel/pagamentos?status=error`,
        },
        customer: {
          name: user?.name || 'Usuário',
          email: user?.email || '',
        },
      });
      setShowForm(false);
      setForm({ amount: '', description: '', payment_method: 'credit_card', due_date: '' });
      fetchPayments();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao criar pagamento.');
    } finally {
      setCreating(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'received':
      case 'confirmed':
        return <CheckCircle size={16} color="var(--ds-success)" />;
      case 'overdue':
        return <AlertCircle size={16} color="var(--ds-error)" />;
      default:
        return <Clock size={16} color="var(--ds-warning)" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'received':
      case 'confirmed':
        return 'Confirmado';
      case 'overdue':
        return 'Vencido';
      case 'refunded':
        return 'Reembolsado';
      default:
        return 'Pendente';
    }
  };

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <>
      <Breadcrumb items={[{ label: 'Painel', to: '/painel' }, { label: 'Pagamentos' }]} />

      <div className="panel-content__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1>Pagamentos</h1>
          <p>Gerencie seus pagamentos via Asaas.</p>
        </div>
        <button className="ds-btn ds-btn-primary" onClick={() => setShowForm(!showForm)} style={{ gap: '8px' }}>
          <CreditCard size={18} /> Novo Pagamento
        </button>
      </div>

      {showForm && (
        <div className="ds-card" style={{ padding: '24px', marginBottom: '24px', animation: 'panelFadeIn 0.3s ease-out' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px' }}>Novo Pagamento</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="ds-input-group">
              <label className="ds-label">Valor (R$) *</label>
              <input className="ds-input" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="R$ 0,00" />
            </div>
            <div className="ds-input-group">
              <label className="ds-label">Data de Vencimento *</label>
              <input className="ds-input" type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
            </div>
          </div>
          <div className="ds-input-group">
            <label className="ds-label">Descrição</label>
            <input className="ds-input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Ex: Mensalidade Plano Premium" />
          </div>
          <div className="ds-input-group">
            <label className="ds-label">Método de Pagamento</label>
            <select className="ds-input" value={form.payment_method} onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))}>
              <option value="credit_card">Cartão de Crédito</option>
              <option value="boleto">Boleto Bancário</option>
              <option value="pix">PIX</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button className="ds-btn" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="ds-btn ds-btn-primary" onClick={handleCreatePayment} disabled={creating}>
              {creating ? 'Criando...' : 'Criar Pagamento'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {error ? (
          <div className="ds-card" style={{ padding: '60px 24px', textAlign: 'center' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ds-error)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', opacity: 0.5 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Erro ao carregar</h3>
            <p style={{ color: 'var(--ds-text-muted)', marginBottom: '20px', maxWidth: '400px', margin: '0 auto 20px' }}>{error}</p>
            <button className="ds-btn ds-btn-primary" onClick={fetchPayments}>Tentar Novamente</button>
          </div>
        ) : loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="ds-card" style={{ padding: '20px' }}>
              <div className="panel-skeleton" style={{ height: '16px', width: '40%', marginBottom: '8px' }} />
              <div className="panel-skeleton" style={{ height: '12px', width: '30%' }} />
            </div>
          ))
        ) : payments.length === 0 ? (
          <div className="panel-empty">
            <CreditCard size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <h3>Nenhum pagamento encontrado</h3>
            <p>Crie um pagamento para começar.</p>
          </div>
        ) : (
          payments.map(payment => (
            <div key={payment.id} className="ds-card" style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  {getStatusIcon(payment.status)}
                  <span style={{ fontSize: '15px', fontWeight: 700 }}>{payment.description || 'Pagamento'}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--ds-text-muted)', display: 'flex', gap: '12px' }}>
                  <span>Vencimento: {new Date(payment.due_date).toLocaleDateString('pt-BR')}</span>
                  <span>•</span>
                  <span style={{ textTransform: 'uppercase' }}>
                    {payment.payment_method === 'credit_card' ? 'Cartão' : payment.payment_method === 'boleto' ? 'Boleto' : 'PIX'}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ds-primary)' }}>
                  {formatPrice(payment.amount)}
                </div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: payment.status === 'confirmed' || payment.status === 'received' ? 'var(--ds-success)' : 'var(--ds-warning)' }}>
                  {getStatusLabel(payment.status)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
};
