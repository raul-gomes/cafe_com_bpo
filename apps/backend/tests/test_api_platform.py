"""
Platform content managed by administrators.

Lessons with YouTube links, announcements broadcast to the bell and the home
post-it, the editable login notice and open café, the public attendance
confirmation and courtesy grants (free full access for a period).
"""

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest

from src.modules.platform.rules import next_open_cafe, youtube_id_from
from tests.helpers import create_test_user


def _auth(client, role: str = "user") -> tuple[dict, str]:
    """Creates a user with the given role and signs in.

    Args:
        client: Test client.
        role: User role ("user" or "admin").

    Returns:
        The Authorization header and the user's e-mail.
    """
    email = f"platform_{uuid4().hex[:8]}@cafe.com"
    create_test_user(email, role=role)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}, email


def _lesson(**overrides) -> dict:
    """Builds a valid lesson payload.

    Args:
        **overrides: Fields to replace.

    Returns:
        The payload.
    """
    data = {
        "section": "primeiros-passos",
        "title": "Conhecendo o painel",
        "summary": "Onde fica cada coisa.",
        "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s",
        "position": 1,
        "is_published": True,
    }
    data.update(overrides)
    return data


class TestRules:
    @pytest.mark.parametrize(
        "url",
        [
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ?si=abc",
            "https://www.youtube.com/embed/dQw4w9WgXcQ",
            "https://youtube.com/shorts/dQw4w9WgXcQ",
            "https://www.youtube.com/live/dQw4w9WgXcQ",
            "dQw4w9WgXcQ",
        ],
    )
    def test_youtube_id_is_read_from_every_link_shape(self, url):
        assert youtube_id_from(url) == "dQw4w9WgXcQ"

    def test_other_links_are_not_youtube(self):
        assert youtube_id_from("https://vimeo.com/123456") is None

    def test_open_cafe_is_the_last_wednesday_at_2pm_brasilia(self):
        # 2026-10-12 → last Wednesday of October is the 28th; 14h BRT = 17h UTC.
        assert next_open_cafe(datetime(2026, 10, 12, tzinfo=UTC)) == datetime(
            2026, 10, 28, 17, 0, tzinfo=UTC
        )

    def test_after_the_meeting_it_moves_to_next_month(self):
        assert next_open_cafe(datetime(2026, 10, 28, 18, 30, tzinfo=UTC)) == datetime(
            2026, 11, 25, 17, 0, tzinfo=UTC
        )


class TestLessons:
    def test_admin_publishes_and_users_only_see_published(self, client):
        admin, _ = _auth(client, "admin")
        user, _ = _auth(client)
        published = client.post("/admin/lessons", json=_lesson(), headers=admin)
        assert published.status_code == 201
        assert published.json()["youtube_id"] == "dQw4w9WgXcQ"
        client.post(
            "/admin/lessons",
            json=_lesson(title="Rascunho", is_published=False),
            headers=admin,
        )

        lessons = client.get("/lessons", headers=user).json()
        assert [lesson["title"] for lesson in lessons] == ["Conhecendo o painel"]
        assert set(lessons[0]) == {
            "id",
            "section",
            "title",
            "summary",
            "youtube_id",
            "position",
        }
        assert len(client.get("/admin/lessons", headers=admin).json()) == 2

    def test_non_youtube_link_is_refused(self, client):
        admin, _ = _auth(client, "admin")
        resp = client.post(
            "/admin/lessons",
            json=_lesson(video_url="https://vimeo.com/1"),
            headers=admin,
        )
        assert resp.status_code == 422

    def test_edit_and_delete(self, client):
        admin, _ = _auth(client, "admin")
        lesson_id = client.post("/admin/lessons", json=_lesson(), headers=admin).json()[
            "id"
        ]
        edited = client.put(
            f"/admin/lessons/{lesson_id}",
            json=_lesson(title="Novo título", video_url=None),
            headers=admin,
        )
        assert edited.json()["title"] == "Novo título"
        assert edited.json()["youtube_id"] is None
        assert (
            client.delete(f"/admin/lessons/{lesson_id}", headers=admin).status_code
            == 204
        )
        assert client.get("/admin/lessons", headers=admin).json() == []

    def test_admin_routes_refuse_regular_users(self, client):
        user, _ = _auth(client)
        assert (
            client.post("/admin/lessons", json=_lesson(), headers=user).status_code
            == 403
        )
        assert client.get("/admin/users", headers=user).status_code == 403


