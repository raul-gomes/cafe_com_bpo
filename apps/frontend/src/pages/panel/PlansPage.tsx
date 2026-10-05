import { useState } from 'react';
import { toast } from 'sonner';

import { useConfirm } from '../../components/ui/ConfirmDialog';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from '../../components/ui/input-group';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { useCreatePlan, usePlans, useUpdatePlan } from '../../api/hooks/usePlans';
import { planCreateSchema, planUpdateSchema, type Plan } from '../../schemas/plans';

/**
 * Admin Config → Planos: a única tela que escreve em `plans` (§17.1).
 *
 * O preço atravessa a API como string decimal ("27.90") porque o banco é
 * `NUMERIC(12,2)`. A tela mostra em real e converte na borda com
 * `toDecimalString`; se ela convertesse para número, um valor como 27,90 viraria
 * float e o round-trip podia voltar 27.899999 — o admin veria um preço e o
 * assinante pagaria outro.
 *
 * `code` e `cycle` não são editáveis aqui: o código é a chave que
 * `subscriptions.plan_id` aponta, e renomeá-la repontaria o que já foi vendido.
 * Ambos são enviados apenas na criação.
 */

const CYCLE_LABEL: Record<string, string> = {
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quinzenal',
  MONTHLY: 'Mensal',
  BIMONTHLY: 'Bimestral',
  QUARTERLY: 'Trimestral',
  SEMIANNUALLY: 'Semestral',
  YEARLY: 'Anual',
};

/**
 * Converte o que o admin digitou ("31,90", "31.90", " 31,90 ") no decimal string
 * que a API recebe.
 *
 * @param raw Texto digitado no campo de preço.
 * @returns O valor normalizado, ou `null` quando não é um preço válido.
 */
const toDecimalString = (raw: string): string | null => {
  const normalized = raw.trim().replace(',', '.');
  return /^\d+(\.\d{1,2})?$/.test(normalized) ? normalized : null;
};

const PlanPriceEditor: React.FC<{ plan: Plan }> = ({ plan }) => {
  const updatePlan = useUpdatePlan();
  const [price, setPrice] = useState(plan.price.replace('.', ','));
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const parsed = planUpdateSchema.safeParse({ price });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Preço inválido.');
      return;
    }
    const decimal = toDecimalString(price);
    if (decimal === null) {
      setError('Informe um valor como 27,90.');
      return;
    }
    if (decimal === plan.price) {
      setError(null);
      return;
    }
    setError(null);
    updatePlan.mutate({ planId: plan.id, data: { price: decimal } });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Label htmlFor={`plan-price-${plan.id}`} className="sr-only">
          Preço do plano {plan.name}
        </Label>
        <InputGroup className="w-40">
          <InputGroupAddon>R$</InputGroupAddon>
          <InputGroupInput
            id={`plan-price-${plan.id}`}
            data-testid={`plan-price-${plan.id}`}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            inputMode="decimal"
            aria-invalid={error ? true : undefined}
            className="text-right"
            disabled={updatePlan.isPending}
          />
        </InputGroup>
        <Button
          variant="outline"
          size="sm"
          data-testid={`plan-save-${plan.id}`}
          onClick={save}
          disabled={updatePlan.isPending}
        >
          Salvar
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};

const NewPlanForm: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const createPlan = useCreatePlan();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const parsed = planCreateSchema.safeParse({
      code: code.trim(),
      name: name.trim(),
      price,
      description: description.trim() || null,
      cycle: 'MONTHLY',
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revise os campos.');
      return;
    }
    const decimal = toDecimalString(parsed.data.price ?? '');
    if (decimal === null) {
      setError('Informe um valor como 27,90.');
      return;
    }
    setError(null);
    createPlan.mutate(
      {
        code: parsed.data.code,
        name: parsed.data.name,
        price: decimal,
        cycle: parsed.data.cycle,
        ...(parsed.data.description ? { description: parsed.data.description } : {}),
      },
      { onSuccess: onDone },
    );
  };

  return (
    <Card className="mb-4 p-4">
      <h2 className="mb-3 text-base font-semibold">Novo plano</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="plan-new-code">Código</Label>
          <Input
            id="plan-new-code"
            data-testid="plan-new-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="monthly_pro"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="plan-new-name">Nome</Label>
          <Input
            id="plan-new-name"
            data-testid="plan-new-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Mensal Pro"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="plan-new-price">Preço</Label>
          <Input
            id="plan-new-price"
            data-testid="plan-new-price"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            inputMode="decimal"
            placeholder="27,90"
          />
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-1">
        <Label htmlFor="plan-new-description">Descrição</Label>
        <Textarea
          id="plan-new-description"
          data-testid="plan-new-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        O ciclo é mensal nesta versão e o código não pode ser alterado depois: é a
        chave que as assinaturas guardam.
      </p>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button
          data-testid="plan-new-submit"
          onClick={submit}
          disabled={createPlan.isPending}
        >
          Criar plano
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </Card>
  );
};

