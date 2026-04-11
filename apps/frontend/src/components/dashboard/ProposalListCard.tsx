import React from 'react';

interface ProposalListCardProps {
  id: string;
  clientName: string;
  totalPrice: number;
  createdAt: string;
  onView: () => void;
  onDownload: () => void;
  onDelete: () => void;
}

export const ProposalListCard: React.FC<ProposalListCardProps> = ({
  clientName,
  totalPrice,
  createdAt,
  onView,
  onDownload,
  onDelete
}) => {
  const formattedDate = new Date(createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const formattedPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(totalPrice);

  return (
    <div className="proposal-card">
      <div className="client-badge">Proposta Salva</div>
      <h3>{clientName}</h3>
      
      <div className="proposal-price">{formattedPrice}</div>
      
      <div className="proposal-info-row">
        <span>📅 Criado em</span>
        <span>{formattedDate}</span>
      </div>

      <div className="proposal-actions">
        <button onClick={onView} className="btn-icon" title="Abrir no Simulador">
          👁️ <span style={{ marginLeft: '4px', fontSize: '12px' }}>Ver</span>
        </button>
        <button onClick={onDownload} className="btn-icon" title="Baixar PDF">
          📄 <span style={{ marginLeft: '4px', fontSize: '12px' }}>PDF</span>
        </button>
        <button onClick={onDelete} className="btn-icon btn-delete" title="Excluir">
          🗑️
        </button>
      </div>
    </div>
  );
};
