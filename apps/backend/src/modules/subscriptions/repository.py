"""Queries over the plan catalog, a subscriber's subscription and their billing.

Three repositories, because the three tables answer different questions.

`PlanRepository` is read-only apart from `add`: the plan row is the price
authority (§17.1), so it deliberately offers no `update` and no `delete`. A plan
leaves the catalog through `is_active`, never by disappearing —
`subscriptions.plan_id` is `ON DELETE RESTRICT`, and a plan nobody references
would still be shown to the checkout as something to buy.

`SubscriptionRepository` owns the local mirror, including the "one live
subscription per person" rule that the partial unique index
`uq_subscriptions_open_per_user` enforces in the database.

`BillingProfileRepository` holds the document and the address of §17.8, keyed by
user, so the checkout does not ask for them twice.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.modules.subscriptions.models import (
    SUBSCRIPTION_STATUS_CANCELED,
    BillingProfile,
    Plan,
    Subscription,
)
from src.modules.subscriptions.schemas import BillingData


class PlanRepository:
    """Data access for `plans`.

    Args:
        session: Database session.
    """

    def __init__(self, session: Session) -> None:
        self.session = session

    def list_plans(self, *, active_only: bool) -> list[Plan]:
        """Lists the catalog ordered by creation, so the oldest plan stays first.

        Args:
            active_only: When true, deactivated plans are left out — that is what
                a non-admin caller is allowed to see.

        Returns:
            The plans, newest last.
        """
        query = self.session.query(Plan)
        if active_only:
            query = query.filter(Plan.is_active.is_(True))
        return query.order_by(Plan.created_at, Plan.code).all()

    def get_by_id(self, plan_id: UUID) -> Plan | None:
        """Finds a plan by its id.

        Args:
            plan_id: Plan id.

        Returns:
            The plan, or `None` when it does not exist.
        """
        return self.session.get(Plan, plan_id)

    def get_by_code(self, code: str) -> Plan | None:
        """Finds a plan by its business key.

        Args:
            code: Plan code, already normalized to lowercase.

        Returns:
            The plan, or `None` when the code is free.
        """
        return self.session.query(Plan).filter(Plan.code == code).one_or_none()

    def add(self, plan: Plan) -> Plan:
        """Registers a new plan and flushes it so the id exists.

        Args:
            plan: Plan to persist.

        Returns:
            The persisted plan.
        """
        self.session.add(plan)
        self.session.flush()
        return plan

    def count_subscribers(self, plan_id: UUID) -> int:
        """Counts the subscriptions pointing at a plan.

        Args:
            plan_id: Plan id.

        Returns:
            How many subscriptions reference the plan.
        """
        return (
            self.session.query(func.count(Subscription.id))
            .filter(Subscription.plan_id == plan_id)
            .scalar()
            or 0
        )


class SubscriptionRepository:
    """Reads and writes the local mirror of a subscription.

    §6 says the repository owns the query, so the uniqueness rule of
    `subscriptions` (`uq_subscriptions_open_per_user`) is enforced here and not
    in the router: the partial index only covers non-canceled rows, and "does
    this person already have one" is a question about data, not about the
    request.
    """

    def __init__(self, session: Session) -> None:
        """Binds the repository to a session.

        Args:
            session: Database session.
        """
        self.session = session

    def get_open_for_user(self, user_id: UUID) -> Subscription | None:
        """Returns the subscription that still holds the person's seat.

        A canceled row is history and must not block a new purchase, which is why
        the filter matches the partial unique index instead of "the newest row".

        Args:
            user_id: Authenticated user.

        Returns:
            The live subscription, or `None` when the person may subscribe.
        """
        return (
            self.session.query(Subscription)
            .filter(
                Subscription.user_id == user_id,
                Subscription.status != SUBSCRIPTION_STATUS_CANCELED,
            )
            .order_by(Subscription.created_at.desc())
            .first()
        )

    def add(self, subscription: Subscription) -> Subscription:
        """Registers the local row and flushes it so the id exists.

        The id is needed before the provider is called, because it travels as
        `externalReference` and is what Fase 5 matches the confirmation on.

        Args:
            subscription: Row to persist.

        Returns:
            The persisted subscription.
        """
        self.session.add(subscription)
        self.session.flush()
        return subscription

    def get_by_checkout_id(self, checkout_id: str) -> Subscription | None:
        """Finds the row by the hosted checkout session that belongs to it.

        This is the only key a `CHECKOUT_*` webhook payload carries (P-16).

        Args:
            checkout_id: Checkout session id assigned by Asaas.

        Returns:
            The matching subscription, or `None`.
        """
        return (
            self.session.query(Subscription)
            .filter(Subscription.asaas_checkout_id == checkout_id)
            .one_or_none()
        )

    def get_by_provider_subscription_id(self, provider_id: str) -> Subscription | None:
        """Finds the row by the provider's subscription id.

        Args:
            provider_id: Subscription id assigned by Asaas.

        Returns:
            The matching subscription, or `None`.
        """
        return (
            self.session.query(Subscription)
            .filter(Subscription.asaas_subscription_id == provider_id)
            .one_or_none()
        )

    def get_by_external_reference(self, reference: str) -> Subscription | None:
        """Finds the row by an `externalReference` the provider sent back.

        The reference is our own id, so anything that is not a UUID is by
        definition not one of our rows — rejected before it reaches a query.

        Args:
            reference: Value of `externalReference`.

        Returns:
            The matching subscription, or `None` when the reference is absent
            from the payload, malformed, or unknown.
        """
        try:
            subscription_id = UUID(reference)
        except (ValueError, TypeError, AttributeError):
            return None
        return self.session.get(Subscription, subscription_id)

    def delete(self, subscription: Subscription) -> None:
        """Removes a row that never became history.

        An abandoned checkout (`incomplete`) is not something anyone paid for,
        and while it exists the partial unique index answers 409 to every new
        attempt. The row is deleted without committing — the webhook commits
        once, together with its event record.

        Args:
            subscription: The row to remove.
        """
        self.session.delete(subscription)
        self.session.flush()


class BillingProfileRepository:
    """Reads and writes the billing data of §17.8.

    Every method is scoped by `user_id`: the document and the address of one
    person must never reach another. Authorization here, not only in the router,
    because the router only knows who is logged in, not who owns the row.
    """

    def __init__(self, session: Session) -> None:
        """Stores the session the queries run on.

        Args:
            session: Request-scoped database session.
        """
        self.session = session

    def get_for_user(self, user_id: UUID) -> BillingProfile | None:
        """Returns the saved billing profile, if there is one.

        Args:
            user_id: Authenticated user.

        Returns:
            Their profile, or `None` when they never saved one.
        """
        return (
            self.session.query(BillingProfile)
            .filter(BillingProfile.user_id == user_id)
            .one_or_none()
        )

    def save(
        self, user_id: UUID, billing: BillingData, now: datetime | None = None
    ) -> BillingProfile:
        """Creates or updates the profile and flushes it.

        Upsert rather than insert: a person correcting their address must not hit
        a unique constraint, and silently keeping the old value would leave the
        provider billing an address they no longer live at.

        Args:
            user_id: Authenticated user.
            billing: Normalized billing data.
            now: Timestamp of the update, injected so tests do not depend on the
                wall clock.

        Returns:
            The persisted profile.
        """
        profile = self.get_for_user(user_id)
        if profile is None:
            profile = BillingProfile(user_id=user_id)
            self.session.add(profile)

        for field in (
            "cpf_cnpj",
            "phone",
            "address",
            "address_number",
            "complement",
            "city",
            "state",
            "postal_code",
        ):
            setattr(profile, field, getattr(billing, field))

        if now is not None:
            profile.updated_at = now
        self.session.flush()
        return profile

    def differs_from(self, profile: BillingProfile, billing: BillingData) -> bool:
        """Tells whether new data would change what is stored.

        Used to skip a provider call: PUT-ing an unchanged address on every
        checkout would make each attempt depend on an external service for
        nothing.

        Args:
            profile: What is stored.
            billing: What the request brought.

        Returns:
            Whether any field differs.
        """
        return any(
            getattr(profile, field) != getattr(billing, field)
            for field in (
                "cpf_cnpj",
                "phone",
                "address",
                "address_number",
                "complement",
                "city",
                "state",
                "postal_code",
            )
        )
