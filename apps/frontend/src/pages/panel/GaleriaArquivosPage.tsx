import React, { useEffect, useState, useRef } from 'react';
import { apiClient } from '../../api/client';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';

interface GalleryFile {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  title: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

const BASE_URL = (apiClient.defaults.baseURL || '/api').replace(/\/+$/, '');

export const GaleriaArquivosPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState<'my' | 'common'>('my');
  const [files, setFiles] = useState<GalleryFile[]>([]);
  const [commonFiles, setCommonFiles] = useState<GalleryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tab === 'my') fetchFiles();
    else fetchCommonFiles();
  }, [tab]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await apiClient.get<GalleryFile[]>('/gallery/');
      setFiles(resp.data);
    } catch (err) {
      console.error('Erro ao carregar arquivos:', err);
      setError('Não foi possível carregar os arquivos. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCommonFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await apiClient.get<GalleryFile[]>('/gallery/common');
      setCommonFiles(resp.data);
    } catch (err) {
      console.error('Erro ao carregar arquivos comunitários:', err);
      setError('Não foi possível carregar os arquivos comunitários.');
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M10 13a1 1 0 011 1v1a1 1 0 01-1 1H9a1 1 0 01-1-1v-1a1 1 0 011-1h1z" />
          <path d="M12 11l2 2-2 2" />
        </svg>
      );
    }
    if (['xls', 'xlsx', 'csv'].includes(ext)) {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M8 13h2" />
          <path d="M8 17h2" />
          <path d="M14 13h2" />
          <path d="M14 17h2" />
        </svg>
      );
    }
    if (['doc', 'docx'].includes(ext)) {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
          <path d="M10 9H8" />
        </svg>
      );
    }
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
        <polyline points="13 2 13 9 20 9" />
      </svg>
    );
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    try {
      setUploading(true);
      setUploadProgress(0);
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (uploadTitle) formData.append('title', uploadTitle);
      if (uploadDescription) formData.append('description', uploadDescription);

      const url = tab === 'common' ? '/gallery/common/upload' : '/gallery/upload';
      await apiClient.post(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent: any) => {
          const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          setUploadProgress(percent);
        },
      });

      toast.success('Arquivo enviado com sucesso!');
      resetUploadForm();
      if (tab === 'my') await fetchFiles();
      else await fetchCommonFiles();
    } catch (err: any) {
      console.error('Erro ao enviar arquivo:', err);
      toast.error(err.response?.data?.detail || 'Erro ao enviar arquivo.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (file: GalleryFile) => {
    const ok = await confirm({
      title: 'Excluir arquivo',
      message: `Deseja excluir "${file.file_name}"?`,
      variant: 'danger',
      confirmLabel: 'Excluir',
    });
    if (!ok) return;
    try {
      const url = tab === 'common' ? `/gallery/common/${file.id}` : `/gallery/${file.id}`;
      await apiClient.delete(url);
      toast.success('Arquivo excluído.');
      if (tab === 'my') setFiles(prev => prev.filter(f => f.id !== file.id));
      else setCommonFiles(prev => prev.filter(f => f.id !== file.id));
    } catch (err: any) {
      console.error('Erro ao excluir:', err);
      toast.error(err.response?.data?.detail || 'Erro ao excluir arquivo.');
    }
  };

  const resetUploadForm = () => {
    setSelectedFile(null);
    setUploadTitle('');
    setUploadDescription('');
    setShowUploadForm(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = (file: GalleryFile) => {
    const downloadUrl = `${BASE_URL}${file.file_path}`;
    window.open(downloadUrl, '_blank');
  };

  const currentFiles = tab === 'my' ? files : commonFiles;
  const filteredFiles = currentFiles.filter(f => 
    f.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (f.title && f.title.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="gallery-page" style={{ animation: 'panelFadeIn 0.4s ease-out' }}>
      <Breadcrumb items={[{ label: 'Painel', to: '/painel' }, { label: 'Galeria de Arquivos' }]} />

      <div className="panel-content__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h1>Galeria de Arquivos</h1>
          <p>Armazene modelos, documentos e arquivos importantes da sua operação.</p>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div className="panel-navbar__search" style={{ width: '300px' }}>
            <input 
              type="text" 
              className="panel-navbar__search-input" 
              placeholder="Buscar arquivos..." 
              style={{ width: '100%' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <svg className="panel-navbar__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          {(tab === 'my' || isAdmin) && (
            <button className="ds-btn ds-btn-primary" onClick={() => setShowUploadForm(true)} style={{ gap: '8px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Enviar Arquivo
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'var(--ds-surface-2)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)', width: 'fit-content' }}>
        <button
          onClick={() => setTab('my')}
          style={{
            padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: 700, transition: 'all 0.2s',
            background: tab === 'my' ? 'var(--ds-surface)' : 'transparent',
            color: tab === 'my' ? 'var(--ds-primary)' : 'var(--ds-text-muted)',
          }}
        >
          Meus Arquivos
        </button>
        <button
          onClick={() => setTab('common')}
          style={{
            padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: 700, transition: 'all 0.2s',
            background: tab === 'common' ? 'var(--ds-surface)' : 'transparent',
            color: tab === 'common' ? 'var(--ds-primary)' : 'var(--ds-text-muted)',
          }}
        >
          Comunitários
        </button>
      </div>

      {showUploadForm && (
        <div style={{ backgroundColor: 'var(--ds-surface)', padding: '24px', borderRadius: '12px', border: '1px solid var(--ds-border)', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Enviar Arquivo</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="ds-input-group">
              <label className="ds-label">Arquivo *</label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--ds-primary)' : 'var(--ds-border)'}`,
                  borderRadius: '8px',
                  padding: '32px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  backgroundColor: dragOver ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.ppt,.pptx,.txt,.csv"
                  style={{ display: 'none' }}
                />
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={dragOver ? 'var(--ds-primary)' : 'var(--ds-text-subtle)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px' }}>
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {selectedFile ? (
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ds-text)' }}>{selectedFile.name}</p>
                ) : (
                  <>
                    <p style={{ fontSize: '14px', color: 'var(--ds-text)' }}>Arraste o arquivo aqui ou clique para selecionar</p>
                    <p style={{ fontSize: '11px', color: 'var(--ds-text-subtle)', marginTop: '4px' }}>PDF, DOC, XLS, PNG, JPG, etc. Máximo 10MB.</p>
                  </>
                )}
              </div>
              {uploading && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ height: '4px', backgroundColor: 'var(--ds-border)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${uploadProgress}%`,
                        backgroundColor: 'var(--ds-primary)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--ds-text-subtle)', marginTop: '4px', textAlign: 'center' }}>
                    {uploadProgress}% enviado
                  </p>
                </div>
              )}
            </div>
            <div className="ds-input-group">
              <label className="ds-label">Título</label>
              <input type="text" className="ds-input" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="Nome descritivo" />
            </div>
            <div className="ds-input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="ds-label">Descrição</label>
              <textarea className="ds-input" value={uploadDescription} onChange={e => setUploadDescription(e.target.value)} placeholder="Descreva o conteúdo do arquivo..." rows={2} style={{ resize: 'vertical', minHeight: '60px' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
            <button className="ds-btn ds-btn-ghost" onClick={resetUploadForm} disabled={uploading}>Cancelar</button>
            <button className="ds-btn ds-btn-primary" onClick={handleUpload} disabled={!selectedFile || uploading}>
              {uploading ? `Enviando... ${uploadProgress}%` : 'Enviar'}
            </button>
          </div>
        </div>
      )}

      <div className="panel-card" style={{ padding: '0', overflow: 'hidden' }}>
        <table className="ds-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
              <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 700, color: 'var(--ds-text-subtle)', textTransform: 'uppercase' }}>Arquivo</th>
              <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 700, color: 'var(--ds-text-subtle)', textTransform: 'uppercase' }}>Tipo</th>
              <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 700, color: 'var(--ds-text-subtle)', textTransform: 'uppercase' }}>Tamanho</th>
              <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 700, color: 'var(--ds-text-subtle)', textTransform: 'uppercase' }}>Data</th>
              <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 700, color: 'var(--ds-text-subtle)', textTransform: 'uppercase', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr>
                <td colSpan={5} style={{ padding: '60px 24px', textAlign: 'center' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ds-error)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', opacity: 0.5 }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Erro ao carregar</h3>
                  <p style={{ color: 'var(--ds-text-muted)', marginBottom: '20px' }}>{error}</p>
                  <button className="ds-btn ds-btn-primary" onClick={fetchFiles}>Tentar Novamente</button>
                </td>
              </tr>
            ) : loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '16px 24px' }}><div className="panel-skeleton" style={{ width: '200px', height: '16px' }} /></td>
                  <td style={{ padding: '16px 24px' }}><div className="panel-skeleton" style={{ width: '60px', height: '16px' }} /></td>
                  <td style={{ padding: '16px 24px' }}><div className="panel-skeleton" style={{ width: '40px', height: '16px' }} /></td>
                  <td style={{ padding: '16px 24px' }}><div className="panel-skeleton" style={{ width: '80px', height: '16px' }} /></td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}><div className="panel-skeleton" style={{ width: '32px', height: '32px', marginLeft: 'auto', borderRadius: '4px' }} /></td>
                </tr>
              ))
            ) : filteredFiles.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '60px 24px', textAlign: 'center' }}>
                  <div className="panel-empty" style={{ margin: '0' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: '16px' }}>
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                    </svg>
                    <p style={{ color: 'var(--ds-text-muted)' }}>{searchTerm ? 'Nenhum arquivo encontrado para esta busca.' : 'Nenhum arquivo enviado. Comece enviando seus documentos.'}</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredFiles.map((file) => {
                const ext = file.file_name.split('.').pop() || '';
                return (
                  <tr key={file.id} className="ds-table-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s ease' }}>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {getFileIcon(file.file_name)}
                        <div>
                          <span 
                            style={{ 
                              fontWeight: 600, 
                              color: 'var(--ds-text)', 
                              cursor: 'pointer',
                              transition: 'color 0.2s ease'
                            }}
                            className="file-name-link"
                            onClick={() => handleDownload(file)}
                          >
                            {file.title || file.file_name}
                          </span>
                          {file.description && (
                            <p style={{ fontSize: '11px', color: 'var(--ds-text-subtle)', marginTop: '2px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {file.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ds-text-subtle)', textTransform: 'uppercase' }}>
                        {ext || 'Arquivo'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--ds-text-muted)', fontSize: '13px' }}>
                      {formatSize(file.file_size)}
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--ds-text-muted)', fontSize: '13px' }}>
                      {new Date(file.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button 
                          className="ds-btn ds-btn-ghost ds-btn-sm" 
                          onClick={() => handleDownload(file)}
                          title="Baixar"
                          style={{ padding: '8px' }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ds-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </button>
                        {(tab === 'my' || isAdmin) && (
                          <button 
                            className="ds-btn ds-btn-ghost ds-btn-sm" 
                            onClick={() => handleDelete(file)}
                            title="Excluir"
                            style={{ padding: '8px' }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .ds-table-row:hover {
          background: rgba(255, 255, 255, 0.02);
        }
        .file-name-link:hover {
          color: var(--ds-primary) !important;
          text-decoration: underline;
        }
      `}} />
    </div>
  );
};
