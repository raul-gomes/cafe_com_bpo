import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { getNotifications, PaginatedNotifications } from '../../api/network';

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

  const unreadCount = data?.items.filter((n) => !n.is_read).length || 0;

  return (
    <div className="notification-bell-container" ref={dropdownRef} style={{ position: 'relative' }}>
      <button 
        style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', marginTop: '6px', marginRight: '16px' }}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notificações"
      >
        <Bell size={22} color="#fff" />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px',
            background: 'var(--primary-color)', color: '#000',
            borderRadius: '50%', width: '16px', height: '16px',
            fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', right: '16px', marginTop: '8px',
          width: '300px', background: 'var(--panel-bg)', border: '1px solid var(--border-color)',
          borderRadius: '8px', zIndex: 100, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', overflow: 'hidden'
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold' }}>
            Notificações
          </div>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {data?.items.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Nenhuma notificação nova.
              </div>
            ) : (
              data?.items.map(notif => (
                <div 
                  key={notif.id} 
                  style={{ 
                    padding: '12px 16px', borderBottom: '1px solid var(--border-color)',
                    background: notif.is_read ? 'transparent' : 'rgba(255,255,255,0.05)',
                    cursor: 'pointer' 
                  }}
                  onClick={() => {
                    setIsOpen(false);
                    navigate(`/painel/forum/${notif.post_id}`);
                  }}
                >
                  <p style={{ margin: 0, fontSize: '13px' }}>
                    Alguém respondeu ao seu tópico!
                  </p>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
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
