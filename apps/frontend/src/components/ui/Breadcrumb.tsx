import React from 'react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  return (
    <div className="panel-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '12px', fontWeight: 600 }}>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <span style={{ color: 'var(--ds-text-subtle)' }}>/</span>
          )}
          {item.to ? (
            <Link to={item.to} style={{ color: 'var(--ds-text-muted)', textDecoration: 'none', cursor: 'pointer' }}>
              {item.label}
            </Link>
          ) : (
            <span style={{ color: 'var(--ds-primary)' }}>{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
