import pytest
from uuid import uuid4

def get_auth_header(client, email):
    payload = {"email": email, "password": "StrongPassword123!", "name": "Network User"}
    client.post("/auth/register", json=payload)
    resp = client.post("/auth/login", data={"username": email, "password": "StrongPassword123!"})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_create_post_success(client):
    auth = get_auth_header(client, f"post_create_{uuid4()}@cafe.com")
    payload = {
        "title": "Welcome to BPO Forum!",
        "message": "<p>This is a <strong>rich text</strong> message</p>",
        "tags": ["bpo", "welcome"]
    }
    
    resp = client.post("/api/network/posts", json=payload, headers=auth)
    
    # Red Phase expects this to be 404 since it doesn't exist yet, but in green it will be 201
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == payload["title"]
    assert data["tags"] == payload["tags"]
    assert data["comments_count"] == 0
    assert "id" in data
    assert "author" in data

def test_fetch_paginated_posts(client):
    auth = get_auth_header(client, f"post_fetch_{uuid4()}@cafe.com")
    
    # Create 2 posts
    client.post("/api/network/posts", json={"title": "Post 1", "message": "msg 1", "tags": ["a"]}, headers=auth)
    client.post("/api/network/posts", json={"title": "Post 2", "message": "msg 2", "tags": ["b"]}, headers=auth)
    
    resp = client.get("/api/network/posts?limit=10", headers=auth)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)
    assert "items" in data
    assert len(data["items"]) >= 2
    titles = [p["title"] for p in data["items"]]
    assert "Post 1" in titles
    assert "Post 2" in titles

def test_create_comment_increments_count_and_sends_notification(client):
    author_email = f"author_{uuid4()}@cafe.com"
    commenter_email = f"commenter_{uuid4()}@cafe.com"
    
    auth_author = get_auth_header(client, author_email)
    auth_commenter = get_auth_header(client, commenter_email)
    
    # Author creates a post
    post_resp = client.post(
        "/api/network/posts", 
        json={"title": "A Dúvida", "message": "Como vender?", "tags": []}, 
        headers=auth_author
    )
    assert post_resp.status_code == 201
    post_id = post_resp.json()["id"]
    
    # Commenter replies
    comment_resp = client.post(
        f"/api/network/posts/{post_id}/comments",
        json={"message": "Venda assim!"},
        headers=auth_commenter
    )
    assert comment_resp.status_code == 201
    
    # Verify post comments_count is 1
    fetch_resp = client.get(f"/api/network/posts/{post_id}", headers=auth_author)
    assert fetch_resp.status_code == 200
    assert fetch_resp.json()["comments_count"] == 1
    
    # Verify notification was created for Author
    notif_resp = client.get("/api/network/notifications", headers=auth_author)
    assert notif_resp.status_code == 200
    notifs = notif_resp.json()["items"]
    assert len(notifs) >= 1
    assert notifs[0]["user_id"] == post_resp.json()["author_id"]
    assert notifs[0]["type"] == "post_commented"
    assert notifs[0]["is_read"] is False

def test_cannot_delete_post_with_comments(client):
    auth = get_auth_header(client, f"delete_test_{uuid4()}@cafe.com")
    
    post_resp = client.post(
        "/api/network/posts", 
        json={"title": "Delete me", "message": "...", "tags": []}, 
        headers=auth
    )
    post_id = post_resp.json()["id"]
    
    # Add a comment
    client.post(
        f"/api/network/posts/{post_id}/comments",
        json={"message": "First!"},
        headers=auth
    )
    
    # Try deleting the post
    del_resp = client.delete(f"/api/network/posts/{post_id}", headers=auth)
    assert del_resp.status_code == 400
    assert "Cannot delete post with active comments" in del_resp.text

def test_html_sanitization(client):
    auth = get_auth_header(client, f"xss_{uuid4()}@cafe.com")
    malicious_payload = {
        "title": "Hack post",
        "message": "<p>Safe</p><script>alert('hack')</script><img src='x' onerror='alert()'>",
        "tags": []
    }
    
    resp = client.post("/api/network/posts", json=malicious_payload, headers=auth)
    assert resp.status_code == 201
    safe_msg = resp.json()["message"]
    assert "<script>" not in safe_msg
    assert "onerror" not in safe_msg
    assert "<p>Safe</p>" in safe_msg
