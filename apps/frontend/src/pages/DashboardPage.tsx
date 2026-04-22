import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/ui/Navbar';
import { apiClient } from '../api/client';
import { ProposalListCard } from '../components/dashboard/ProposalListCard';
import { useGeneratePDF } from '../lib/useGeneratePDF';
import logoAsset from '../assets/logo.png';
import { useAuth } from '../context/AuthContext';
import { getClients, ClientData } from '../api/clients';
import '../dashboard.css';

interface Proposal {
  id: string;
  client_name: string;
  input_payload: any;
  result_payload: any;
  created_at: string;
}

const SESSION_KEY = 'cafe_bpo_proposal';

export const DashboardPage: React.FC = () => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { generate: generatePDF } = useGeneratePDF();

  const fetchData = async () => {
    try {
      setLoading(true);
      const [proposalsResp, clientsResp] = await Promise.all([
        apiClient.get<Proposal[]>('/api/proposals/'),
        getClients()
      ]);
      setProposals(proposalsResp.data);
      setClients(clientsResp);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleView = (proposal: Proposal) => {
    // Carrega os dados no sessionStorage para que o simulador os recupere
    const sessionData = {
      form: proposal.input_payload,
      pricing: proposal.result_payload,
      clientName: proposal.client_name
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    navigate('/simulador');
  };

  const handleDownload = async (proposal: Proposal) => {
    // A normalização da URL agora é feita dentro do hook useGeneratePDF
    const finalLogoUrl = user?.avatar_url || logoAsset;

    // Busca o email do cliente correspondente
    const client = clients.find(c => c.name.trim().toLowerCase() === proposal.client_name.trim().toLowerCase());
    
    await generatePDF({
      form: proposal.input_payload,
      pricing: proposal.result_payload,
      logoUrl: finalLogoUrl,
      clientName: proposal.client_name,
      clientEmail: client?.email || '', // Passa o email do cliente encontrado
      provider: user
    });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta proposta?')) {
      try {
        await apiClient.delete(`/api/proposals/${id}`);
        setProposals(prev => prev.filter(p => p.id !== id));
      } catch (err) {
        alert('Erro ao excluir proposta.');
      }
    }
  };

  return (
    <div className="dashboard-container">
      <Navbar />
      <div className="dashboard-content">
        <header className="dashboard-header">
          <h1>Minhas Propostas</h1>
          <p>Gerencie todos os cenários de precificação que você criou.</p>
        </header>

        {loading ? (
          <div className="empty-state">Carregando suas propostas...</div>
        ) : proposals.length === 0 ? (
          <div className="empty-state">
            <h3 style={{ color: '#fff' }}>Nenhuma proposta encontrada</h3>
            <p>Comece criando uma simulação no simulador de preços.</p>
            <button 
              className="ds-btn ds-btn-primary" 
              style={{ marginTop: '20px' }}
              onClick={() => navigate('/simulador')}
            >
              Ir para o Simulador
            </button>
          </div>
        ) : (
          <div className="proposal-grid">
            {proposals.map(p => (
              <ProposalListCard
                key={p.id}
                id={p.id}
                clientName={p.client_name}
                totalPrice={p.result_payload.final_price || 0}
                createdAt={p.created_at}
                onView={() => handleView(p)}
                onDownload={() => handleDownload(p)}
                onDelete={() => handleDelete(p.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
