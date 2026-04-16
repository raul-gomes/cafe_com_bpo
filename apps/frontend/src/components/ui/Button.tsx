import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseClass = 'ds-btn';
  const variantClass = `ds-btn-${variant}`;
  const sizeClass = size !== 'md' ? `ds-btn-${size}` : '';
  
  const combinedClasses = [
    baseClass,
    variantClass,
    sizeClass,
    className
  ].filter(Boolean).join(' ');

  return (
    <button 
      className={combinedClasses} 
      disabled={disabled || isLoading} 
      {...props}
    >
      {isLoading ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" />
          </svg>
          {label || children}
        </span>
      ) : (
        label || children
      )}
    </button>
  );
};
