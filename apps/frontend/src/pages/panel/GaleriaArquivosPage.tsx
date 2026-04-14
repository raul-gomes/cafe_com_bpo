import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';

interface GalleryFile {
  name: string;
  size: number;
  extension: string;
  last_modified: string;
}

export const GaleriaArquivosPage: React.FC = () => {
  const [files, setFiles] = useState<GalleryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const resp = await apiClient.get<GalleryFile[]>('/api/gallery/');
      setFiles(resp.data);
    } catch (err) {
      console.error('Erro ao carregar arquivos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (ext: string) => {
    const e = ext.replace('.', '').toLowerCase();
    if (['pdf'].includes(e)) {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M10 13a1 1 0 011 1v1a1 1 0 01-1 1H9a1 1 0 01-1-1v-1a1 1 0 011-1h1z" />
          <path d="M12 11l2 2-2 2" />
        </svg>
      );
    }
    if (['xls', 'xlsx', 'csv'].includes(e)) {
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
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
        <polyline points="13 2 13 9 20 9" />
      </svg>
    );
  };

  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDownload = (filename: string) => {
    // Definimos a URL completa do endpoint de download
    const downloadUrl = `${apiClient.defaults.baseURL}/api/gallery/download/${filename}`;
    window.open(downloadUrl, '_blank');
  };

  return (
    <div className="gallery-page" style={{ animation: 'panelFadeIn 0.4s ease-out' }}>
      {/* Breadcrumb Navigation */}
      <div className="panel-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '12px', fontWeight: 600 }}>
        <Link to="/painel" style={{ color: 'var(--ds-text-muted)', textDecoration: 'none' }}>Painel</Link>
        <span style={{ color: 'var(--ds-text-subtle)' }}>/</span>
        <span style={{ color: 'var(--ds-primary)' }}>Galeria de Arquivos</span>
      </div>

      <div className="panel-content__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h1>Galeria de Arquivos</h1>
          <p>Acesse modelos de propostas, guias e planilhas oficiais do Café com BPO.</p>
        </div>
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
      </div>

      <div className="panel-card" style={{ padding: '0', overflow: 'hidden' }}>
        <table className="ds-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
              <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 700, color: 'var(--ds-text-subtle)', textTransform: 'uppercase' }}>Arquivo</th>
              <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 700, color: 'var(--ds-text-subtle)', textTransform: 'uppercase' }}>Tipo</th>
              <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 700, color: 'var(--ds-text-subtle)', textTransform: 'uppercase' }}>Tamanho</th>
              <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 700, color: 'var(--ds-text-subtle)', textTransform: 'uppercase', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '16px 24px' }}><div className="panel-skeleton" style={{ width: '200px', height: '16px' }} /></td>
                  <td style={{ padding: '16px 24px' }}><div className="panel-skeleton" style={{ width: '60px', height: '16px' }} /></td>
                  <td style={{ padding: '16px 24px' }}><div className="panel-skeleton" style={{ width: '40px', height: '16px' }} /></td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}><div className="panel-skeleton" style={{ width: '32px', height: '32px', marginLeft: 'auto', borderRadius: '4px' }} /></td>
                </tr>
              ))
            ) : filteredFiles.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '60px 24px', textAlign: 'center' }}>
                  <div className="panel-empty" style={{ margin: '0' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: '16px' }}>
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                    </svg>
                    <p style={{ color: 'var(--ds-text-muted)' }}>Nenhum arquivo encontrado.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredFiles.map((file, idx) => (
                <tr key={idx} className="ds-table-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s ease' }}>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {getFileIcon(file.extension)}
                      <span 
                        style={{ 
                          fontWeight: 600, 
                          color: 'var(--ds-text)', 
                          cursor: 'pointer',
                          transition: 'color 0.2s ease'
                        }}
                        className="file-name-link"
                        onClick={() => handleDownload(file.name)}
                      >
                        {file.name}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ds-text-subtle)', textTransform: 'uppercase' }}>
                      {file.extension.replace('.', '') || 'Arquivo'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', color: 'var(--ds-text-muted)', fontSize: '13px' }}>
                    {formatSize(file.size)}
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <button 
                      className="ds-btn ds-btn-ghost ds-btn-sm" 
                      onClick={() => handleDownload(file.name)}
                      title="Baixar Arquivo"
                      style={{ padding: '8px' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ds-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
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
