import React, { useEffect, useState, useRef } from 'react';
import { apiClient } from '../../api/client';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '../../components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

interface GalleryFile {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  title: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

const BASE_URL = (apiClient.defaults.baseURL || '/api').replace(/\/+$/, '');

export const GaleriaArquivosPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState<'my' | 'common'>('my');
  const [files, setFiles] = useState<GalleryFile[]>([]);
  const [commonFiles, setCommonFiles] = useState<GalleryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tab === 'my') fetchFiles();
    else fetchCommonFiles();
  }, [tab]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await apiClient.get<GalleryFile[]>('/gallery/');
      setFiles(resp.data);
    } catch (err) {
      console.error('Erro ao carregar arquivos:', err);
      setError(
        'Não foi possível carregar os arquivos. Verifique sua conexão e tente novamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchCommonFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await apiClient.get<GalleryFile[]>('/gallery/common');
      setCommonFiles(resp.data);
    } catch (err) {
      console.error('Erro ao carregar arquivos comunitários:', err);
      setError('Não foi possível carregar os arquivos comunitários.');
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M10 13a1 1 0 011 1v1a1 1 0 01-1 1H9a1 1 0 01-1-1v-1a1 1 0 011-1h1z" />
          <path d="M12 11l2 2-2 2" />
        </svg>
      );
    }
    if (['xls', 'xlsx', 'csv'].includes(ext)) {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M8 13h2" />
          <path d="M8 17h2" />
          <path d="M14 13h2" />
          <path d="M14 17h2" />
        </svg>
      );
    }
    if (['doc', 'docx'].includes(ext)) {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
          <path d="M10 9H8" />
        </svg>
      );
    }
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
        <polyline points="13 2 13 9 20 9" />
      </svg>
    );
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    try {
      setUploading(true);
      setUploadProgress(0);
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (uploadTitle) formData.append('title', uploadTitle);
      if (uploadDescription) formData.append('description', uploadDescription);

      const url = tab === 'common' ? '/gallery/common/upload' : '/gallery/upload';
      await apiClient.post(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent: any) => {
          const percent = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1)
          );
          setUploadProgress(percent);
        },
      });

      toast.success('Arquivo enviado com sucesso!');
      resetUploadForm();
      if (tab === 'my') await fetchFiles();
      else await fetchCommonFiles();
    } catch (err: any) {
      console.error('Erro ao enviar arquivo:', err);
      toast.error(err.response?.data?.detail || 'Erro ao enviar arquivo.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (file: GalleryFile) => {
    const ok = await confirm({
      title: 'Excluir arquivo',
      message: `Deseja excluir "${file.file_name}"?`,
      variant: 'danger',
      confirmLabel: 'Excluir',
    });
    if (!ok) return;
    try {
      const url =
        tab === 'common' ? `/gallery/common/${file.id}` : `/gallery/${file.id}`;
      await apiClient.delete(url);
      toast.success('Arquivo excluído.');
      if (tab === 'my')
        setFiles(prev => prev.filter(f => f.id !== file.id));
      else setCommonFiles(prev => prev.filter(f => f.id !== file.id));
    } catch (err: any) {
      console.error('Erro ao excluir:', err);
      toast.error(err.response?.data?.detail || 'Erro ao excluir arquivo.');
    }
  };

  const resetUploadForm = () => {
    setSelectedFile(null);
    setUploadTitle('');
    setUploadDescription('');
    setShowUploadForm(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = (file: GalleryFile) => {
    window.open(`${BASE_URL}${file.file_path}`, '_blank');
  };

  const currentFiles = tab === 'my' ? files : commonFiles;
  const filteredFiles = currentFiles.filter(
    f =>
      f.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.title && f.title.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="animate-[panelFadeIn_0.4s_ease-out]">
      <Breadcrumb
        items={[
          { label: 'Painel', to: '/painel' },
          { label: 'Galeria de Arquivos' },
        ]}
      />

      {/* Header */}
      <div className="mb-7 flex items-start justify-between">
        <div>
          <h1 className="text-[32px] font-extrabold tracking-tight text-foreground">
            Galeria de Arquivos
          </h1>
          <p className="text-[14px] text-muted-foreground">
            Armazene modelos, documentos e arquivos importantes da sua operação.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative w-[300px]">
            <Input
              type="text"
              placeholder="Buscar arquivos..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9"
            />
            <svg
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          {(tab === 'my' || isAdmin) && (
            <Button variant="default" onClick={() => setShowUploadForm(true)}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Enviar Arquivo
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(val) => setTab(val as 'my' | 'common')}>
        <TabsList className="mb-6">
          <TabsTrigger value="my">Meus Arquivos</TabsTrigger>
          <TabsTrigger value="common">Comunitários</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Upload Dialog */}
      <Dialog
        open={showUploadForm}
        onOpenChange={(open) => {
          if (!open) resetUploadForm();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar Arquivo</DialogTitle>
            <DialogDescription>
              Selecione ou arraste um arquivo para enviar para a galeria.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 px-6">
            {/* Drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-all',
                dragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30'
              )}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.ppt,.pptx,.txt,.csv"
                className="hidden"
              />
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke={dragOver ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mx-auto mb-3"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {selectedFile ? (
                <p className="text-[14px] font-semibold text-foreground">
                  {selectedFile.name}
                </p>
              ) : (
                <>
                  <p className="text-[14px] text-foreground">
                    Arraste o arquivo aqui ou clique para selecionar
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/70">
                    PDF, DOC, XLS, PNG, JPG, etc. Máximo 10MB.
                  </p>
                </>
              )}
              {uploading && (
                <div className="mt-3">
                  <div className="h-1 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground/70">
                    {uploadProgress}% enviado
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-medium text-foreground/80">
                Título
              </label>
              <Input
                type="text"
                value={uploadTitle}
                onChange={e => setUploadTitle(e.target.value)}
                placeholder="Nome descritivo"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-medium text-foreground/80">
                Descrição
              </label>
              <Textarea
                value={uploadDescription}
                onChange={e => setUploadDescription(e.target.value)}
                placeholder="Descreva o conteúdo do arquivo..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter showCloseButton={false}>
            <Button variant="ghost" onClick={resetUploadForm} disabled={uploading}>
              Cancelar
            </Button>
            <Button
              variant="default"
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
            >
              {uploading ? `Enviando... ${uploadProgress}%` : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
                Arquivo
              </TableHead>
              <TableHead className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
                Tipo
              </TableHead>
              <TableHead className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
                Tamanho
              </TableHead>
              <TableHead className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
                Data
              </TableHead>
              <TableHead className="px-6 py-4 text-right text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="px-6 py-16 text-center"
                >
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="hsl(var(--destructive))"
                    strokeWidth="1.5"
                    className="mx-auto mb-4 opacity-50"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <h3 className="mb-2 text-[16px] font-bold text-foreground">
                    Erro ao carregar
                  </h3>
                  <p className="mb-5 text-[14px] text-muted-foreground">{error}</p>
                  <Button variant="default" onClick={tab === 'my' ? fetchFiles : fetchCommonFiles}>
                    Tentar Novamente
                  </Button>
                </TableCell>
              </TableRow>
            ) : loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="px-6 py-4">
                    <Skeleton className="h-4 w-[200px]" />
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <Skeleton className="h-4 w-[60px]" />
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <Skeleton className="h-4 w-[40px]" />
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <Skeleton className="h-4 w-[80px]" />
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    <Skeleton className="ml-auto h-8 w-8 rounded" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredFiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-6 py-16 text-center">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    className="mx-auto mb-4 opacity-30"
                  >
                    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                  </svg>
                  <p className="text-[14px] text-muted-foreground">
                    {searchTerm
                      ? 'Nenhum arquivo encontrado para esta busca.'
                      : 'Nenhum arquivo enviado. Comece enviando seus documentos.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredFiles.map(file => {
                const ext = file.file_name.split('.').pop() || '';
                return (
                  <TableRow key={file.id}>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {getFileIcon(file.file_name)}
                        <div>
                          <span
                            className="cursor-pointer font-semibold text-foreground transition-colors hover:text-primary hover:underline"
                            onClick={() => handleDownload(file)}
                          >
                            {file.title || file.file_name}
                          </span>
                          {file.description && (
                            <p className="max-w-[300px] truncate text-[11px] text-muted-foreground/70">
                              {file.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                        {ext || 'Arquivo'}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-[13px] text-muted-foreground">
                      {formatSize(file.file_size)}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-[13px] text-muted-foreground">
                      {new Date(file.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(file)}
                          title="Baixar"
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="hsl(var(--primary))"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </Button>
                        {(tab === 'my' || isAdmin) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(file)}
                            title="Excluir"
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#ef4444"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            </svg>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};
