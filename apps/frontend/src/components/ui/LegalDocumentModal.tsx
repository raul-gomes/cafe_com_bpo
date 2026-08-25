import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';

interface LegalDocumentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  content: string;
}

export const LegalDocumentModal: React.FC<LegalDocumentModalProps> = ({
  open,
  onOpenChange,
  title,
  content,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:!max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div
          className="legal-document prose prose-sm dark:prose-invert max-h-[60vh] overflow-y-auto pr-2
            [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2
            [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-foreground
            [&_ol]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-1.5
            [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1
            [&_li]:text-[13px] [&_li]:text-muted-foreground [&_li]:leading-relaxed
            [&_p]:text-[13px] [&_p]:text-muted-foreground
            [&_strong]:text-foreground"
          dangerouslySetInnerHTML={{ __html: content }}
        />

        <div className="flex justify-end pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
