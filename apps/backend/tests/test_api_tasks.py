
from uuid import uuid4
from datetime import datetime, timedelta

def get_auth_header(client, email):
    payload = {"email": email, "password": "StrongPassword123!", "name": "Test User"}
    client.post("/auth/register", json=payload)
    resp = client.post("/auth/login", data={"username": email, "password": "StrongPassword123!"})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def create_client(client, auth_header, name="Empresa Teste", color="#FF5733"):
    payload = {
        "name": name,
        "cnpj": "12.345.678/0001-99",
        "color": color
    }
    resp = client.post("/clients/", json=payload, headers=auth_header)
    return resp.json()

def test_tasks_flow_red_phase(client):
    """
    Testa o fluxo completo de tarefas.
    Este teste deve FALHAR na Red Phase pois o endpoint e os campos ainda não existem.
    """
    email = f"task_user_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    
    # 1. Criar uma empresa para vincular a tarefa
    company = create_client(client, auth, name="BPO Solutions", color="#4287f5")
    assert "id" in company
    # Nota: Isso deve falhar se 'color' não existir no schema/model de Client
    assert company.get("color") == "#4287f5"
    
    client_id = company["id"]
    
    # 2. Criar uma tarefa (Deve falhar: POST /tasks/ não existe)
    deadline = (datetime.utcnow() + timedelta(days=5)).isoformat()
    task_payload = {
        "title": "Conciliação Mensal",
        "description": "Realizar a conciliação de todas as contas do cliente",
        "client_id": client_id,
        "deadline": deadline,
        "priority": "high",
        "status": "todo"
    }
    
    resp_create = client.post("/tasks/", json=task_payload, headers=auth)
    assert resp_create.status_code == 201
    task_data = resp_create.json()
    assert task_data["title"] == "Conciliação Mensal"
    assert task_data["priority"] == "high"
    assert task_data["status"] == "todo"
    
    task_id = task_data["id"]
    
    # 3. Listar tarefas (Deve falhar: GET /tasks/ não existe)
    resp_list = client.get("/tasks/", headers=auth)
    assert resp_list.status_code == 200
    tasks = resp_list.json()
    assert len(tasks) >= 1
    assert any(t["id"] == task_id for t in tasks)
    
    # 4. Atualizar tarefa (Deve falhar: PUT /tasks/{id} não existe)
    update_payload = {
        "status": "doing",
        "priority": "medium"
    }
    resp_update = client.put(f"/tasks/{task_id}", json=update_payload, headers=auth)
    assert resp_update.status_code == 200
    assert resp_update.json()["status"] == "doing"
    assert resp_update.json()["priority"] == "medium"
    
    # 5. Deletar tarefa (Deve falhar: DELETE /tasks/{id} não existe)
    resp_delete = client.delete(f"/tasks/{task_id}", headers=auth)
    assert resp_delete.status_code == 204
    
    # 6. Verificar se foi deletada
    resp_check = client.get(f"/tasks/", headers=auth)
    assert not any(t["id"] == task_id for t in resp_check.json())

def test_task_isolation(client):
    """Verifica se um usuário não consegue ver as tarefas de outro."""
    user_a = f"user_a_{uuid4()}@cafe.com"
    auth_a = get_auth_header(client, user_a)
    comp_a = create_client(client, auth_a, "Empresa A")
    
    user_b = f"user_b_{uuid4()}@cafe.com"
    auth_b = get_auth_header(client, user_b)
    create_client(client, auth_b, "Empresa B")
    
    # Usuário A cria tarefa
    client.post("/tasks/", json={
        "title": "Tarefa A",
        "client_id": comp_a["id"],
        "status": "todo",
        "priority": "low"
    }, headers=auth_a)
    
    # Usuário B tenta ver tarefas
    resp_b = client.get("/tasks/", headers=auth_b)
    assert resp_b.status_code == 200
    assert len(resp_b.json()) == 0 # B não deve ver a tarefa de A
