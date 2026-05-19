# Galeria em Duas Seções — Especificação

## Objetivo

Dividir a galeria de arquivos em duas seções distintas:
1. **Arquivos Comunitários** — disponíveis para download de todos os usuários, apenas administradores podem gerenciar
2. **Meus Arquivos** — cada usuário gerencia seus próprios arquivos (upload/exclusão)

---

## Modelos de Dados

### User — nova coluna

```python
# Adicionar em src/modules/auth/models.py
role = Column(String(20), server_default="user", nullable=False)
# Valores esperados: "user" | "admin"
```

### CommonGalleryItem — nova tabela

```python
# Adicionar em src/modules/gallery/models.py

class CommonGalleryItem(Base):
    __tablename__ = "common_gallery_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=False)
    file_size = Column(Integer, nullable=False)
    title = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    created_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    uploader = relationship("User", foreign_keys=[created_by])
```

A tabela `gallery_items` existente **não é alterada**.

---

## Schemas

```python
# Adicionar em src/modules/gallery/schemas.py

class CommonGalleryItemResponse(BaseModel):
    id: UUID
    file_name: str
    file_type: str
    file_size: int
    title: Optional[str] = None
    description: Optional[str] = None
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

```python
# Adicionar campo em src/modules/auth/schemas.py

class UserResponse(BaseModel):
    ...
    role: str = "user"  # Novo campo
```

---

## Repositório

```python
# Adicionar em src/modules/gallery/repository.py

class CommonGalleryRepository:
    def __init__(self, session: Session):
        self.session = session

    def list_all(self) -> list[CommonGalleryItem]:
        return self.session.query(CommonGalleryItem).order_by(
            CommonGalleryItem.created_at.desc()
        ).all()

    def create(self, data: dict, created_by: UUID) -> CommonGalleryItem:
        item = CommonGalleryItem(**data, created_by=created_by)
        self.session.add(item)
        self.session.commit()
        self.session.refresh(item)
        return item

    def get_by_id(self, item_id: UUID) -> CommonGalleryItem | None:
        return self.session.query(CommonGalleryItem).filter(
            CommonGalleryItem.id == item_id
        ).first()

    def delete(self, item: CommonGalleryItem) -> None:
        self.session.delete(item)
        self.session.commit()
```

---

## Dependency — require_admin

```python
# Adicionar em src/modules/auth/service.py

async def require_admin(
    current_user: UserResponse = Depends(get_current_user),
) -> UserResponse:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores",
        )
    return current_user
```

---

## Endpoints

### Rotas existentes (inalteradas)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| `GET` | `/gallery/` | user | Lista arquivos do usuário |
| `POST` | `/gallery/upload` | user | Upload do usuário |
| `DELETE` | `/gallery/{id}` | user | Excluir próprio arquivo |
| `GET` | `/gallery/download/{filename}` | — | Download (qualquer um) |

### Novas rotas

| Método | Rota | Auth | Role | Descrição |
|--------|------|------|------|-----------|
| `GET` | `/gallery/common` | ❌ | — | Listar arquivos comunitários |
| `POST` | `/gallery/common/upload` | ✅ | admin | Upload de arquivo comunitário |
| `DELETE` | `/gallery/common/{id}` | ✅ | admin | Excluir arquivo comunitário |
| `GET` | `/gallery/common/download/{filename}` | ❌ | — | Download de arquivo comunitário |

### Exemplo de implementação no router

```python
@router.get("/common", response_model=List[CommonGalleryItemResponse])
def list_common_files(
    repo: Annotated[CommonGalleryRepository, Depends(get_common_repo)],
):
    """Lista arquivos comunitários. Não requer autenticação."""
    return repo.list_all()


