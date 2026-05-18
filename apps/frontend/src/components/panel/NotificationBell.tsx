import React, { useState } from 'react';
import { Bell, Trash2, CheckCheck } from 'lucide-react';
import { useAppNotifications } from '../../api/hooks/useAppNotifications';

export const NotificationBell: React.FC = () => {
  const { useUnreadCount, useNotificationsList, useMarkAsRead, useMarkAllAsRead, useDeleteNotification } = useAppNotifications();
  const { data: unreadData } = useUnreadCount();
  const { data: notifications } = useNotificationsList(undefined, true);
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const deleteNotification = useDeleteNotification();

  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = unreadData?.count || 0;

  const TYPE_ICONS: Record<string, string> = {
    task_assigned: '📋',
    task_deadline: '⏰',
    task_overdue: '🚨',
    phase_change: '🔄',
    proposal: '💰',
    system: 'ℹ️',
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}min`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  const handleMarkRead = async (id: string) => {
    await markAsRead.mutateAsync(id);
  };

  const handleMarkAll = async () => {
    await markAllAsRead.mutateAsync();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteNotification.mutateAsync(id);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative', background: 'none', border: 'none',
          color: 'var(--ds-text-muted)', cursor: 'pointer', padding: '8px',
          borderRadius: 'var(--radius-md)', transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ds-text)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ds-text-muted)')}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute', top: '2px', right: '2px',
              width: '18px', height: '18px', borderRadius: '50%',
              background: 'var(--ds-error)', color: 'white',
              fontSize: '10px', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} onClick={() => setIsOpen(false)} />
          <div
            className="ds-card"
            style={{
              position: 'absolute', top: '100%', right: 0, marginTop: '8px',
              width: '380px', maxHeight: '500px', overflow: 'auto',
              background: 'var(--ds-surface)', border: '1px solid var(--ds-border)',
              borderRadius: 'var(--radius-lg)', zIndex: 1000,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 20px', borderBottom: '1px solid var(--ds-border)',
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                Notificações
                {unreadCount > 0 && (
                  <span style={{
                    fontSize: '11px', fontWeight: 600, marginLeft: '8px',
                    color: 'var(--ds-primary)',
                  }}>
                    {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                  </span>
                )}
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="ds-btn ds-btn-ghost ds-btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <CheckCheck size={14} /> Marcar todas
                </button>
              )}
            </div>

            <div style={{ padding: '8px' }}>
              {notifications?.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ds-text-muted)' }}>
                  <Bell size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                  <p style={{ fontSize: '13px', margin: 0 }}>Nenhuma notificação</p>
                </div>
              ) : (
                notifications?.map(notif => (
                  <div
                    key={notif.id}
                    onClick={() => handleMarkRead(notif.id)}
                    style={{
                      display: 'flex', gap: '12px', padding: '14px 16px',
                      borderRadius: 'var(--radius-md)', cursor: 'pointer',
                      background: notif.is_read ? 'transparent' : 'var(--ds-surface-2)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ds-surface-2)')}
                    onMouseLeave={(e) => {
                      if (notif.is_read) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: 'var(--ds-surface-3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '16px', flexShrink: 0,
                    }}>
                      {TYPE_ICONS[notif.type] || 'ℹ️'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                        {notif.title}
                      </div>
                      <div style={{
                        fontSize: '12px', color: 'var(--ds-text-muted)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {notif.message}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--ds-text-subtle)', marginTop: '4px' }}>
                        {formatTime(notif.created_at)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDelete(notif.id, e)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--ds-text-subtle)', padding: '4px',
                        opacity: 0.6, transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
