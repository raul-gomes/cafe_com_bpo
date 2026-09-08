import React, { useEffect, useState } from 'react';
import { Briefcase } from 'lucide-react';
import {
  getProjects,
  createProject,
  deleteProject,
  ProjectResponse,
  PaginatedProjects,
  RemoteType,
} from '../../api/network';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../ui/ConfirmDialog';
import { ProjectCard } from './ProjectCard';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Skeleton } from '../ui/skeleton';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectValue,
  SelectItem,
} from '../ui/select';
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
  const [teamSize, setTeamSize] = useState('1');
  const [remoteType, setRemoteType] = useState<RemoteType>('remote');

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
    setShowForm(false);
    setTitle('');
    setDescription('');
    setSkills([]);
    setTeamSize('1');
    setRemoteType('remote');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Preencha título e descrição do projeto.');
      return;
    }
    const size = parseInt(teamSize, 10);
    if (!Number.isInteger(size) || size < 1 || size > 99) {
      setError('Informe um tamanho de equipe entre 1 e 99.');
      return;
    }
    try {
      await createProject({
        title: title.trim(),
        description: description.trim(),
        skills,
        team_size: size,
        remote_type: remoteType,
      });
      resetForm();
      setError('');
      loadProjects();
    } catch {
      setError('Erro ao publicar o projeto. Tente novamente.');
    }
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

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">
          Publique os projetos que você quer desenvolver e encontre profissionais
          de BPO compatíveis com as habilidades necessárias.
        </p>
        <Button
          variant={showForm ? 'ghost' : 'default'}
          onClick={() => setShowForm(!showForm)}
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="project-team-size"
                    className="text-[13px] font-medium text-foreground/80"
                  >
                    Tamanho da Equipe
                  </label>
                  <Input
                    id="project-team-size"
                    aria-label="Tamanho da equipe"
                    type="number"
                    min={1}
                    max={99}
                    value={teamSize}
                    onChange={(e) => setTeamSize(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="project-remote"
                    className="text-[13px] font-medium text-foreground/80"
                  >
                    Modalidade
                  </label>
                  <Select
                    value={remoteType}
                    onValueChange={(value) => setRemoteType((value as RemoteType) ?? 'remote')}
                  >
                    <SelectTrigger id="project-remote" aria-label="Modalidade do projeto">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="remote">Remoto</SelectItem>
                      <SelectItem value="onsite">Presencial</SelectItem>
                      <SelectItem value="hybrid">Híbrido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-border px-6 py-4">
              <Button type="submit" variant="default">
                Publicar Projeto
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
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}