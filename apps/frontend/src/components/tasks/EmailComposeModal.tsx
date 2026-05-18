import React, { useState } from 'react';
import { X, Mail, Paperclip, Send } from 'lucide-react';
import { useTasks } from '../../api/hooks/useTasks';


interface EmailComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskTitle: string;
  clientName: string;
  clientEmail: string;
}

export const EmailComposeModal: React.FC<EmailComposeModalProps> = ({
  isOpen, onClose, taskId, taskTitle, clientName, clientEmail,
}) => {
  const { useTaskAttachments, useSendTaskEmail } = useTasks();
  const { data: attachments } = useTaskAttachments(taskId);
  const sendEmail = useSendTaskEmail();

  const [subject, setSubject] = useState(`Entrega: ${taskTitle}`);
  const [body, setBody] = useState(`Olá ${clientName},\n\nSegue em anexo os documentos referentes à tarefa: ${taskTitle}.\n\nAtenciosamente,`);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleAttachment = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSend = async () => {
    if (selectedIds.length === 0) {
      alert('Selecione pelo menos um anexo para enviar.');
      return;
    }
    try {
      await sendEmail.mutateAsync({
        task_id: taskId,
        subject,
        body,
        attachment_ids: selectedIds,
      });
      alert('Email enviado com sucesso!');
      onClose();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erro ao enviar email.');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.6)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        className="ds-card"
        style={{
          width: '520px', maxHeight: '80vh', overflow: 'auto',
          background: 'var(--ds-surface)', border: '1px solid var(--ds-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 24px', borderBottom: '1px solid var(--ds-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Mail size={20} color="var(--ds-primary)" />
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Enviar por Email</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ds-text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          {/* To */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ds-text-muted)', display: 'block', marginBottom: '6px' }}>Para</label>
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--ds-border)', background: 'var(--ds-surface-2)',
              color: 'var(--ds-text)', fontSize: '14px',
            }}>
              {clientName} &lt;{clientEmail}&gt;
            </div>
          </div>

          {/* Subject */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ds-text-muted)', display: 'block', marginBottom: '6px' }}>Assunto</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--ds-border)', background: 'var(--ds-surface)',
                color: 'var(--ds-text)', fontSize: '14px',
              }}
            />
          </div>

          {/* Body */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ds-text-muted)', display: 'block', marginBottom: '6px' }}>Mensagem</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--ds-border)', background: 'var(--ds-surface)',
                color: 'var(--ds-text)', fontSize: '14px', resize: 'vertical', fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Attachments */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ds-text-muted)', display: 'block', marginBottom: '8px' }}>
              <Paperclip size={14} style={{ display: 'inline', marginRight: '4px' }} />
              Anexos ({attachments?.length || 0})
            </label>
            {!attachments || attachments.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--ds-text-muted)', padding: '8px 0' }}>
                Nenhum anexo nesta tarefa. Faça upload de arquivos primeiro.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {attachments.map((att) => (
                  <label
                    key={att.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--ds-surface-2)', cursor: 'pointer',
                      border: selectedIds.includes(att.id) ? '1px solid var(--ds-primary)' : '1px solid transparent',
                      opacity: att.sent_to_client ? 0.5 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(att.id)}
                      onChange={() => toggleAttachment(att.id)}
                      disabled={att.sent_to_client}
                      style={{ accentColor: 'var(--ds-primary)' }}
                    />
                    <Paperclip size={14} style={{ color: 'var(--ds-text-muted)' }} />
                    <span style={{ flex: 1, fontSize: '13px', fontWeight: 600 }}>{att.file_name}</span>
                    {att.file_size && (
                      <span style={{ fontSize: '11px', color: 'var(--ds-text-muted)' }}>
                        {(att.file_size / 1024).toFixed(0)} KB
                      </span>
                    )}
                    {att.sent_to_client && (
                      <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                        Enviado
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button className="ds-btn ds-btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="ds-btn ds-btn-primary"
              onClick={handleSend}
              disabled={selectedIds.length === 0 || sendEmail.isPending}
              style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
            >
              <Send size={16} />
              {sendEmail.isPending ? 'Enviando...' : 'Enviar Email'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
