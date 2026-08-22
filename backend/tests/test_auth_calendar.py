"""A1: calendar endpoints require auth and scope everything to the owner."""

from datetime import date

from database import Episode, GeneratedContent, ScheduledPost

from conftest import AUTH_USER_ID, make_user


def _seed_episode_with_content(db, episode_id, owner_id):
    db.add(Episode(id=episode_id, title="T", filename="f.mp4",
                   transcript="t", words=[], word_count=1, user_id=owner_id))
    db.add(GeneratedContent(id=f"c-{episode_id}", user_id=owner_id,
                            episode_id=episode_id, content_type="quote",
                            title="q", body="quote body", content_metadata={}))
    db.commit()


def test_episodes_list_requires_auth(client):
    assert client.get("/calendar/episodes").status_code in (401, 403)


def test_schedule_requires_auth(client):
    assert client.post("/calendar/schedule", json={
        "episode_id": "e", "start_date": "2026-01-01",
    }).status_code in (401, 403)


def test_episodes_list_scoped(auth_client, db_session):
    make_user(db_session, "other-user")
    _seed_episode_with_content(db_session, "mine", AUTH_USER_ID)
    _seed_episode_with_content(db_session, "theirs", "other-user")

    ids = [e["id"] for e in auth_client.get("/calendar/episodes").json()["data"]["episodes"]]
    assert "mine" in ids
    assert "theirs" not in ids


def test_schedule_rejects_other_users_episode(auth_client, db_session):
    make_user(db_session, "other-user")
    _seed_episode_with_content(db_session, "theirs", "other-user")
    resp = auth_client.post("/calendar/schedule", json={
        "episode_id": "theirs", "start_date": "2026-01-01"})
    assert resp.status_code == 404


def test_schedule_stamps_user_and_posts_scoped(auth_client, db_session):
    _seed_episode_with_content(db_session, "mine", AUTH_USER_ID)
    resp = auth_client.post("/calendar/schedule", json={
        "episode_id": "mine", "start_date": "2026-01-01"})
    assert resp.status_code == 200

    posts = db_session.query(ScheduledPost).filter(
        ScheduledPost.episode_id == "mine").all()
    assert posts
    assert all(p.user_id == AUTH_USER_ID for p in posts)

    listing = auth_client.get("/calendar/posts/mine")
    assert listing.status_code == 200

    post_id = posts[0].id
    ok = auth_client.patch(f"/calendar/posts/{post_id}/status", params={"status": "posted"})
    assert ok.status_code == 200


def test_posts_hidden_for_other_users_episode(auth_client, db_session):
    make_user(db_session, "other-user")
    _seed_episode_with_content(db_session, "theirs", "other-user")
    db_session.add(ScheduledPost(id="sp-1", user_id="other-user", episode_id="theirs",
                                 content_id="c-theirs", content_type="quote",
                                 content_body="b", scheduled_date=date(2026, 1, 1),
                                 platform="twitter", status="scheduled"))
    db_session.commit()
    assert auth_client.get("/calendar/posts/theirs").status_code == 404
    assert auth_client.patch("/calendar/posts/sp-1/status",
                             params={"status": "posted"}).status_code == 404