class TestAnnouncements:
    def test_message_reaches_every_bell_and_the_home_post_it(self, client):
        admin, _ = _auth(client, "admin")
        user, _ = _auth(client)
        sent = client.post(
            "/admin/announcements",
            json={"title": "Café aberto", "message": "Quarta, 14h.", "audience": "all"},
            headers=admin,
        )
        assert sent.status_code == 201
        assert sent.json()["recipients_count"] == 2

        bell = client.get("/notifications/", headers=user).json()
        assert [n["title"] for n in bell] == ["Café aberto"]
        post_its = client.get("/announcements/active", headers=user).json()
        assert [p["title"] for p in post_its] == ["Café aberto"]
        assert set(post_its[0]) == {"id", "title", "message", "created_at"}

    def test_paying_audience_skips_free_users(self, client):
        admin, _ = _auth(client, "admin")
        user, _ = _auth(client)
        sent = client.post(
            "/admin/announcements",
            json={
                "title": "Só assinantes",
                "message": "Novidade.",
                "audience": "paying",
            },
            headers=admin,
        )
        assert sent.json()["recipients_count"] == 1  # only the admin
        assert client.get("/announcements/active", headers=user).json() == []

    def test_withdrawing_removes_post_it_and_notifications(self, client):
        admin, _ = _auth(client, "admin")
        user, _ = _auth(client)
        announcement_id = client.post(
            "/admin/announcements",
            json={"title": "Aviso", "message": "Texto.", "audience": "free"},
            headers=admin,
        ).json()["id"]
        resp = client.delete(f"/admin/announcements/{announcement_id}", headers=admin)
        assert resp.status_code == 204
        assert client.get("/announcements/active", headers=user).json() == []
        assert client.get("/notifications/", headers=user).json() == []

    def test_expired_post_it_is_hidden(self, client):
        admin, _ = _auth(client, "admin")
        client.post(
            "/admin/announcements",
            json={
                "title": "Antigo",
                "message": "Já passou.",
                "expires_at": "2020-01-01T00:00:00Z",
            },
            headers=admin,
        )
        assert client.get("/announcements/active", headers=admin).json() == []

    def test_old_valid_post_it_survives_many_newer_hidden_ones(
        self, client, db_session
    ):
        """AUD-033: the limit used to run before the expiry/audience filters.

        Twenty newer announcements this user cannot see (another audience or
        expired) pushed an older, still valid one out of the home panel.
        """
        from src.modules.platform.models import Announcement

        admin, _ = _auth(client, "admin")
        user, _ = _auth(client)
        valid_id = client.post(
            "/admin/announcements",
            json={"title": "Ainda vale", "message": "Texto.", "audience": "all"},
            headers=admin,
        ).json()["id"]
        hidden = [
            {"title": f"Pago {i}", "message": "Texto.", "audience": "paying"}
            for i in range(12)
        ] + [
            {
                "title": f"Vencido {i}",
                "message": "Texto.",
                "expires_at": "2020-01-01T00:00:00Z",
            }
            for i in range(10)
        ]
        for body in hidden:
            sent = client.post("/admin/announcements", json=body, headers=admin)
            assert sent.status_code == 201
        # The valid one is clearly the oldest, whatever the clock resolution.
        db_session.get(Announcement, UUID(valid_id)).created_at = datetime(
            2026, 1, 1, tzinfo=UTC
        )
        db_session.commit()

        post_its = client.get("/announcements/active", headers=user).json()
        assert [p["title"] for p in post_its] == ["Ainda vale"]


class TestSiteSettings:
    def test_defaults_before_any_edit(self, client):
        site = client.get("/site/public").json()
        assert site["login_notice"]["title"] == "Bem-vindo de volta."
        assert "meet_url" not in site["cafe_meeting"]

    def test_admin_edits_login_notice(self, client):
        admin, _ = _auth(client, "admin")
        notice = {
            "title": "Promoção de lançamento",
            "message": "Assine este mês com desconto.",
            "link_label": "Ver planos",
            "link_url": "https://cafecombpo.cloud/planos",
        }
        assert (
            client.put(
                "/admin/site/login-notice", json=notice, headers=admin
            ).status_code
            == 200
        )
        assert client.get("/site/public").json()["login_notice"] == notice

    def test_link_label_needs_a_link(self, client):
        admin, _ = _auth(client, "admin")
        resp = client.put(
            "/admin/site/login-notice",
            json={"title": "Oi", "message": "Texto", "link_label": "Ver"},
            headers=admin,
        )
        assert resp.status_code == 422

    def test_meet_link_is_never_public(self, client):
        admin, _ = _auth(client, "admin")
        client.put(
            "/admin/site/cafe-meeting",
            json={
                "title": "Café aberto",
                "meet_url": "https://meet.google.com/abc-defg-hij",
            },
            headers=admin,
        )
        assert "meet.google.com" not in client.get("/site/public").text
        assert client.get("/admin/site", headers=admin).json()["cafe_meeting"][
            "meet_url"
        ]


