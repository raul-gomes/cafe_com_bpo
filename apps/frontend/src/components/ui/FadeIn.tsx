import React, { useEffect, useRef, useState } from 'react';

interface FadeInProps {
  children: React.ReactNode;
  delay?: 1 | 2 | 3;
}

export const FadeIn: React.FC<FadeInProps> = ({ children, delay }) => {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (domRef.current) observer.unobserve(domRef.current);
        }
      });
    });

    const currentRef = domRef.current;
    if (currentRef) observer.observe(currentRef);

    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, []);

  const className = `animate-fade-up ${delay ? `delay-${delay}` : ''}`;
  
  return (
    <div ref={domRef} className={isVisible ? className : 'opacity-0'}>
      {children}
    </div>
  );
};
