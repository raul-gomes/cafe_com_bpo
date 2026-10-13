import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminDeleteLesson, adminListLessons, adminSaveLesson } from '../../../api/platform';
import type { AdminLesson, LessonInput, LessonSection } from '../../../schemas/platform';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader';
import { FolderTabButton } from '../../../components/ui/folder-tab-button';
import { apiErrorText } from '../../../lib/adminFormat';
import { useConfirm } from '../../../components/ui/ConfirmDialog';

const LESSON_SECTION_LABELS: Record<LessonSection, string> = {
  'primeiros-passos': 'Primeiros passos (a ferramenta)',
  'bpo-primeiros-passos': 'BPO: primeiros passos',
  mentorias: 'Mentorias',
};

const EMPTY: LessonInput = {
  section: 'primeiros-passos',
  title: '',
  summary: '',
  video_url: '',
  position: 1,
  is_published: true,
};

/**
 * Admin › Aulas: YouTube lessons of the Aulas module, by section. A lesson can
 * be kept as a draft (not published) while the video is being prepared.
 *
 * @returns The page.
 */
export const AdminLessonsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { data: lessons } = useQuery({ queryKey: ['admin', 'lessons'], queryFn: adminListLessons });
  const [form, setForm] = useState<LessonInput>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'lessons'] });
    queryClient.invalidateQueries({ queryKey: ['lessons'] });
  };

  const save = useMutation({
    mutationFn: () =>
      adminSaveLesson(
        { ...form, summary: form.summary || null, video_url: form.video_url || null },
        editingId ?? undefined
      ),
    onSuccess: () => {
      toast.success(editingId ? 'Aula atualizada.' : 'Aula adicionada.');
      setForm(EMPTY);
      setEditingId(null);
      refresh();
    },
    onError: error => toast.error(apiErrorText(error, 'Não foi possível salvar a aula.')),
  });

  const remove = useMutation({ mutationFn: adminDeleteLesson, onSuccess: refresh });

  const edit = (lesson: AdminLesson) => {
    setEditingId(lesson.id);
    setForm({
      section: lesson.section as LessonSection,
      title: lesson.title,
      summary: lesson.summary ?? '',
      video_url: lesson.video_url ?? '',
      position: lesson.position,
      is_published: lesson.is_published,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onDelete = async (lesson: AdminLesson) => {
    const ok = await confirm({ title: 'Excluir esta aula?', message: `“${lesson.title}” sai do módulo Aulas.`, variant: 'danger' });
    if (ok) remove.mutate(lesson.id);
  };

  const set = <K extends keyof LessonInput>(key: K, value: LessonInput[K]) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div className="mx-auto max-w-[1080px]">
      <AdminPageHeader
        title="Aulas"
        lead="Cole o link do vídeo no YouTube (pode ser não listado). A aula aparece no módulo Aulas, na trilha escolhida, na ordem do número."
      />

      <form
        className="cafe-card mb-[28px] grid gap-[16px]"
        onSubmit={event => {
          event.preventDefault();
          if (form.title.trim().length >= 2) save.mutate();
        }}
      >
        <div className="grid gap-[16px] sm:grid-cols-[2fr_1fr_110px]">
          <label className="cafe-field">
            <span className="cafe-field-label">Título da aula</span>
            <input className="cafe-input" value={form.title} maxLength={150} onChange={e => set('title', e.target.value)} />
          </label>
          <label className="cafe-field">
            <span className="cafe-field-label">Trilha</span>
            <select className="cafe-select" value={form.section} onChange={e => set('section', e.target.value as LessonSection)}>
              {(Object.keys(LESSON_SECTION_LABELS) as LessonSection[]).map(key => (
                <option key={key} value={key}>{LESSON_SECTION_LABELS[key]}</option>
              ))}
            </select>
          </label>
          <label className="cafe-field">
            <span className="cafe-field-label">Ordem</span>
            <input className="cafe-input" type="number" min={0} max={999} value={form.position} onChange={e => set('position', Number(e.target.value) || 0)} />
          </label>
        </div>
        <label className="cafe-field">
          <span className="cafe-field-label">Link do YouTube</span>
          <input className="cafe-input" value={form.video_url ?? ''} onChange={e => set('video_url', e.target.value)} placeholder="https://www.youtube.com/watch?v=… ou https://youtu.be/…" />
          <span className="cafe-field-help">Sem link, a aula aparece como “Em breve”.</span>
        </label>
        <label className="cafe-field">
          <span className="cafe-field-label">Resumo (opcional)</span>
          <textarea className="cafe-textarea" rows={3} maxLength={1000} value={form.summary ?? ''} onChange={e => set('summary', e.target.value)} />
        </label>
        <label className="flex items-center gap-[10px] text-sm text-foreground">
          <input type="checkbox" checked={form.is_published} onChange={e => set('is_published', e.target.checked)} />
          Publicada (desmarque para guardar como rascunho)
        </label>
        <div className="flex flex-wrap gap-[8px]">
          <FolderTabButton type="submit" disabled={save.isPending || form.title.trim().length < 2}>
            {editingId ? 'Salvar alterações' : 'Adicionar aula'}
          </FolderTabButton>
          {editingId && (
            <button type="button" className="cafe-button cafe-button-secondary" onClick={() => { setEditingId(null); setForm(EMPTY); }}>
              Cancelar edição
            </button>
          )}
        </div>
      </form>

      {(Object.keys(LESSON_SECTION_LABELS) as LessonSection[]).map(section => {
        const items = (lessons ?? []).filter(lesson => lesson.section === section);
        return (
          <section key={section} className="mb-[24px]">
            <h2 className="mb-[10px] text-sm font-bold uppercase tracking-[0.11em] text-muted-foreground">{LESSON_SECTION_LABELS[section]}</h2>
            {items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-input bg-card p-[16px] text-sm text-muted-foreground">Nenhuma aula nesta trilha.</p>
            ) : (
              <ul className="grid gap-[8px]">
                {items.map(lesson => (
                  <li key={lesson.id} className="cafe-card flex flex-wrap items-center gap-[12px] p-[12px]">
                    {lesson.youtube_id ? (
                      <img src={`https://i.ytimg.com/vi/${lesson.youtube_id}/mqdefault.jpg`} alt="" className="h-[54px] w-[96px] rounded-md object-cover" />
                    ) : (
                      <span className="grid h-[54px] w-[96px] place-items-center rounded-md bg-muted text-xs text-muted-foreground">sem vídeo</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">{lesson.position}. {lesson.title}</p>
                      <p className="text-xs">
                        <span className={lesson.is_published ? 'cafe-tag cafe-tag-success' : 'cafe-tag cafe-tag-warning'}>
                          {lesson.is_published ? 'Publicada' : 'Rascunho'}
                        </span>
                      </p>
                    </div>
                    <button type="button" className="cafe-button cafe-button-secondary cafe-button-sm" onClick={() => edit(lesson)}>Editar</button>
                    <button type="button" className="cafe-button cafe-button-text cafe-button-sm" onClick={() => onDelete(lesson)}>Excluir</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
};
