from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from src.models import User, PricingScenario
import uuid

class UserRepository:
    """
    Repositório para gerenciar operações da entidade User.
    """
    def __init__(self, session: Session):
        """
        Inicializa o repositório com uma sessão do banco de dados.

        Args:
            session (Session): Sessão SQLAlchemy ativa.
        """
        self.session = session

    def create_user(self, email: str, password_hash: str, auth_provider: str = "local") -> User:
        """
        Cria e persiste um novo usuário no banco de dados.

        Args:
            email (str): E-mail do usuário.
            password_hash (str): Hash criptografado da senha.
            auth_provider (str): Provedor de autenticação (padrão local).

        Returns:
            User: Objeto User recém criado.

        Raises:
            IntegrityError: Caso o e-mail já esteja cadastrado.
        """
        user = User(email=email, password_hash=password_hash, auth_provider=auth_provider)
        self.session.add(user)
        self.session.flush()
        return user

    def get_user_by_email(self, email: str) -> Optional[User]:
        """
        Busca um usuário no banco pelo seu endereço de e-mail.

        Args:
            email (str): Endereço de e-mail do usuário buscado.

        Returns:
            Optional[User]: O usuário correspondente ou None caso não exista.
        """
        return self.session.query(User).filter(User.email == email).first()

    def get_user_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        """
        Busca um usuário no banco pelo seu ID.

        Args:
            user_id (uuid.UUID): ID único do usuário.

        Returns:
            Optional[User]: O usuário correspondente ou None caso não exista.
        """
        return self.session.query(User).filter(User.id == user_id).first()


class PricingScenarioRepository:
    """
    Repositório para gerenciar operações da entidade PricingScenario.
    """
    def __init__(self, session: Session):
        """
        Inicializa o repositório com uma sessão do SQLAlchemy.

        Args:
            session (Session): Sessão SQLAlchemy ativa.
        """
        self.session = session

    def create_scenario(self, user_id: uuid.UUID, client_name: str, input_payload: dict, result_payload: dict) -> PricingScenario:
        """
        Cria e persiste um novo cenário de simulação de precificação.

        Args:
            user_id (uuid.UUID): ID do dono do cenário.
            client_name (str): Nome de referência do cliente consultado.
            input_payload (dict): Payload DTO de entradas usadas na simulação.
            result_payload (dict): Payload DTO de resultados do servidor.

        Returns:
            PricingScenario: O cenário recém persistido no banco.
        """
        scenario = PricingScenario(
            user_id=user_id,
            client_name=client_name,
            input_payload=input_payload,
            result_payload=result_payload
        )
        self.session.add(scenario)
        self.session.flush()
        return scenario

    def list_scenarios_by_user(self, user_id: uuid.UUID) -> List[PricingScenario]:
        """
        Lista todos os cenários vinculados a um usuário.

        Args:
            user_id (uuid.UUID): ID de busca do usuário.

        Returns:
            List[PricingScenario]: Uma lista de mapeamento com os cenários gerados pelo usuário.
        """
        return self.session.query(PricingScenario).filter(PricingScenario.user_id == user_id).all()

    def get_scenario_by_id(self, user_id: uuid.UUID, scenario_id: uuid.UUID) -> Optional[PricingScenario]:
        """
        Captura um cenário pelo seu ID desde que seja do usuário dono.

        Args:
            user_id (uuid.UUID): ID do cliente validatório.
            scenario_id (uuid.UUID): ID do cenário requisitado.

        Returns:
            Optional[PricingScenario]: O cenário ou None se não encontrado ou se pertencer a outro usuário.
        """
        return self.session.query(PricingScenario).filter(
            PricingScenario.id == scenario_id,
            PricingScenario.user_id == user_id
        ).first()

    def delete_scenario(self, user_id: uuid.UUID, scenario_id: uuid.UUID) -> bool:
        """
        Remove permanentemente um cenário do banco de dados atrelado ao usuário.

        Args:
            user_id (uuid.UUID): O ID do usuário dono.
            scenario_id (uuid.UUID): O ID do cenário.

        Returns:
            bool: True se o cenário foi encontrado e removido, False caso ele não exista.
        """
        scenario = self.get_scenario_by_id(user_id=user_id, scenario_id=scenario_id)
        if scenario:
            self.session.delete(scenario)
            self.session.flush()
            return True
        return False
