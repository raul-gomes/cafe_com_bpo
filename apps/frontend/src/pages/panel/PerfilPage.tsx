import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { uploadAvatar, uploadCompanyLogo, updateProfile } from '../../api/clients';
import { getApiUrl } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { ColorPicker } from '../../components/ui/ColorPicker';
import { maskCNPJ, maskPhone, unmask } from '../../utils/masks';
import { useToast } from '../../components/ui/Toast';
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

const TABS: { key: TabType; label: string }[] = [
  { key: 'personal', label: 'Dados Pessoais' },
  { key: 'company', label: 'Empresa' },
  { key: 'contact', label: 'Contato' },
  { key: 'customization', label: 'Personalização' },
];

export const PerfilPage: React.FC = () => {
  const { user, setUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('personal');
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    company_segment: user?.company_segment || '',
    company_description: user?.company_description || '',
    // FASE 3 profile fields
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
  const toast = useToast();

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    user?.avatar_url ? (user.avatar_url.startsWith('http') ? user.avatar_url : `${getApiUrl()}${user.avatar_url}`) : null
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
        ? (user.company_logo_url.startsWith('http') ? user.company_logo_url : `${getApiUrl()}${user.company_logo_url}`)
        : null
    );
  }, [user]);

  const initials = formData.name
    ? formData.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let masked = value;
    if (name === 'company_cnpj') masked = maskCNPJ(value);
    else if (name === 'whatsapp' || name === 'company_commercial_phone') masked = maskPhone(value);
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
        company_segment: formData.company_segment === 'outros' && segmentCustom
          ? segmentCustom
          : formData.company_segment,
      };
      
      const updated = await updateProfile(payload);
      
      setUser(updated as unknown as User);
      
      toast.success('Perfil atualizado com sucesso!');
      setIsSaving(false);
    } catch (err) {
      setIsSaving(false);
      toast.error('Erro ao salvar alterações.');
    }
  };

  const renderTabButton = (tab: { key: TabType; label: string }) => (
    <button
      key={tab.key}
      type="button"
      onClick={() => setActiveTab(tab.key)}
      style={{
        padding: '8px 16px',
        background: 'none',
        border: 'none',
        borderBottom: activeTab === tab.key ? '2px solid var(--ds-primary)' : '2px solid transparent',
        color: activeTab === tab.key ? 'var(--ds-white)' : 'var(--ds-text-muted)',
        cursor: 'pointer',
        fontWeight: activeTab === tab.key ? 600 : 400,
        fontSize: '13px',
      }}
    >
      {tab.label}
    </button>
  );

  return (
    <div className="perfil-page">
      <Breadcrumb items={[{ label: 'Painel', to: '/painel' }, { label: 'Meu Perfil' }]} />

      <div className="perfil-card" style={{ maxWidth: '750px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ds-white)' }}>Meu perfil</h2>
          <p style={{ color: 'var(--ds-text-muted)', fontSize: '13px', marginTop: '2px' }}>Gerencie suas informações pessoais e da empresa.</p>
        </div>

        <div className="perfil-card__avatar-section" style={{ marginBottom: '24px' }}>
          {avatarPreview ? (
            <div 
              className="perfil-card__avatar-large" 
              style={{ 
                backgroundImage: `url(${avatarPreview})`, 
                backgroundSize: 'cover', 
                backgroundPosition: 'center', 
                color: 'transparent',
                border: '1px solid var(--ds-border)'
              }}
            >
              {initials}
            </div>
          ) : (
            <div className="perfil-card__avatar-large">{initials}</div>
          )}
          
          <div className="perfil-card__avatar-info">
            <h2 style={{ fontSize: '16px' }}>{formData.name || 'Usuário'}</h2>
            <p>{formData.email}</p>
          </div>
        </div>

        {/* Tab buttons */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid var(--ds-border)', flexWrap: 'wrap' }}>
          {TABS.map(renderTabButton)}
        </div>

        <form className="perfil-form" onSubmit={handleSubmit}>
          {/* ───────────── DADOS PESSOAIS ───────────── */}
          {activeTab === 'personal' && (
            <>
              <div className="ds-input-group">
                <label className="ds-label">Nome Completo</label>
                <input
                  type="text"
                  name="name"
                  className="ds-input"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Ex: Raul Gomes"
                  required
                />
              </div>

              <div className="ds-input-group">
                <label className="ds-label">E-mail</label>
                <input
                  type="email"
                  name="email"
                  className="ds-input"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="email@exemplo.com"
                  disabled
                />
              </div>

              <div className="ds-input-group">
                <label className="ds-label">WhatsApp</label>
                <input
                  type="tel"
                  name="whatsapp"
                  className="ds-input"
                  value={formData.whatsapp}
                  onChange={handleChange}
                  placeholder="Ex: 11988887777"
                />
              </div>
            </>
          )}

          {/* ───────────── EMPRESA ───────────── */}
          {activeTab === 'company' && (
            <>
              <div className="ds-input-group perfil-form__full">
                <label className="ds-label">Razão Social</label>
                <input
                  type="text"
                  name="company_razao_social"
                  className="ds-input"
                  value={formData.company_razao_social}
                  onChange={handleChange}
                  placeholder="Ex: BPO Soluções Financeiras Ltda"
                />
              </div>

              <div className="ds-input-group perfil-form__full">
                <label className="ds-label">Nome Fantasia</label>
                <input
                  type="text"
                  name="company_nome_fantasia"
                  className="ds-input"
                  value={formData.company_nome_fantasia}
                  onChange={handleChange}
                  placeholder="Ex: BPO Soluções"
                />
              </div>

              <div className="ds-input-group perfil-form__full">
                <label className="ds-label">CNPJ</label>
                <input
                  type="text"
                  name="company_cnpj"
                  className="ds-input"
                  value={formData.company_cnpj}
                  onChange={handleChange}
                  placeholder="Ex: 12.345.678/0001-99"
                />
              </div>

              <div className="ds-input-group perfil-form__full">
                <label className="ds-label">Segmento</label>
                <select
                  name="company_segment"
                  className="ds-input"
                  value={formData.company_segment}
                  onChange={handleChange as any}
                >
                  {SEGMENT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {formData.company_segment === 'outros' && (
                  <input
                    type="text"
                    name="company_segment_custom"
                    className="ds-input"
                    value={segmentCustom}
                    onChange={(e) => setSegmentCustom(e.target.value)}
                    placeholder="Descreva seu segmento"
                    style={{ marginTop: '8px' }}
                  />
                )}
              </div>

              <div className="ds-input-group perfil-form__full">
                <label className="ds-label">Descrição da Empresa</label>
                <textarea
                  name="company_description"
                  className="ds-input"
                  value={formData.company_description}
                  onChange={handleChange as any}
                  placeholder="Descreva brevemente o que sua empresa faz..."
                  rows={4}
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
            </>
          )}

          {/* ───────────── CONTATO ───────────── */}
          {activeTab === 'contact' && (
            <>
              <div className="ds-input-group perfil-form__full">
                <label className="ds-label">Endereço</label>
                <input
                  type="text"
                  name="company_address"
                  className="ds-input"
                  value={formData.company_address}
                  onChange={handleChange}
                  placeholder="Ex: Rua Exemplo, 123"
                />
              </div>

              <div className="ds-input-group perfil-form__full">
                <label className="ds-label">E-mail Profissional</label>
                <input
                  type="email"
                  name="company_professional_email"
                  className="ds-input"
                  value={formData.company_professional_email}
                  onChange={handleChange}
                  placeholder="Ex: contato@empresa.com"
                />
              </div>

              <div className="ds-input-group perfil-form__full">
                <label className="ds-label">Telefone Comercial</label>
                <input
                  type="tel"
                  name="company_commercial_phone"
                  className="ds-input"
                  value={formData.company_commercial_phone}
                  onChange={handleChange}
                  placeholder="Ex: 1133334444"
                />
              </div>
            </>
          )}

          {/* ───────────── PERSONALIZAÇÃO ───────────── */}
          {activeTab === 'customization' && (
            <>
              <ColorPicker
                label="Cor Primária"
                value={formData.company_color_code}
                onChange={(v) => setFormData(prev => ({ ...prev, company_color_code: v }))}
                placeholder="#3b82f6"
              />

              <ColorPicker
                label="Cor Secundária"
                value={formData.company_color_secondary}
                onChange={(v) => setFormData(prev => ({ ...prev, company_color_secondary: v }))}
                placeholder="#14b8a6"
              />

              {/* ── Avatar Pessoal ── */}
              <div className="ds-input-group perfil-form__full" style={{ marginTop: '16px', borderTop: '1px solid var(--ds-border)', paddingTop: '16px' }}>
                <label className="ds-label">Avatar Pessoal</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '4px' }}>
                  <label 
                    htmlFor="avatar-upload"
                    className="ds-btn ds-btn-outline ds-btn-sm" 
                    style={{ cursor: 'pointer', textAlign: 'center' }}
                  >
                    Escolher Arquivo
                  </label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleAvatarChange}
                    style={{ display: 'none' }}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--ds-text-muted)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {avatarFile ? avatarFile.name : 'Nenhum arquivo selecionado'}
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--ds-text-subtle)', marginTop: '4px' }}>Foto do perfil pessoal (aparece na sidebar).</p>
              </div>

              {/* ── Logo da Empresa ── */}
              <div className="ds-input-group perfil-form__full" style={{ marginTop: '8px', paddingTop: '16px' }}>
                <label className="ds-label">Logo da Empresa</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '4px' }}>
                  {companyLogoPreview && (
                    <div style={{ width: '48px', height: '48px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--ds-border)', flexShrink: 0, background: `url(${companyLogoPreview}) center/cover no-repeat` }} />
                  )}
                  <label 
                    htmlFor="company-logo-upload"
                    className="ds-btn ds-btn-outline ds-btn-sm" 
                    style={{ cursor: 'pointer', textAlign: 'center' }}
                  >
                    Escolher Arquivo
                  </label>
                  <input
                    id="company-logo-upload"
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleCompanyLogoChange}
                    style={{ display: 'none' }}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--ds-text-muted)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {companyLogoFile ? companyLogoFile.name : 'Nenhum arquivo selecionado'}
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--ds-text-subtle)', marginTop: '4px' }}>A logo aparecerá na capa das propostas PDF em alta resolução.</p>
              </div>

              {/* Theme preview */}
              {(formData.company_color_code || formData.company_color_secondary) && (
                <div style={{ marginTop: '16px', borderTop: '1px solid var(--ds-border)', paddingTop: '16px' }}>
                  <p style={{ fontSize: '13px', color: 'var(--ds-text-muted)', marginBottom: '8px' }}>Prévia do tema:</p>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {formData.company_color_code && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: formData.company_color_code, border: '1px solid var(--ds-border)' }} />
                        <span style={{ fontSize: '12px', color: 'var(--ds-text-muted)' }}>Primária</span>
                      </div>
                    )}
                    {formData.company_color_secondary && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: formData.company_color_secondary, border: '1px solid var(--ds-border)' }} />
                        <span style={{ fontSize: '12px', color: 'var(--ds-text-muted)' }}>Secundária</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="perfil-form__actions">
            <Button 
              type="submit" 
              label="Salvar Alterações" 
              isLoading={isSaving} 
            />
          </div>
        </form>
      </div>
    </div>
  );
};
