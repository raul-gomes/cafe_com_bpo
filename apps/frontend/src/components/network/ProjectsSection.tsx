import React, { useEffect, useState } from 'react';
import { Briefcase, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  searchProfessionals,
  ProfessionalMatch,
  ProjectResponse,
  ProjectUpdatePayload,
  PaginatedProjects,
} from '../../api/network';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../ui/ConfirmDialog';
import { ProjectCard } from './ProjectCard';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Skeleton } from '../ui/skeleton';
import { SkillInput } from '../ui/SkillInput';

export function ProjectsSection() {
  const { user } = useAuth();
  const confirm = useConfirm();

  const [data, setData] = useState<PaginatedProjects | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState<string[]>([]);

  const [matches, setMatches] = useState<ProfessionalMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [candidates, setCandidates] = useState<
    { id: string; name: string | null; email: string; message: string }[]
  >([]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const resp = await getProjects(20);
      setData(resp);
      setError('');
    } catch {
      setError(
        'Erro ao carregar o mural de projetos. Verifique sua conexão e tente novamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSkills([]);
    setMatches([]);
    setSearching(false);
    setSearchError('');
    setCandidates([]);
  };

  useEffect(() => {
    if (skills.length === 0) {
      setMatches([]);
      setSearching(false);
      setSearchError('');
      return;
    }
    setSearching(true);
    setSearchError('');
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const results = await searchProfessionals(skills, 'any');
        if (!cancelled) setMatches(results);
      } catch {
        if (!cancelled) {
          setSearchError('Erro ao buscar profissionais. Tente novamente.');
          setMatches([]);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [skills]);

  const addCandidate = (person: ProfessionalMatch) => {
    setCandidates((prev) =>
      prev.some((c) => c.id === person.id)
        ? prev
        : [
            ...prev,
            { id: person.id, name: person.name, email: person.email, message: '' },
          ]
    );
  };

  const removeCandidate = (id: string) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
  };

  const updateCandidateMessage = (id: string, message: string) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, message } : c))
    );
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  const openCreate = () => {
    closeForm();
    setShowForm(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Preencha título e descrição do projeto.');
      return;
    }
    if (description.trim().length < 10) {
      setError('A descrição precisa ter pelo menos 10 caracteres.');
      return;
    }
    if (candidates.length > 0 && candidates.some((c) => !c.message.trim())) {
      setError(
        'Preencha a mensagem personalizada de cada profissional selecionado.'
      );
      return;
    }
    try {
      await createProject({
        title: title.trim(),
        description: description.trim(),
        skills,
        ...(candidates.length > 0
          ? {
              invites: candidates.map((c) => ({
                invited_user_id: c.id,
                message: c.message.trim(),
              })),
            }
          : {}),
      });
      closeForm();
      setError('');
      loadProjects();
    } catch {
      setError('Erro ao salvar o projeto. Tente novamente.');
    }
  };

  const handleSaveProject = async (
    project: ProjectResponse,
    payload: ProjectUpdatePayload
  ) => {
    await updateProject(project.id, payload);
    await loadProjects();
  };

  const handleDelete = async (project: ProjectResponse) => {
    const ok = await confirm({
      variant: 'danger',
      title: 'Excluir projeto',
      message: `O projeto "${project.title}" será removido do mural. Esta ação não pode ser desfeita.`,
    });
    if (!ok) return;
    try {
      await deleteProject(project.id);
      setError('');
      loadProjects();
    } catch {
      setError('Erro ao excluir o projeto. Tente novamente.');
    }
  };

  const handleUpdated = (updated: ProjectResponse) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((p) =>
              p.id === updated.id ? updated : p
            ),
          }
        : prev
    );
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">
          Publique os projetos que você quer desenvolver e encontre profissionais
          de BPO compatíveis com as habilidades necessárias.
        </p>
        <Button
          variant={showForm ? 'ghost' : 'default'}
          onClick={() => (showForm ? closeForm() : openCreate())}
        >
          {showForm ? 'Cancelar' : 'Criar Projeto'}
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-[14px] text-destructive">
          {error}
        </div>
      )}

      {showForm && (
        <Card className="mb-8 p-0">
          <div className="border-b border-border px-6 py-4">
            <h3 className="m-0 text-[18px] font-semibold text-foreground">
              Novo Projeto
            </h3>
          </div>
          <form onSubmit={handleCreate}>
            <div className="flex flex-col gap-4 p-6">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="project-title"
                  className="text-[13px] font-medium text-foreground/80"
                >
                  Título do Projeto
                </label>
                <Input
                  id="project-title"
                  aria-label="Título do projeto"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Implantação de BPO financeiro"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="project-description"
                  className="text-[13px] font-medium text-foreground/80"
                >
                  Descrição
                </label>
                <Textarea
                  id="project-description"
                  aria-label="Descrição do projeto"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva o escopo do projeto e o que você espera dos profissionais..."
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-foreground/80">
                  Habilidades necessárias
                </label>
                <SkillInput
                  value={skills}
                  onChange={setSkills}
                  placeholder="Digite uma habilidade e pressione Tab ou Enter"
                />
                <p className="text-[11px] text-muted-foreground">
                  Os perfis compatíveis aparecem assim que você digita as
                  habilidades.
                </p>
              </div>

              <div className="flex flex-col gap-2 border-t border-border pt-4">
                {skills.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {searching && matches.length === 0 ? (
                      <div className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-4 text-[13px] text-muted-foreground">
                        <Loader2 size={14} className="animate-spin" />
                        Buscando profissionais...
                      </div>
                    ) : searchError ? (
                      <p className="text-xs text-destructive" role="alert">
                        {searchError}
                      </p>
                    ) : matches.length === 0 ? (
                      <div className="rounded-lg border border-dashed px-4 py-5 text-center text-[13px] text-muted-foreground">
                        Nenhum profissional encontrado com essas habilidades.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {matches.map((person) => {
                          const added = candidates.some(
                            (c) => c.id === person.id
                          );
                          return (
                            <div
                              key={person.id}
                              className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                            >
                              <div className="min-w-0">
                                <div className="text-[14px] font-semibold text-foreground">
                                  {person.name || person.email}
                                </div>
                                {person.biografia && (
                                  <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">
                                    {person.biografia}
                                  </p>
                                )}
                                {person.skills.length > 0 && (
                                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {person.skills.map((skill) => (
                                      <span
                                        key={skill.id}
                                        className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary-strong"
                                      >
                                        {skill.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <Button
                                variant={added ? 'ghost' : 'outline'}
                                size="sm"
                                disabled={added}
                                onClick={() => addCandidate(person)}
                              >
                                {added ? (
                                  <>
                                    <CheckCircle2 size={14} className="mr-1.5" />
                                    Adicionado
                                  </>
                                ) : (
                                  'Adicionar'
                                )}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {candidates.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-[12px] font-semibold text-muted-foreground">
                      Profissionais selecionados ({candidates.length})
                    </p>
                    {candidates.map((candidate) => (
                      <div
                        key={candidate.id}
                        className="rounded-lg border border-border p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-[14px] font-semibold text-foreground">
                            {candidate.name || candidate.email}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCandidate(candidate.id)}
                            aria-label={`Remover ${candidate.name || candidate.email}`}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                        <Textarea
                          className="mt-2"
                          aria-label={`Mensagem para ${candidate.name || candidate.email}`}
                          rows={2}
                          value={candidate.message}
                          onChange={(e) =>
                            updateCandidateMessage(candidate.id, e.target.value)
                          }
                          placeholder="Mensagem personalizada do convite"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end border-t border-border px-6 py-4">
              <Button type="submit" variant="default">
                Salvar Projeto
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-[60%]" />
                <Skeleton className="h-3 w-[40%]" />
              </div>
            </Card>
          ))}
        </div>
      ) : data && data.items.length === 0 && !showForm ? (
        <Card className="p-12 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Briefcase size={26} />
          </div>
          <h3 className="mb-2 text-[18px] font-bold text-foreground">
            Nenhum projeto publicado
          </h3>
          <p className="text-[14px] text-muted-foreground">
            Seja o primeiro a publicar um projeto e encontrar profissionais de BPO.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {data?.items.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              currentUserId={user?.id}
              onSave={handleSaveProject}
              onDelete={handleDelete}
              onUpdated={handleUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
}