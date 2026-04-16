import React, { useRef, useEffect } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder }) => {
  const editorRef = useRef<HTMLDivElement>(null);

  // Sync external value changes safely.
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execStatus = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    // Return focus to editor
    editorRef.current?.focus();
    handleInput();
  };

  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ 
        display: 'flex', gap: '8px', padding: '8px', 
        borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' 
      }}>
        <button 
          type="button"
          onClick={() => execStatus('bold')} 
          style={{ background: 'transparent', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '4px', cursor: 'pointer', padding: '4px 8px', fontWeight: 'bold' }}>
          B
        </button>
        <button 
          type="button"
          onClick={() => execStatus('italic')} 
          style={{ background: 'transparent', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '4px', cursor: 'pointer', padding: '4px 8px', fontStyle: 'italic' }}>
          I
        </button>
        <button 
          type="button"
          onClick={() => execStatus('insertUnorderedList')} 
          style={{ background: 'transparent', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '4px', cursor: 'pointer', padding: '4px 8px' }}>
          Lista
        </button>
        <button 
          type="button"
          onClick={() => {
            const url = prompt('Cole a URL do link:');
            if (url) execStatus('createLink', url);
          }} 
          style={{ background: 'transparent', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '4px', cursor: 'pointer', padding: '4px 8px' }}>
          Link
        </button>
      </div>
      <div 
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        style={{ padding: '16px', minHeight: '150px', outline: 'none', color: '#fff' }}
        data-placeholder={placeholder}
      />
    </div>
  );
};