class TestCafeRsvp:
    def test_needs_email_or_phone(self, client):
        resp = client.post("/cafes/rsvps", json={"name": "Ana"})
        assert resp.status_code == 422

    def test_confirmation_returns_the_link_and_is_listed_once(self, client):
        admin, _ = _auth(client, "admin")
        client.put(
            "/admin/site/cafe-meeting",
            json={"meet_url": "https://meet.google.com/abc-defg-hij"},
            headers=admin,
        )
        for _ in range(2):
            resp = client.post(
                "/cafes/rsvps",
                json={"name": "Ana", "email": "ANA@cafe.com", "phone": ""},
            )
            assert resp.status_code == 201
        assert resp.json()["meet_url"] == "https://meet.google.com/abc-defg-hij"
        rsvps = client.get("/admin/cafes/rsvps", headers=admin).json()
        assert [(r["name"], r["email"]) for r in rsvps] == [("Ana", "ana@cafe.com")]

    def test_bot_is_answered_but_not_stored(self, client):
        admin, _ = _auth(client, "admin")
        client.post(
            "/cafes/rsvps",
            json={"name": "Bot", "phone": "11987654321", "website": "spam.example"},
        )
        assert client.get("/admin/cafes/rsvps", headers=admin).json() == []


class TestCourtesy:
    def test_courtesy_unlocks_everything_until_revoked(self, client):
        admin, _ = _auth(client, "admin")
        user, email = _auth(client)
        assert client.get("/access", headers=user).json()["access"] == "free"

        users = client.get(
            "/admin/users", params={"search": email}, headers=admin
        ).json()
        assert len(users) == 1
        grant = client.post(
            f"/admin/users/{users[0]['id']}/courtesy",
            json={"days": 30, "reason": "Parceria"},
            headers=admin,
        )
        assert grant.status_code == 201

        access = client.get("/access", headers=user).json()
        assert access["access"] == "courtesy"
        assert access["read_only_modules"] == []
        listed = client.get(
            "/admin/users", params={"search": email}, headers=admin
        ).json()
        assert listed[0]["courtesy"]["reason"] == "Parceria"

        revoked = client.delete(
            f"/admin/courtesies/{grant.json()['id']}", headers=admin
        )
        assert revoked.status_code == 204
        assert client.get("/access", headers=user).json()["access"] == "free"


class TestAdminListTotals:
    """AUD-044: admin lists said nothing when cut at a fixed size.

    The users list stopped at 300 and the confirmations at 500, and the Excel
    export used that cut array as if it were everything. Both lists now report
    the real total in `X-Total-Count` and take a `limit`, so the screen can warn
    and the export can ask for the whole set.
    """

    def test_users_list_reports_the_total_and_honours_the_limit(self, client):
        admin, _ = _auth(client, "admin")
        for _ in range(3):
            _auth(client)

        resp = client.get("/admin/users", params={"limit": 2}, headers=admin)
        assert resp.status_code == 200
        assert len(resp.json()) == 2
        assert resp.headers["X-Total-Count"] == "4"

        searched = client.get(
            "/admin/users", params={"search": "platform_", "limit": 1}, headers=admin
        )
        assert searched.headers["X-Total-Count"] == "4"

    @pytest.mark.parametrize("limit", [0, 20001])
    def test_users_list_rejects_a_limit_out_of_range(self, client, limit):
        admin, _ = _auth(client, "admin")
        resp = client.get("/admin/users", params={"limit": limit}, headers=admin)
        assert resp.status_code == 422

    def test_rsvps_list_reports_the_total_and_honours_the_limit(
        self, client, db_session
    ):
        from src.modules.platform.models import CafeRsvp

        admin, _ = _auth(client, "admin")
        for i in range(3):
            db_session.add(
                CafeRsvp(
                    name=f"Pessoa {i}",
                    email=f"p{i}@cafe.com",
                    meeting_starts_at=datetime(2026, 10, 28, 17, tzinfo=UTC),
                )
            )
        db_session.commit()

        resp = client.get("/admin/cafes/rsvps", params={"limit": 2}, headers=admin)
        assert len(resp.json()) == 2
        assert resp.headers["X-Total-Count"] == "3"

    def test_the_browser_can_read_the_total(self, client):
        admin, _ = _auth(client, "admin")
        resp = client.get(
            "/admin/users",
            headers={**admin, "Origin": "http://localhost:3000"},
        )
        exposed = resp.headers.get("access-control-expose-headers", "")
        assert "x-total-count" in exposed.lower()