@router.post("/common/upload", response_model=CommonGalleryItemResponse, status_code=201)
async def upload_common_file(
    admin: Annotated[UserResponse, Depends(require_admin)],
    repo: Annotated[CommonGalleryRepository, Depends(get_common_repo)],
    file: UploadFile = File(...),
    title: str = Query(default=""),
    description: str = Query(default=""),
):
    # Validações: extensão, tamanho (mesmas regras da gallery existente)
    safe_filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(COMMON_STORAGE_DIR, safe_filename)
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    item = repo.create(
        data={
            "file_name": file.filename,
            "file_type": file.content_type or "application/octet-stream",
            "file_size": len(content),
            "file_path": f"/gallery/common/download/{safe_filename}",
            "title": title or None,
            "description": description or None,
        },
        created_by=admin.id,
    )
    return item


@router.delete("/common/{item_id}", status_code=204)
def delete_common_file(
    item_id: UUID,
    admin: Annotated[UserResponse, Depends(require_admin)],
    repo: Annotated[CommonGalleryRepository, Depends(get_common_repo)],
):
    item = repo.get_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    # Remove arquivo físico
    local_path = os.path.join(COMMON_STORAGE_DIR, os.path.basename(item.file_path))
    if os.path.exists(local_path):
        os.remove(local_path)
    repo.delete(item)


@router.get("/common/download/{filename}")
def download_common_file(filename: str):
    """Serve arquivo comunitário para download."""
    safe = os.path.basename(filename)
    filepath = os.path.join(COMMON_STORAGE_DIR, safe)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    return FileResponse(path=filepath, filename=safe, media_type="application/octet-stream")
```

---

## Storage

```
storage/gallery/           → arquivos dos usuário (já existe, inalterado)
storage/gallery/common/    → arquivos comunitários (novo)
```

Constante no router:
```python
COMMON_STORAGE_DIR = "storage/gallery/common"
os.makedirs(COMMON_STORAGE_DIR, exist_ok=True)
```

---

## Frontend — GaleriaArquivosPage

### Layout

Duas abas no topo da página:

```
[ Meus Arquivos ]  [ Comunitários ]
       ↑ aba ativa por padrão
```

### Aba "Meus Arquivos" (padrão)

- Busca de `GET /gallery/`
- Botão de upload (já existe)
- Botão de excluir por arquivo (já existe)
- Comportamento atual, sem alterações

### Aba "Comunitários"

- Busca de `GET /gallery/common`
- Lista somente leitura: sem botões de upload/excluir
- Cada item tem apenas botão de download
- **Se o usuário logado for admin**: mostrar botão de upload e botão de excluir por arquivo

### Verificação de role

```typescript
// O role vem no UserResponse via /auth/me
const { user } = useAuth();
const isAdmin = user?.role === 'admin';
```

---

## Migrations

### Migration 1: `add_role_to_users`

```python
def upgrade():
    op.add_column("users", sa.Column("role", sa.String(20),
                  server_default="user", nullable=False))

def downgrade():
    op.drop_column("users", "role")
```

### Migration 2: `add_common_gallery_items_table`

```python
def upgrade():
    op.create_table(
        "common_gallery_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("file_type", sa.String(50), nullable=False),
        sa.Column("file_size", sa.Integer, nullable=False),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

def downgrade():
    op.drop_table("common_gallery_items")
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/modules/auth/models.py` | + coluna `role` no User |
| `src/modules/auth/schemas.py` | + campo `role` no UserResponse |
| `src/modules/auth/service.py` | + função `require_admin` |
| `src/modules/gallery/models.py` | + classe `CommonGalleryItem` |
| `src/modules/gallery/schemas.py` | + `CommonGalleryItemResponse` |
| `src/modules/gallery/repository.py` | + `CommonGalleryRepository` |
| `src/modules/gallery/router.py` | + 4 endpoints, + `COMMON_STORAGE_DIR` |
| `alembic/env.py` | + import de `CommonGalleryItem` |
| `alembic/versions/` | + 2 migrations |
| `frontend/.../GaleriaArquivosPage.tsx` | + abas + lógica de role |
| `.gitignore` | adicionar `docs/implementacao/` se necessário |

---

## Não quebra

- `gallery_items` existente não é alterada
- `User` ganha coluna com `server_default`, registros antigos viram `"user"`
- `UserResponse` ganha campo com default, frontend antigo ignora
- Endpoints antigos continuam funcionando
- Novos endpoints estão em `/gallery/common/*`, sem conflito
