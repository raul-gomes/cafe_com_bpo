import React, { useState, useEffect, useRef } from 'react';
import { useSendFeedback } from '../../api/hooks/useFeedback';

interface ModalReportarErroProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModalReportarErro: React.FC<ModalReportarErroProps> = ({ isOpen, onClose }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const sendFeedback = useSendFeedback();
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setTimeout(() => titleRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const isValid = title.trim().length >= 3 && description.trim().length >= 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    try {
      await sendFeedback.mutateAsync({
        title: title.trim(),
        description: description.trim(),
      });
      onClose();
    } catch {
      // Toast ou feedback visual serão tratados pelo onError
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        style={{
          background: 'var(--ds-surface)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          border: '1px solid var(--ds-border)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Reportar Erro"
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Reportar Erro</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--ds-text-muted)', cursor: 'pointer', padding: '4px' }}
            aria-label="Fechar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Title */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ds-text-muted)', display: 'block', marginBottom: '6px' }}>
              Título <span style={{ color: 'var(--ds-error)' }}>*</span>
            </label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Erro ao gerar relatório"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--ds-border)', background: 'var(--ds-surface-2)',
                color: 'var(--ds-text)', fontSize: '14px', fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
              maxLength={200}
            />
            {title.length > 0 && title.length < 3 && (
              <span style={{ fontSize: '11px', color: 'var(--ds-error)', marginTop: '4px', display: 'block' }}>
                Mínimo de 3 caracteres
              </span>
            )}
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ds-text-muted)', display: 'block', marginBottom: '6px' }}>
              Descrição <span style={{ color: 'var(--ds-error)' }}>*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva detalhadamente o que aconteceu..."
              rows={5}
              maxLength={2000}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--ds-border)', background: 'var(--ds-surface-2)',
                color: 'var(--ds-text)', fontSize: '14px', fontFamily: 'inherit',
                resize: 'vertical', minHeight: '100px', boxSizing: 'border-box',
              }}
            />
            {description.length > 0 && description.length < 10 && (
              <span style={{ fontSize: '11px', color: 'var(--ds-error)', marginTop: '4px', display: 'block' }}>
                Mínimo de 10 caracteres
              </span>
            )}
          </div>

          {/* Error feedback */}
          {sendFeedback.isError && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-sm)',
              background: 'rgba(239,68,68,0.1)', color: 'var(--ds-error)',
              fontSize: '13px', fontWeight: 600,
            }}>
              Erro ao enviar relato. Tente novamente.
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button
              type="button"
              onClick={onClose}
              className="ds-btn ds-btn-ghost"
              style={{ fontSize: '14px', padding: '8px 16px' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="ds-btn ds-btn-primary"
              disabled={!isValid || sendFeedback.isPending}
              style={{ fontSize: '14px', padding: '8px 16px' }}
            >
              {sendFeedback.isPending ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalReportarErro;
