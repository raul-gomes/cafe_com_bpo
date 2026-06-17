import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { uploadAvatar, uploadCompanyLogo, updateProfile } from '../../api/clients';
import { getApiUrl } from '../../api/client';
import { Button } from '../../components/ui/button';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../../components/ui/tabs';
import { ColorPicker } from '../../components/ui/ColorPicker';
import { maskCNPJ, maskPhone, unmask } from '../../utils/masks';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import type { User } from '../../context/AuthContext';

type TabType = 'personal' | 'company' | 'contact' | 'customization';

const SEGMENT_OPTIONS = [
  { value: '', label: 'Selecione um segmento' },
  { value: 'contabilidade', label: 'Contabilidade' },
  { value: 'consultoria', label: 'Consultoria' },
  { value: 'bpo_financeiro', label: 'BPO Financeiro' },
  { value: 'auditoria', label: 'Auditoria' },
  { value: 'outros', label: 'Outros' },
];

const TAB_MAP: Record<TabType, string> = {
  personal: 'Dados Pessoais',
  company: 'Empresa',
  contact: 'Contato',
  customization: 'Personalização',
};

export const PerfilPage: React.FC = () => {
  const { user, setUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('personal');
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    company_segment: user?.company_segment || '',
    company_description: user?.company_description || '',
    whatsapp: user?.whatsapp || '',
    company_razao_social: user?.company_razao_social || '',
    company_nome_fantasia: user?.company_nome_fantasia || '',
    company_cnpj: user?.company_cnpj || '',
    company_address: user?.company_address || '',
    company_professional_email: user?.company_professional_email || '',
    company_commercial_phone: user?.company_commercial_phone || '',
    company_color_code: user?.company_color_code || '',
    company_color_secondary: user?.company_color_secondary || '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [segmentCustom, setSegmentCustom] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    user?.avatar_url
      ? user.avatar_url.startsWith('http')
        ? user.avatar_url
        : `${getApiUrl()}${user.avatar_url}`
      : null
  );

  const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null);
  const [companyLogoPreview, setCompanyLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    const savedSegment = user?.company_segment || '';
    const knownValues = SEGMENT_OPTIONS.map(o => o.value);
    const isCustom = savedSegment !== '' && !knownValues.includes(savedSegment);

    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      company_segment: isCustom ? 'outros' : savedSegment,
      company_description: user?.company_description || '',
      whatsapp: maskPhone(user?.whatsapp || ''),
      company_razao_social: user?.company_razao_social || '',
      company_nome_fantasia: user?.company_nome_fantasia || '',
      company_cnpj: maskCNPJ(user?.company_cnpj || ''),
      company_address: user?.company_address || '',
      company_professional_email: user?.company_professional_email || '',
      company_commercial_phone: maskPhone(user?.company_commercial_phone || ''),
      company_color_code: user?.company_color_code || '',
      company_color_secondary: user?.company_color_secondary || '',
    });
    if (isCustom) {
      setSegmentCustom(savedSegment);
    } else {
      setSegmentCustom('');
    }

    setCompanyLogoPreview(
      user?.company_logo_url
        ? user.company_logo_url.startsWith('http')
          ? user.company_logo_url
          : `${getApiUrl()}${user.company_logo_url}`
        : null
    );
  }, [user]);

  const initials = formData.name
    ? formData.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    let masked = value;
    if (name === 'company_cnpj') masked = maskCNPJ(value);
    else if (name === 'whatsapp' || name === 'company_commercial_phone')
      masked = maskPhone(value);
    if (name === 'company_segment' && value !== 'outros') {
      setSegmentCustom('');
    }
    setFormData(prev => ({ ...prev, [name]: masked }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleCompanyLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCompanyLogoFile(file);
      setCompanyLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (avatarFile) {
        await uploadAvatar(avatarFile);
      }

      if (companyLogoFile) {
        await uploadCompanyLogo(companyLogoFile);
      }

      const payload = {
        ...formData,
        whatsapp: unmask(formData.whatsapp),
        company_cnpj: unmask(formData.company_cnpj),
        company_commercial_phone: unmask(formData.company_commercial_phone),
        company_segment:
          formData.company_segment === 'outros' && segmentCustom
            ? segmentCustom
            : formData.company_segment,
      };

      const updated = await updateProfile(payload);
      setUser(updated as unknown as User);
      toast.success('Perfil atualizado com sucesso!');
    } catch {
      toast.error('Erro ao salvar alterações.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-[panelFadeIn_0.4s_ease-out]">
      <Breadcrumb
        items={[
          { label: 'Painel', to: '/painel' },
          { label: 'Meu Perfil' },
        ]}
      />

      <Card className="p-6">
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-[20px] font-semibold text-foreground">Meu perfil</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Gerencie suas informações pessoais e da empresa.
          </p>
        </div>

        {/* Avatar Section */}
        <div className="mb-6 flex items-center gap-4">
          <div
            className={cn(
              'flex size-16 shrink-0 items-center justify-center rounded-full text-[18px] font-bold',
              avatarPreview
                ? 'bg-cover bg-center text-transparent'
                : 'bg-muted text-muted-foreground'
            )}
            style={
              avatarPreview
                ? {
                    backgroundImage: `url(${avatarPreview})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : undefined
            }
          >
            {initials}
          </div>
          <div>
            <h2 className="text-[16px] font-semibold text-foreground">
              {formData.name || 'Usuário'}
            </h2>
            <p className="text-[13px] text-muted-foreground">{formData.email}</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as TabType)}>
          <TabsList variant="line" className="mb-6 w-full justify-start">
            {Object.entries(TAB_MAP).map(([key, label]) => (
              <TabsTrigger key={key} value={key}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <form onSubmit={handleSubmit}>
            {/* ───────────── DADOS PESSOAIS ───────────── */}
            <TabsContent value="personal">
              <div className="flex flex-col gap-4">
                <Field>
                  <Label>Nome Completo</Label>
                  <Input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Ex: Raul Gomes"
                    required
                  />
                </Field>

                <Field>
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="email@exemplo.com"
                    disabled
                  />
                </Field>

                <Field>
                  <Label>WhatsApp</Label>
                  <Input
                    type="tel"
                    name="whatsapp"
                    value={formData.whatsapp}
                    onChange={handleChange}
                    placeholder="Ex: 11988887777"
                  />
                </Field>
              </div>
            </TabsContent>

            {/* ───────────── EMPRESA ───────────── */}
            <TabsContent value="company">
              <div className="flex flex-col gap-4">
                <Field>
                  <Label>Razão Social</Label>
                  <Input
                    type="text"
                    name="company_razao_social"
                    value={formData.company_razao_social}
                    onChange={handleChange}
                    placeholder="Ex: BPO Soluções Financeiras Ltda"
                  />
                </Field>

                <Field>
                  <Label>Nome Fantasia</Label>
                  <Input
                    type="text"
                    name="company_nome_fantasia"
                    value={formData.company_nome_fantasia}
                    onChange={handleChange}
                    placeholder="Ex: BPO Soluções"
                  />
                </Field>

                <Field>
                  <Label>CNPJ</Label>
                  <Input
                    type="text"
                    name="company_cnpj"
                    value={formData.company_cnpj}
                    onChange={handleChange}
                    placeholder="Ex: 12.345.678/0001-99"
                  />
                </Field>

                <Field>
                  <Label>Segmento</Label>
                  <select
                    name="company_segment"
                    value={formData.company_segment}
                    onChange={handleChange}
                    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                  >
                    {SEGMENT_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {formData.company_segment === 'outros' && (
                    <Input
                      type="text"
                      name="company_segment_custom"
                      value={segmentCustom}
                      onChange={(e) => setSegmentCustom(e.target.value)}
                      placeholder="Descreva seu segmento"
                      className="mt-2"
                    />
                  )}
                </Field>

                <Field>
                  <Label>Descrição da Empresa</Label>
                  <Textarea
                    name="company_description"
                    value={formData.company_description}
                    onChange={handleChange}
                    placeholder="Descreva brevemente o que sua empresa faz..."
                    rows={4}
                    className="resize-y"
                  />
                </Field>
              </div>
            </TabsContent>

            {/* ───────────── CONTATO ───────────── */}
            <TabsContent value="contact">
              <div className="flex flex-col gap-4">
                <Field>
                  <Label>Endereço</Label>
                  <Input
                    type="text"
                    name="company_address"
                    value={formData.company_address}
                    onChange={handleChange}
                    placeholder="Ex: Rua Exemplo, 123"
                  />
                </Field>

                <Field>
                  <Label>E-mail Profissional</Label>
                  <Input
                    type="email"
                    name="company_professional_email"
                    value={formData.company_professional_email}
                    onChange={handleChange}
                    placeholder="Ex: contato@empresa.com"
                  />
                </Field>

                <Field>
                  <Label>Telefone Comercial</Label>
                  <Input
                    type="tel"
                    name="company_commercial_phone"
                    value={formData.company_commercial_phone}
                    onChange={handleChange}
                    placeholder="Ex: 1133334444"
                  />
                </Field>
              </div>
            </TabsContent>

            {/* ───────────── PERSONALIZAÇÃO ───────────── */}
            <TabsContent value="customization">
              <div className="flex flex-col gap-4">
                <ColorPicker
                  label="Cor Primária"
                  value={formData.company_color_code}
                  onChange={(v) =>
                    setFormData(prev => ({ ...prev, company_color_code: v }))
                  }
                  placeholder="#3b82f6"
                />

                <ColorPicker
                  label="Cor Secundária"
                  value={formData.company_color_secondary}
                  onChange={(v) =>
                    setFormData(prev => ({ ...prev, company_color_secondary: v }))
                  }
                  placeholder="#14b8a6"
                />

                {/* Avatar Pessoal */}
                <div className="border-t border-border pt-4">
                  <Label>Avatar Pessoal</Label>
                  <div className="mt-1 flex items-center gap-4">
                    <label
                      htmlFor="avatar-upload"
                      className="inline-flex h-7 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-3 text-[0.8rem] font-medium text-foreground transition-all hover:bg-muted hover:text-foreground"
                    >
                      Escolher Arquivo
                    </label>
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                    <span className="max-w-[200px] truncate text-[13px] text-muted-foreground">
                      {avatarFile ? avatarFile.name : 'Nenhum arquivo selecionado'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground/60">
                    Foto do perfil pessoal (aparece na sidebar).
                  </p>
                </div>

                {/* Logo da Empresa */}
                <div className="pt-4">
                  <Label>Logo da Empresa</Label>
                  <div className="mt-1 flex items-center gap-4">
                    {companyLogoPreview && (
                      <div
                        className="size-12 shrink-0 rounded-lg border border-border bg-cover bg-center"
                        style={{
                          backgroundImage: `url(${companyLogoPreview})`,
                        }}
                      />
                    )}
                    <label
                      htmlFor="company-logo-upload"
                      className="inline-flex h-7 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-3 text-[0.8rem] font-medium text-foreground transition-all hover:bg-muted hover:text-foreground"
                    >
                      Escolher Arquivo
                    </label>
                    <input
                      id="company-logo-upload"
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      onChange={handleCompanyLogoChange}
                      className="hidden"
                    />
                    <span className="max-w-[200px] truncate text-[13px] text-muted-foreground">
                      {companyLogoFile
                        ? companyLogoFile.name
                        : 'Nenhum arquivo selecionado'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground/60">
                    A logo aparecerá na capa das propostas PDF em alta resolução.
                  </p>
                </div>

                {/* Theme preview */}
                {(formData.company_color_code || formData.company_color_secondary) && (
                  <div className="border-t border-border pt-4">
                    <p className="mb-2 text-[13px] text-muted-foreground">
                      Prévia do tema:
                    </p>
                    <div className="flex items-center gap-3">
                      {formData.company_color_code && (
                        <div className="flex items-center gap-1.5">
                          <div
                            className="size-5 rounded border border-border"
                            style={{ background: formData.company_color_code }}
                          />
                          <span className="text-[12px] text-muted-foreground">
                            Primária
                          </span>
                        </div>
                      )}
                      {formData.company_color_secondary && (
                        <div className="flex items-center gap-1.5">
                          <div
                            className="size-5 rounded border border-border"
                            style={{ background: formData.company_color_secondary }}
                          />
                          <span className="text-[12px] text-muted-foreground">
                            Secundária
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Submit */}
            <div className="mt-6 flex justify-end border-t border-border pt-4">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        </Tabs>
      </Card>
    </div>
  );
};

/** Label helper — small component to avoid needing a dedicated Label component */
const Label = ({ children, className, ...props }: React.ComponentProps<'label'>) => (
  <label
    className={cn(
      'text-[13px] font-medium text-foreground/80',
      className
    )}
    {...props}
  >
    {children}
  </label>
);

/** Field wrapper */
const Field = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('flex flex-col gap-1.5', className)}>{children}</div>
);
