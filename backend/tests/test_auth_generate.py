"""A1: generation endpoints require auth and verify episode ownership."""

from database import Episode

from conftest import AUTH_USER_ID, make_user


def _seed_episode(db, episode_id, owner_id):
    db.add(Episode(id=episode_id, title="T", filename="f.mp4",
                   transcript="t", words=[], word_count=1, user_id=owner_id))
    db.commit()


def test_clip_requires_auth(client):
    assert client.post("/generate/clip", json={
        "file_id": "f", "episode_id": "e", "start_time": 0, "end_time": 1,
    }).status_code in (401, 403)


def test_quote_card_requires_auth(client):
    assert client.post("/generate/quote-card", json={
        "episode_id": "e", "quote_text": "hi",
    }).status_code in (401, 403)


def test_clip_rejects_other_users_episode(auth_client, db_session):
    make_user(db_session, "other-user")
    _seed_episode(db_session, "ep-other", "other-user")
    resp = auth_client.post("/generate/clip", json={
        "file_id": "ep-other", "episode_id": "ep-other",
        "start_time": 0, "end_time": 1,
    })
    assert resp.status_code == 404


def test_quote_card_rejects_other_users_episode(auth_client, db_session):
    make_user(db_session, "other-user")
    _seed_episode(db_session, "ep-other", "other-user")
    resp = auth_client.post("/generate/quote-card", json={
        "episode_id": "ep-other", "quote_text": "hello world quote",
    })
    assert resp.status_code == 404


def test_quote_card_stamps_user_id(auth_client, db_session):
    _seed_episode(db_session, "ep-mine", AUTH_USER_ID)
    resp = auth_client.post("/generate/quote-card", json={
        "episode_id": "ep-mine", "quote_text": "hello world quote",
    })
    assert resp.status_code == 200

    from database import GeneratedContent
    row = db_session.query(GeneratedContent).filter(
        GeneratedContent.episode_id == "ep-mine",
        GeneratedContent.content_type == "quote_card").first()
    assert row is not None
    assert row.user_id == AUTH_USER_ID
