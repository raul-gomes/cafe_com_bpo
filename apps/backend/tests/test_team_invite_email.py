"""Team invitation e-mail renders names as text (follow-up of AUD-010)."""

from unittest.mock import patch

from src.core.email import EmailService
from tests.helpers import paid_auth_header, unique_email


def test_invite_email_escapes_inviter_and_company_names(client):
    owner = paid_auth_header(client, unique_email("inviter"))
    client.patch(
        "/auth/me",
        json={"name": '<a href="https://x.example">Suporte</a>'},
        headers=owner,
    )
    company = client.post(
        "/clients/", json={"name": "<b>Empresa</b> & Cia"}, headers=owner
    ).json()

    with patch.object(EmailService, "send_email") as send:
        resp = client.post(
            f"/clients/{company['id']}/invite",
            json={"emails": [unique_email("guest")], "template_ids": []},
            headers=owner,
        )

    assert resp.status_code == 201, resp.text
    html = send.call_args.args[3]
    assert '<a href="https://x.example">' not in html
    assert "&lt;a href=&quot;https://x.example&quot;&gt;Suporte&lt;/a&gt;" in html
    assert "&lt;b&gt;Empresa&lt;/b&gt; &amp; Cia" in html
