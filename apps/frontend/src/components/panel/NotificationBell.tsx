import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { getNotifications, markNotificationRead, PaginatedNotifications } from '../../api/network';

export const NotificationBell: React.FC = () => {
  const [data, setData] = useState<PaginatedNotifications | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const resp = await getNotifications(5);
      setData(resp);
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (notificationId: string, postId: string) => {
    setIsOpen(false);
    
    // Optimistic UI update
    if (data) {
      setData({
        ...data,
        items: data.items.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      });
    }

    markNotificationRead(notificationId).then(() => {
        // Redireciona logo em seguida para não ter o risco de cancelar o request
        navigate(`/painel/forum/${postId}`);
    }).catch((e) => {
        console.error(e);
        navigate(`/painel/forum/${postId}`);
    });
  };

  const unreadCount = data?.items.filter((n) => !n.is_read).length || 0;

  return (
    <div className="notification-bell-container" ref={dropdownRef} style={{ position: 'relative' }}>
      <button 
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notificações"
      >
        <Bell size={24} color="#fff" />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px',
            background: 'var(--ds-primary)', color: '#000', border: '2px solid var(--ds-surface)',
            borderRadius: '50%', width: '18px', height: '18px',
            fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', right: '0', marginTop: '8px',
          width: '300px', background: 'var(--ds-surface)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 'var(--radius-md)', zIndex: 100, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', overflow: 'hidden'
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', fontWeight: 'bold' }}>
            Notificações
          </div>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {!data || data.items.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--ds-text-muted)' }}>
                Nenhuma notificação nova.
              </div>
            ) : (
              data?.items.map(notif => (
                <div 
                  key={notif.id} 
                  style={{ 
                    padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)',
                    background: notif.is_read ? 'transparent' : 'rgba(251,191,36,0.1)',
                    cursor: 'pointer' 
                  }}
                  onClick={() => handleNotificationClick(notif.id, notif.post_id)}
                >
                  <p style={{ margin: 0, fontSize: '13px' }}>
                    Alguém respondeu ao seu tópico!
                  </p>
                  <span style={{ fontSize: '11px', color: 'var(--ds-text-subtle)' }}>
                    {new Date(notif.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