const PlanCard: React.FC<{ plan: Plan }> = ({ plan }) => {
  const updatePlan = useUpdatePlan();
  const confirm = useConfirm();

  const toggleActive = async () => {
    const activating = !plan.is_active;
    const ok = await confirm({
      title: activating ? 'Ativar plano' : 'Desativar plano',
      message: activating
        ? 'O plano volta a aparecer para quem for assinar.'
        : 'O plano sai do catálogo e deixa de ser oferecido. Quem já assina continua com acesso.',
      confirmLabel: activating ? 'Ativar' : 'Desativar',
    });
    if (!ok) {
      return;
    }
    updatePlan.mutate({ planId: plan.id, data: { is_active: activating } });
  };

  return (
    <Card className="mb-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">{plan.name}</h3>
            {plan.is_active ? (
              <Badge variant="outline">Ativo</Badge>
            ) : (
              <Badge variant="secondary">Inativo</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            <code className="text-xs">{plan.code}</code> ·{' '}
            <span data-testid={`plan-cycle-${plan.id}`}>
              {CYCLE_LABEL[plan.cycle] ?? plan.cycle}
            </span>
          </p>
          {plan.description && (
            <p className="text-sm text-muted-foreground">{plan.description}</p>
          )}
          <p
            className="text-sm text-muted-foreground"
            data-testid={`plan-subscribers-${plan.id}`}
          >
            {plan.subscriber_count === 0
              ? 'Nenhuma assinatura'
              : `${plan.subscriber_count} ${
                  plan.subscriber_count === 1 ? 'assinatura' : 'assinaturas'
                }`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PlanPriceEditor plan={plan} />
          <Button
            variant="outline"
            size="sm"
            data-testid={`plan-toggle-${plan.id}`}
            onClick={toggleActive}
            disabled={updatePlan.isPending}
          >
            {plan.is_active ? 'Desativar' : 'Ativar'}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export function PlansPage() {
  const { data: plans, isLoading, isError } = usePlans();
  const [creating, setCreating] = useState(false);

  if (isLoading) {
    return <p className="p-4 text-sm text-muted-foreground">Carregando planos…</p>;
  }

  if (isError) {
    return (
      <Card className="p-4">
        <p className="text-sm text-destructive">Não foi possível carregar os planos.</p>
      </Card>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Planos</h1>
          <p className="text-sm text-muted-foreground">
            O preço salvo aqui é o preço cobrado: nenhuma assinatura recebe valor
            do navegador.
          </p>
        </div>
        <Button data-testid="plan-new" onClick={() => setCreating((open) => !open)}>
          {creating ? 'Fechar' : 'Novo plano'}
        </Button>
      </div>

      {creating && <NewPlanForm onDone={() => setCreating(false)} />}

      {plans && plans.length === 0 && (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">
            Nenhum plano cadastrado.
          </p>
        </Card>
      )}

      {plans?.map((plan) => (
        <PlanCard key={plan.id} plan={plan} />
      ))}

      <p className="mt-4 text-xs text-muted-foreground">
        Desativar tira o plano do catálogo. Quem já assina mantém o acesso até o
        fim do ciclo pago. <span onClick={() => toast.info('Em breve: reprocessar cobranças.')} className="underline cursor-pointer">Alterar o preço de quem já assina</span> chega com a integração de cobrança.
      </p>
    </div>
  );
}

export default PlansPage;
