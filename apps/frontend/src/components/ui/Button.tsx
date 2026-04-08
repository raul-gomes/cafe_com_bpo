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
  className = '',
  ...props 
}) => {
  const combinedClass = `btn-base btn-${variant} btn-size-${size} ${className}`;

  return (
    <button className={combinedClass} {...props}>
      {children}
      {variant !== 'primary' && <span style={{ marginLeft: 6 }}>{'>'}</span>}
    </button>
  );
};
