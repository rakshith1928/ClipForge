"""A1: upload routes require authentication and jobs are scoped to their owner."""

from database import Job

from conftest import AUTH_USER_ID, make_user


def test_upload_requires_auth(client):
    resp = client.post("/upload/")
    assert resp.status_code in (401, 403)


def test_upload_url_requires_auth(client):
    resp = client.post("/upload/url", json={"url": "https://example.com/v.mp4"})
    assert resp.status_code in (401, 403)


def test_status_requires_auth(client):
    resp = client.get("/upload/status/any-job")
    assert resp.status_code in (401, 403)


def test_status_allows_owner(auth_client, db_session):
    db_session.add(Job(id="job-mine", title="t", status="queued", progress=0, user_id=AUTH_USER_ID))
    db_session.commit()
    resp = auth_client.get("/upload/status/job-mine")
    assert resp.status_code == 200
    assert resp.json()["status"] == "queued"


def test_status_404s_for_other_users_job(auth_client, db_session):
    make_user(db_session, "other-user")
    db_session.add(Job(id="job-theirs", title="t", status="queued", progress=0, user_id="other-user"))
    db_session.commit()
    resp = auth_client.get("/upload/status/job-theirs")
    assert resp.status_code == 404
