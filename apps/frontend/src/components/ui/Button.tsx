import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'pill';
  size?: 'normal' | 'large';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  variant = 'primary', 
  size = 'normal', 
  children, 
  ...props 
}) => {
  const baseStyle: React.CSSProperties = {
    fontFamily: 'Inter, sans-serif',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none'
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--premium-green)',
      color: '#000000',
      padding: size === 'large' ? '12px 24px' : '8px 15px',
      borderRadius: '8px',
      border: '1px solid transparent',
      fontWeight: '600',
      fontSize: size === 'large' ? '18px' : '17px'
    },
    outline: {
      backgroundColor: 'transparent',
      color: 'var(--text-light)',
      padding: '8px 15px',
      borderRadius: '980px',
      border: '1px solid var(--text-light)',
      fontWeight: '400',
      fontSize: '14px'
    },
    pill: {
      backgroundColor: 'transparent',
      color: 'var(--premium-green)',
      padding: '8px 15px',
      borderRadius: '980px',
      border: '1px solid var(--premium-green)',
      fontWeight: '400',
      fontSize: '14px'
    }
  };

  return (
    <button 
      style={{ ...baseStyle, ...variants[variant] }}
      onMouseEnter={(e) => {
        if (variant === 'primary') e.currentTarget.style.backgroundColor = 'var(--premium-green-hover)';
      }}
      onMouseLeave={(e) => {
        if (variant === 'primary') e.currentTarget.style.backgroundColor = 'var(--premium-green)';
      }}
      {...props}
    >
      {children}
      {variant !== 'primary' && <span style={{ marginLeft: 6 }}>{'>'}</span>}
    </button>
  );
};
