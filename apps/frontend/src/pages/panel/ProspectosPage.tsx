import React, { useEffect, useState } from 'react';
import {
  getProspects,
  createProspect,
  updateProspect,
  deleteProspect,
  convertProspect,
  ProspectData,
} from '../../api/prospects';
import { MaskedCNPJ, MaskedPhone, MaskedCPF } from '../../components/ui/MaskedInput';
import { maskCNPJ, maskPhone, maskCEP, maskCPF, onlyNumbers } from '../../lib/formatters';
import { lookupCnpj, lookupCep } from '../../lib/brasilApi';
import { getClientSegments } from '../../api/clients';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { UserCheck, Trash2 } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Skeleton } from '../../components/ui/skeleton';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { toast } from 'sonner';

export const ProspectosPage: React.FC = () => {
  const [prospects, setProspects] = useState<ProspectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    cnpj: '',
    phone: '',
    email: '',
    description: '',
    segment: '',
    color: '#4287f5',
    representante_nome: '',
    representante_email: '',
    representante_cpf: '',
    representante_telefone: '',
    representante_cargo: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    cep: '',
  });
  const [segments, setSegments] = useState<string[]>([]);
  const [customSegment, setCustomSegment] = useState('');
  const confirm = useConfirm();

  useEffect(() => {
    loadProspects();
    loadSegments();
  }, []);

  const loadSegments = async () => {
    try {
      const data = await getClientSegments();
      setSegments(data);
    } catch (err) {
      console.error('Erro ao carregar segmentos:', err);
    }
  };

  const loadProspects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProspects();
      setProspects(data);
    } catch (err) {
      console.error('Erro ao carregar prospectos:', err);
      setError('Não foi possível carregar os prospectos. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', cnpj: '', phone: '', email: '', description: '', segment: '', color: '#4287f5', representante_nome: '', representante_email: '', representante_cpf: '', representante_telefone: '', representante_cargo: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', cep: '' });
    setCustomSegment('');
    setShowForm(false);
    setExpandedCardId(null);
  };

  const handleStartEdit = (prospect: ProspectData) => {
    setExpandedCardId(prospect.id);
    const seg = prospect.segment || '';
    const isKnown = !seg || segments.includes(seg);
    setFormData({
      name: prospect.name,
      cnpj: prospect.cnpj || '',
      phone: prospect.phone || '',
      email: prospect.email || '',
      description: prospect.description || '',
      segment: isKnown ? seg : 'Outro',
      color: prospect.color || '#4287f5',
      representante_nome: prospect.representante_nome || '',
      representante_email: prospect.representante_email || '',
      representante_cpf: prospect.representante_cpf || '',
      representante_telefone: prospect.representante_telefone || '',
      representante_cargo: prospect.representante_cargo || '',
      street: prospect.street || '',
      number: prospect.number || '',
      complement: prospect.complement || '',
      neighborhood: prospect.neighborhood || '',
      city: prospect.city || '',
      state: prospect.state || '',
      cep: prospect.cep || '',
    });
    setCustomSegment(isKnown ? '' : seg);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!formData.name) return;

    const resolvedSegment =
      formData.segment === 'Outro' && customSegment.trim()
        ? customSegment.trim()
        : formData.segment || undefined;

    const payload = {
      name: formData.name,
      cnpj: formData.cnpj || undefined,
      phone: formData.phone || undefined,
      email: formData.email.trim() || undefined,
      description: formData.description || undefined,
      segment: resolvedSegment,
      color: formData.color,
      representante_nome: formData.representante_nome || undefined,
      representante_email: formData.representante_email.trim() || undefined,
      representante_cpf: formData.representante_cpf || undefined,
      representante_telefone: formData.representante_telefone || undefined,
      representante_cargo: formData.representante_cargo || undefined,
      street: formData.street || undefined,
      number: formData.number || undefined,
      complement: formData.complement || undefined,
      neighborhood: formData.neighborhood || undefined,
      city: formData.city || undefined,
      state: formData.state || undefined,
      cep: formData.cep || undefined,
    };

    try {
      if (expandedCardId) {
        await updateProspect(expandedCardId, payload);
        toast.success('Prospecto atualizado.');
      } else {
        await createProspect(payload);
        toast.success('Prospecto criado.');
      }
      resetForm();
      await loadProspects();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar prospecto.');
    }
  };

  const handleCnpjBlur = async () => {
    const data = await lookupCnpj(formData.cnpj);
    if (!data) return; // não encontrado na Brasil API → deixa os campos em branco

    setFormData(prev => ({
      ...prev,
      name: prev.name || (data.nome_fantasia || data.razao_social || ''),
      phone: data.ddd_telefone_1 ? maskPhone(data.ddd_telefone_1) : prev.phone,
      email: data.email || prev.email,
      street: data.logradouro || prev.street,
      number: data.numero || prev.number,
      complement: data.complemento || prev.complement,
      neighborhood: data.bairro || prev.neighborhood,
      city: data.municipio || prev.city,
      state: data.uf || prev.state,
      cep: data.cep ? maskCEP(data.cep) : prev.cep,
    }));
  };

  const handleCepBlur = async () => {
    const data = await lookupCep(formData.cep);
    if (!data) return; // não encontrado na Brasil API → deixa os campos em branco

    setFormData(prev => ({
      ...prev,
      street: data.street || prev.street,
      neighborhood: data.neighborhood || prev.neighborhood,
      city: data.city || prev.city,
      state: data.state || prev.state,
      cep: maskCEP(data.cep) || prev.cep,
    }));
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Arquivar prospecto?',
      message: `O prospecto "${name}" será arquivado e não aparecerá mais na lista. Os dados são preservados (soft delete), mas o prospecto fica inativo.`,
      variant: 'warning',
      confirmLabel: 'Sim, arquivar',
    });
    if (!ok) return;
    try {
      setProspects(prev => prev.filter(p => p.id !== id));
      await deleteProspect(id);
      toast.success(`Prospecto "${name}" arquivado.`);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao arquivar prospecto.');
      await loadProspects();
    }
  };

  const handleConvert = async (prospect: ProspectData) => {
    const ok = await confirm({
      title: 'Converter em Cliente?',
      message: `O prospecto "${prospect.name}" se tornará um Cliente e sairá da lista de prospectos. Use esta ação ao finalizar o contrato.`,
      variant: 'warning',
      confirmLabel: 'Converter',
    });
    if (!ok) return;
    try {
      await convertProspect(prospect.id);
      setProspects(prev => prev.filter(p => p.id !== prospect.id));
      toast.success(`"${prospect.name}" convertido em Cliente.`);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao converter prospecto.');
      await loadProspects();
    }
  };

  const renderFormFields = () => (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-foreground">CNPJ</label>
        <MaskedCNPJ value={formData.cnpj} onChange={(raw) => setFormData({ ...formData, cnpj: raw })} onBlur={handleCnpjBlur} />
        <p className="text-[11px] text-muted-foreground">Informar o CNPJ preenche os dados da empresa automaticamente.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-foreground">Nome do Prospecto *</label>
        <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Nome do prospecto" />
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
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-[13px] text-foreground outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50 [&>option]:bg-background [&>option]:text-foreground [&>option]:dark:bg-zinc-900"
          value={formData.segment}
          onChange={e => setFormData({ ...formData, segment: e.target.value })}
        >
          <option value="">Selecione...</option>
          {segments.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {formData.segment === 'Outro' && (
          <Input
            value={customSegment}
            onChange={e => setCustomSegment(e.target.value)}
            placeholder="Digite o segmento personalizado"
            className="mt-1"
          />
        )}
      </div>
      <div className="flex flex-col gap-1.5" style={{ gridColumn: '1 / -1' }}>
        <label className="text-[13px] font-medium text-foreground">Representante da Empresa</label>
        <p className="text-[11px] text-muted-foreground">
          Dados do representante legal. Usados automaticamente no contrato (cláusula "Das Partes").
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-foreground">Nome Completo</label>
        <Input value={formData.representante_nome} onChange={e => setFormData({ ...formData, representante_nome: e.target.value })} placeholder="Nome do representante" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-foreground">E-mail</label>
        <Input type="email" value={formData.representante_email} onChange={e => setFormData({ ...formData, representante_email: e.target.value })} placeholder="representante@empresa.com" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-foreground">CPF</label>
        <MaskedCPF value={formData.representante_cpf} onChange={(raw) => setFormData({ ...formData, representante_cpf: raw })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-foreground">Telefone</label>
        <MaskedPhone value={formData.representante_telefone} onChange={(raw) => setFormData({ ...formData, representante_telefone: raw })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-foreground">Cargo</label>
        <Input value={formData.representante_cargo} onChange={e => setFormData({ ...formData, representante_cargo: e.target.value })} placeholder="Ex.: Sócio(a), Diretor(a), CFO" />
      </div>
      <div className="flex flex-col gap-1.5" style={{ gridColumn: '1 / -1' }}>
        <label className="text-[13px] font-medium text-foreground">Endereço</label>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-foreground">CEP</label>
        <Input value={maskCEP(formData.cep)} onChange={e => setFormData({ ...formData, cep: onlyNumbers(e.target.value) })} onBlur={handleCepBlur} placeholder="00000-000" inputMode="numeric" />
        <p className="text-[11px] text-muted-foreground">Informar o CEP preenche o endereço automaticamente.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-foreground">Logradouro</label>
        <Input value={formData.street} onChange={e => setFormData({ ...formData, street: e.target.value })} placeholder="Rua / Avenida" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-foreground">Número</label>
        <Input value={formData.number} onChange={e => setFormData({ ...formData, number: e.target.value })} placeholder="Número" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-foreground">Complemento</label>
        <Input value={formData.complement} onChange={e => setFormData({ ...formData, complement: e.target.value })} placeholder="Apto / Sala / Andar" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-foreground">Bairro</label>
        <Input value={formData.neighborhood} onChange={e => setFormData({ ...formData, neighborhood: e.target.value })} placeholder="Bairro" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-foreground">Cidade</label>
        <Input value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} placeholder="Cidade" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-foreground">UF</label>
        <Input value={formData.state} onChange={e => setFormData({ ...formData, state: e.target.value.toUpperCase().slice(0, 2) })} placeholder="UF" maxLength={2} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-foreground">Cor</label>
        <input type="color" value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })}
          className="h-[42px] w-full cursor-pointer rounded-lg border border-input bg-transparent p-1" />
      </div>
      <div className="flex flex-col gap-1.5" style={{ gridColumn: '1 / -1' }}>
        <label className="text-[13px] font-medium text-foreground">Descrição do Prospecto</label>
        <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
          placeholder="Descreva o lead, o porte, a demanda potencial..." rows={3} className="min-h-[80px] resize-y" />
      </div>
    </div>
  );

  return (
    <div className="animate-[panelFadeIn_0.4s_ease-out]">
      <Breadcrumb items={[{ label: 'Painel', to: '/painel' }, { label: 'Meus Prospectos' }]} />

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[32px] font-extrabold tracking-tight text-foreground">Meus Prospectos</h1>
          <p className="text-[14px] text-muted-foreground">Leads com dados cadastrais. Ao finalizar o contrato, converta em Cliente.</p>
        </div>
        <Button variant="default" onClick={() => { resetForm(); setShowForm(true); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Novo Prospecto
        </Button>
      </div>

      {showForm && !expandedCardId && (
        <Card className="mb-6 p-6">
          <h3 className="mb-4 text-[16px] font-semibold text-foreground">Novo Prospecto</h3>
          {renderFormFields()}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={resetForm}>Cancelar</Button>
            <Button variant="default" onClick={handleSubmit} disabled={!formData.name}>Criar Prospecto</Button>
          </div>
        </Card>
      )}

      {error ? (
        <Card className="p-12 text-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--destructive))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 opacity-50">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3 className="mb-2 text-[16px] font-bold text-foreground">Erro ao carregar</h3>
          <p className="mx-auto mb-5 max-w-[400px] text-[14px] text-muted-foreground">{error}</p>
          <Button variant="default" onClick={loadProspects}>Tentar Novamente</Button>
        </Card>
      ) : loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : prospects.length === 0 ? (
        <Card className="p-12 text-center">
          <svg className="mx-auto mb-4 size-12 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
          <h3 className="mb-2 text-[16px] font-bold text-foreground">Nenhum prospecto cadastrado</h3>
          <p className="mb-5 text-[14px] text-muted-foreground">Comece adicionando um lead à sua lista de prospects.</p>
          <Button variant="default" onClick={() => { resetForm(); setShowForm(true); }}>Novo Prospecto</Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {prospects.map(p => {
            const isExpanded = expandedCardId === p.id;
            return (
              <Card
                key={p.id}
                className="cursor-pointer p-0 transition-colors"
                onClick={() => handleStartEdit(p)}
              >
                {isExpanded ? (
                  <div onClick={e => e.stopPropagation()} className="p-4">
                    <h3 className="mb-4 text-[16px] font-semibold text-foreground">Editar Prospecto</h3>
                    {renderFormFields()}
                    <div className="mt-4 flex justify-end gap-2">
                      <Button variant="ghost" onClick={resetForm}>Cancelar</Button>
                      <Button variant="default" onClick={handleSubmit} disabled={!formData.name}>Salvar Alterações</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="size-3 shrink-0 rounded-full" style={{ backgroundColor: p.color || '#4287f5' }} />
                        <div>
                          <span className="text-[15px] font-bold text-foreground">{p.name}</span>
                          <div className="mt-1 flex flex-wrap gap-2 text-[12px] text-muted-foreground">
                            {p.segment && (
                              <span className="rounded-sm bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground">{p.segment}</span>
                            )}
                            {p.cnpj && <span>{maskCNPJ(p.cnpj)}</span>}
                            {p.phone && <><span className="opacity-30">|</span><span>{maskPhone(p.phone)}</span></>}
                            {p.email && <><span className="opacity-30">|</span><span className="normal-case">{p.email}</span></>}
                            {p.representante_nome && (
                              <>
                                <span className="opacity-30">|</span>
                                <span>
                                  {p.representante_nome}
                                  {p.representante_cargo ? ` (${p.representante_cargo})` : ''}
                                  {p.representante_cpf ? ` — CPF ${maskCPF(p.representante_cpf)}` : ''}
                                </span>
                              </>
                            )}
                          </div>
                          {p.description && (
                            <p className="mt-1 max-w-[500px] truncate text-[12px] text-muted-foreground">{p.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <Button variant="default" size="sm" onClick={() => handleConvert(p)} aria-label="Converter em Cliente">
                        <UserCheck size={14} /> Converter
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); handleStartEdit(p); }} title="Editar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id, p.name)} title="Excluir" className="text-destructive hover:text-destructive">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};