import React, { useState } from 'react';
import { apiClient } from '../../api/client';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import { CreditCard, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';

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
      setError(
        'Não foi possível carregar os pagamentos. Verifique sua conexão e tente novamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchPayments();
  }, []);

  const handleCreatePayment = async () => {
    if (!form.amount || !form.due_date) {
      toast.error('Preencha o valor e a data de vencimento.');
      return;
    }
    try {
      setCreating(true);
      const amount = parseFloat(
        form.amount.replace(/[^\d,]/g, '').replace(',', '.')
      );
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
      setForm({
        amount: '',
        description: '',
        payment_method: 'credit_card',
        due_date: '',
      });
      fetchPayments();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Erro ao criar pagamento.');
    } finally {
      setCreating(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'received':
      case 'confirmed':
        return <CheckCircle size={16} className="text-emerald-500" />;
      case 'overdue':
        return <AlertCircle size={16} className="text-destructive" />;
      default:
        return <Clock size={16} className="text-amber-500" />;
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
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);

  return (
    <div className="animate-[panelFadeIn_0.4s_ease-out]">
      <Breadcrumb
        items={[
          { label: 'Painel', to: '/painel' },
          { label: 'Pagamentos' },
        ]}
      />

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-[32px] font-extrabold tracking-tight text-foreground">
            Pagamentos
          </h1>
          <p className="text-[14px] text-muted-foreground">
            Gerencie seus pagamentos via Asaas.
          </p>
        </div>
        <Button variant="default" onClick={() => setShowForm(!showForm)}>
          <CreditCard size={18} /> Novo Pagamento
        </Button>
      </div>

      {/* Create Payment Form */}
      {showForm && (
        <Card className="mb-6 animate-[panelFadeIn_0.3s_ease-out] p-6">
          <h3 className="mb-5 text-[16px] font-bold text-foreground">
            Novo Pagamento
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-foreground/80">
                Valor (R$) *
              </label>
              <Input
                value={form.amount}
                onChange={e =>
                  setForm(p => ({ ...p, amount: e.target.value }))
                }
                placeholder="R$ 0,00"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-foreground/80">
                Data de Vencimento *
              </label>
              <Input
                type="date"
                value={form.due_date}
                onChange={e =>
                  setForm(p => ({ ...p, due_date: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-foreground/80">
              Descrição
            </label>
            <Input
              value={form.description}
              onChange={e =>
                setForm(p => ({ ...p, description: e.target.value }))
              }
              placeholder="Ex: Mensalidade Plano Premium"
            />
          </div>
          <div className="mt-4 flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-foreground/80">
              Método de Pagamento
            </label>
            <select
              value={form.payment_method}
              onChange={e =>
                setForm(p => ({ ...p, payment_method: e.target.value }))
              }
              className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <option value="credit_card">Cartão de Crédito</option>
              <option value="boleto">Boleto Bancário</option>
              <option value="pix">PIX</option>
            </select>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button
              variant="default"
              onClick={handleCreatePayment}
              disabled={creating}
            >
              {creating ? 'Criando...' : 'Criar Pagamento'}
            </Button>
          </div>
        </Card>
      )}

      {/* Payments List */}
      <div className="flex flex-col gap-3">
        {error ? (
          <Card className="p-12 text-center">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="hsl(var(--destructive))"
              strokeWidth="1.5"
              className="mx-auto mb-4 opacity-50"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h3 className="mb-2 text-[16px] font-bold text-foreground">
              Erro ao carregar
            </h3>
            <p className="mx-auto mb-5 max-w-[400px] text-[14px] text-muted-foreground">
              {error}
            </p>
            <Button variant="default" onClick={fetchPayments}>
              Tentar Novamente
            </Button>
          </Card>
        ) : loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="mb-2 h-4 w-[40%]" />
              <Skeleton className="h-3 w-[30%]" />
            </Card>
          ))
        ) : payments.length === 0 ? (
          <Card className="p-12 text-center">
            <CreditCard className="mx-auto mb-4 opacity-30" size={48} />
            <h3 className="mb-2 text-[16px] font-bold text-foreground">
              Nenhum pagamento encontrado
            </h3>
            <p className="text-[14px] text-muted-foreground">
              Crie um pagamento para começar.
            </p>
          </Card>
        ) : (
          payments.map(payment => (
            <Card
              key={payment.id}
              className="grid grid-cols-[1fr_auto] items-center gap-4 p-5"
            >
              <div>
                <div className="mb-1 flex items-center gap-2">
                  {getStatusIcon(payment.status)}
                  <span className="text-[15px] font-bold text-foreground">
                    {payment.description || 'Pagamento'}
                  </span>
                </div>
                <div className="flex gap-3 text-[12px] text-muted-foreground">
                  <span>
                    Vencimento:{' '}
                    {new Date(payment.due_date).toLocaleDateString('pt-BR')}
                  </span>
                  <span>•</span>
                  <span className="uppercase">
                    {payment.payment_method === 'credit_card'
                      ? 'Cartão'
                      : payment.payment_method === 'boleto'
                        ? 'Boleto'
                        : 'PIX'}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[20px] font-extrabold text-primary">
                  {formatPrice(payment.amount)}
                </div>
                <div
                  className={
                    payment.status === 'confirmed' ||
                    payment.status === 'received'
                      ? 'text-[11px] font-semibold text-emerald-500'
                      : 'text-[11px] font-semibold text-amber-500'
                  }
                >
                  {getStatusLabel(payment.status)}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
