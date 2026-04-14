import React from 'react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  itemName?: string;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Excluir Orçamento',
  message = 'Tem certeza que deseja excluir permanentemente este registro? Esta ação não pode ser desfeita.',
  itemName
}) => {
  if (!isOpen) return null;

  return (
    <div className="panel-modal-overlay">
      <div className="panel-modal" style={{ maxWidth: '400px' }}>
        <div className="panel-modal__header">
          <div className="panel-modal__icon panel-modal__icon--danger">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </div>
          <h2 className="panel-modal__title">{title}</h2>
        </div>
        
        <div className="panel-modal__body">
          <p>{message}</p>
          {itemName && (
            <div className="panel-modal__item-highlight">
              {itemName}
            </div>
          )}
        </div>

        <div className="panel-modal__footer">
          <button className="ds-btn ds-btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button 
            className="ds-btn" 
            style={{ background: '#ef4444', color: 'white' }}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Excluir Agora
          </button>
        </div>
      </div>
    </div>
  );
};
