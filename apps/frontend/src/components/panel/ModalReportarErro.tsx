import React, { useEffect, useRef, useState } from 'react';
import { useSendFeedback } from '../../api/hooks/useFeedback';
import { CafeIcon } from '../../brand/CafeIcon';

interface ModalReportarErroProps {
  isOpen: boolean;
  onClose: () => void;
}

const MAX_SCREENSHOT_BYTES = 3 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const fieldClass =
  'w-full rounded-md border border-input bg-background px-[12px] py-[10px] text-[0.9375rem] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40';

/** Reportar erro: título, descrição e print opcional (anexar ou colar com Ctrl+V). */
export const ModalReportarErro: React.FC<ModalReportarErroProps> = ({ isOpen, onClose }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const sendFeedback = useSendFeedback();
  const titleRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setScreenshot(null);
      setFileError(null);
      sendFeedback.reset();
      setTimeout(() => titleRef.current?.focus(), 100);
    }
    // sendFeedback.reset é estável; só reiniciamos ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Prévia do print (libera a URL temporária ao trocar ou fechar).
  useEffect(() => {
    if (!screenshot) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(screenshot);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [screenshot]);

  const pickFile = (file: File | null | undefined) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError('Use uma imagem PNG, JPG ou WEBP.');
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      setFileError('O print deve ter até 3 MB.');
      return;
    }
    setFileError(null);
    setScreenshot(file);
  };

  // Colar o print direto (Print Screen → Ctrl+V) em qualquer ponto da janela.
  const handlePaste = (event: React.ClipboardEvent) => {
    const image = Array.from(event.clipboardData.files).find(file => file.type.startsWith('image/'));
    if (image) {
      event.preventDefault();
      pickFile(image);
    }
  };

  const isValid = title.trim().length >= 3 && description.trim().length >= 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    try {
      await sendFeedback.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        screenshot,
      });
      onClose();
    } catch {
      // A mensagem de erro aparece no formulário (sendFeedback.isError).
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-[16px]" onClick={onClose}>
      <div
        className="relative max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-lg border border-border bg-card p-[clamp(20px,4vw,32px)] text-foreground shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onPaste={handlePaste}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reportar-erro-titulo"
      >
        <div className="mb-[20px] flex items-start justify-between gap-[12px]">
          <div>
            <h2 id="reportar-erro-titulo" className="text-xl font-bold">Reportar erro</h2>
            <p className="mt-[4px] text-sm text-muted-foreground">Conte o que aconteceu. Um print ajuda muito.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-[40px] shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Fechar"
          >
            <CafeIcon name="fechar" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-[16px]">
          <div>
            <label htmlFor="reportar-titulo" className="mb-[6px] block text-sm font-semibold">
              Título <span className="text-destructive">*</span>
            </label>
            <input
              id="reportar-titulo"
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Erro ao gerar relatório"
              className={fieldClass}
              maxLength={200}
              aria-describedby={title.length > 0 && title.length < 3 ? 'reportar-titulo-erro' : undefined}
            />
            {title.length > 0 && title.length < 3 && (
              <span id="reportar-titulo-erro" className="mt-[4px] block text-xs text-destructive">Mínimo de 3 caracteres</span>
            )}
          </div>

          <div>
            <label htmlFor="reportar-descricao" className="mb-[6px] block text-sm font-semibold">
              Descrição <span className="text-destructive">*</span>
            </label>
            <textarea
              id="reportar-descricao"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="O que você fez, o que esperava e o que aconteceu…"
              rows={5}
              maxLength={2000}
              className={`${fieldClass} min-h-[110px] resize-y`}
              aria-describedby={description.length > 0 && description.length < 10 ? 'reportar-descricao-erro' : undefined}
            />
            {description.length > 0 && description.length < 10 && (
              <span id="reportar-descricao-erro" className="mt-[4px] block text-xs text-destructive">Mínimo de 10 caracteres</span>
            )}
          </div>

          <div>
            <span className="mb-[6px] block text-sm font-semibold">Print do erro <span className="font-normal text-muted-foreground">(opcional)</span></span>
            {screenshot && previewUrl ? (
              <div className="flex items-center gap-[12px] rounded-md border border-border bg-muted p-[10px]">
                <img src={previewUrl} alt="Prévia do print anexado" className="h-[64px] w-[96px] rounded-sm border border-border bg-card object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{screenshot.name || 'Print colado'}</p>
                  <p className="text-xs text-muted-foreground">{(screenshot.size / 1024).toFixed(0)} KB</p>
                </div>
                <button
                  type="button"
                  onClick={() => setScreenshot(null)}
                  className="rounded-md px-[10px] py-[6px] text-sm font-semibold text-muted-foreground hover:bg-card hover:text-foreground"
                >
                  Remover
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center gap-[12px] rounded-md border border-dashed border-input bg-background px-[14px] py-[14px] text-left text-sm text-muted-foreground transition-colors hover:border-primary-strong hover:text-foreground"
              >
                <CafeIcon name="anexo" />
                <span>
                  <span className="font-semibold text-foreground">Anexar print</span> ou cole com Ctrl+V
                  <span className="block text-xs">PNG, JPG ou WEBP, até 3 MB</span>
                </span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              className="sr-only"
              tabIndex={-1}
              aria-label="Escolher arquivo do print"
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            {fileError && <span role="alert" className="mt-[4px] block text-xs text-destructive">{fileError}</span>}
          </div>

          {sendFeedback.isError && (
            <div role="alert" className="rounded-md bg-destructive/10 px-[14px] py-[10px] text-sm font-semibold text-destructive">
              Não foi possível enviar o relato. Tente novamente.
            </div>
          )}

          <div className="mt-[4px] flex justify-end gap-[8px]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-[16px] py-[10px] text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isValid || sendFeedback.isPending}
              aria-busy={sendFeedback.isPending || undefined}
              className="rounded-md bg-primary px-[18px] py-[10px] text-sm font-semibold text-primary-foreground hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sendFeedback.isPending ? 'Enviando…' : 'Enviar relato'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalReportarErro;
