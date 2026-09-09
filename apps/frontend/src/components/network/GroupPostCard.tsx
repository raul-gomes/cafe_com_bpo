import { ProjectGroupPost } from '../../api/network';
import { Card } from '../ui/card';

interface GroupPostCardProps {
  post: ProjectGroupPost;
}

export function GroupPostCard({ post }: GroupPostCardProps) {
  const authorName = post.author.name || post.author.email || 'Usuário';
  return (
    <Card className="flex flex-col p-0">
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[13px] font-bold text-foreground">
          {authorName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-bold text-foreground">
            {authorName}
          </div>
          <div className="text-[12px] text-muted-foreground">
            Postado em{' '}
            {new Date(post.created_at).toLocaleDateString('pt-BR')} às{' '}
            {new Date(post.created_at).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      </div>
      <div className="whitespace-pre-wrap px-6 py-5 text-[14px] leading-relaxed text-foreground">
        {post.body}
      </div>
    </Card>
  );
}