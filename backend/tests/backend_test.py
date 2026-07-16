"""
Comprehensive backend tests for TaskFlow (Task Management Web App).
Covers: Auth, User Mgmt, Tasks, Subtasks, Labels, Comments, Activity, Notifications,
Dashboard, RBAC.
"""
import os
import time
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")

BASE_URL = os.environ.get("BACKEND_URL") or os.environ.get(
    "REACT_APP_BACKEND_URL", "http://localhost:8000"
)
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")

TEST_RUN_ID = uuid.uuid4().hex[:8]
STAFF_EMAIL = f"test_staff_{TEST_RUN_ID}@example.com"
STAFF_PASSWORD = "staffPass123!"
STAFF_NAME = "TEST Staff User"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    data = r.json()
    s.headers.update({"Authorization": f"Bearer {data['access_token']}"})
    s.user = data["user"]
    return s


@pytest.fixture(scope="session")
def staff_user(admin_session):
    """Create a staff user via admin (session-scoped)."""
    r = admin_session.post(f"{API}/users", json={
        "email": STAFF_EMAIL,
        "password": STAFF_PASSWORD,
        "name": STAFF_NAME,
        "role": "staff",
    })
    assert r.status_code == 200, f"Staff creation failed: {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def staff_session(staff_user):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login",
               json={"email": STAFF_EMAIL, "password": STAFF_PASSWORD})
    assert r.status_code == 200, f"Staff login failed: {r.text}"
    data = r.json()
    s.headers.update({"Authorization": f"Bearer {data['access_token']}"})
    s.user = data["user"]
    return s


# ---------- Auth ----------
class TestAuth:
    def test_login_admin_success_sets_cookies(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login",
                   json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        body = r.json()
        assert body["user"]["email"] == ADMIN_EMAIL
        assert body["user"]["role"] == "admin"
        assert "access_token" in body
        # Cookies
        cookies = {c.name for c in s.cookies}
        assert "access_token" in cookies
        assert "refresh_token" in cookies

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": ADMIN_EMAIL, "password": "wrongpass"})
        assert r.status_code == 401

    def test_me_via_cookie(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login",
                   json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        r2 = s.get(f"{API}/auth/me")
        assert r2.status_code == 200
        assert r2.json()["email"] == ADMIN_EMAIL

    def test_me_via_bearer(self, admin_session):
        r = admin_session.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------- Users ----------
class TestUsers:
    def test_admin_can_create_staff(self, staff_user):
        assert staff_user["email"] == STAFF_EMAIL
        assert staff_user["role"] == "staff"
        assert "id" in staff_user

    def test_staff_can_login(self, staff_session):
        assert staff_session.user["email"] == STAFF_EMAIL

    def test_admin_lists_users(self, admin_session, staff_user):
        r = admin_session.get(f"{API}/users")
        assert r.status_code == 200
        emails = [u["email"] for u in r.json()]
        assert STAFF_EMAIL in emails

    def test_staff_cannot_create_user(self, staff_session):
        r = staff_session.post(f"{API}/users", json={
            "email": f"TEST_x_{uuid.uuid4().hex[:6]}@x.com",
            "password": "abc12345", "name": "X", "role": "staff",
        })
        assert r.status_code == 403


# ---------- Tasks ----------
@pytest.fixture(scope="session")
def admin_created_task_for_staff(admin_session, staff_user):
    r = admin_session.post(f"{API}/tasks", json={
        "name": f"TEST_{TEST_RUN_ID}_admin_to_staff_task",
        "description": "Assigned by admin",
        "assignee_id": staff_user["id"],
        "priority": "P2",
    })
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def staff_created_task(staff_session):
    r = staff_session.post(f"{API}/tasks", json={
        "name": f"TEST_{TEST_RUN_ID}_staff_self_task",
        "description": "Staff created own",
        "priority": "P3",
    })
    assert r.status_code == 200, r.text
    t = r.json()
    # staff cannot set assignee to another user; verify auto-self
    assert t["assignee_id"] == staff_session.user["id"]
    return t


class TestTasks:
    def test_admin_task_assigned_to_staff_visible_to_staff(
            self, staff_session, admin_created_task_for_staff):
        r = staff_session.get(f"{API}/tasks")
        assert r.status_code == 200
        ids = [t["id"] for t in r.json()]
        assert admin_created_task_for_staff["id"] in ids

    def test_staff_only_sees_own_tasks(self, staff_session, admin_session):
        r = staff_session.get(f"{API}/tasks")
        assert r.status_code == 200
        for t in r.json():
            assert t["assignee_id"] == staff_session.user["id"]

    def test_staff_toggle_complete(self, staff_session, staff_created_task):
        tid = staff_created_task["id"]
        r = staff_session.patch(f"{API}/tasks/{tid}", json={"completed": True})
        assert r.status_code == 200
        assert r.json()["completed"] is True
        # verify GET
        r2 = staff_session.get(f"{API}/tasks/{tid}")
        assert r2.status_code == 200
        assert r2.json()["completed"] is True
        # reopen
        r3 = staff_session.patch(f"{API}/tasks/{tid}", json={"completed": False})
        assert r3.status_code == 200
        assert r3.json()["completed"] is False

    def test_staff_can_delete_own_task(self, staff_session):
        # create a temp task then delete
        r = staff_session.post(f"{API}/tasks", json={
            "name": f"TEST_{TEST_RUN_ID}_delete_me", "priority": "P4"
        })
        assert r.status_code == 200
        tid = r.json()["id"]
        r2 = staff_session.delete(f"{API}/tasks/{tid}")
        assert r2.status_code == 200
        r3 = staff_session.get(f"{API}/tasks/{tid}")
        assert r3.status_code in (403, 404)

    def test_admin_can_get_any_task(self, admin_session, staff_created_task):
        r = admin_session.get(f"{API}/tasks/{staff_created_task['id']}")
        assert r.status_code == 200


# ---------- Subtasks ----------
class TestSubtasks:
    def test_add_and_complete_subtask(self, staff_session, staff_created_task):
        tid = staff_created_task["id"]
        r = staff_session.post(f"{API}/tasks/{tid}/subtasks",
                               json={"title": "TEST_subtask_1", "priority": "P4"})
        assert r.status_code == 200
        sub = r.json()
        assert sub["title"] == "TEST_subtask_1"
        # verify count via GET task
        r2 = staff_session.get(f"{API}/tasks/{tid}")
        subs = r2.json().get("subtasks", [])
        assert any(s["id"] == sub["id"] for s in subs)
        # complete
        r3 = staff_session.patch(f"{API}/tasks/{tid}/subtasks/{sub['id']}",
                                 json={"completed": True})
        assert r3.status_code == 200
        assert r3.json()["completed"] is True
        # delete
        r4 = staff_session.delete(f"{API}/tasks/{tid}/subtasks/{sub['id']}")
        assert r4.status_code == 200
        r5 = staff_session.get(f"{API}/tasks/{tid}")
        assert not any(s["id"] == sub["id"]
                       for s in r5.json().get("subtasks", []))


# ---------- Labels ----------
class TestLabels:
    def test_label_crud(self, staff_session):
        # create
        r = staff_session.post(f"{API}/labels",
                               json={"name": f"TEST_{TEST_RUN_ID}_label_A", "color": "#00ff00"})
        assert r.status_code == 200
        lbl = r.json()
        assert lbl["name"] == f"TEST_{TEST_RUN_ID}_label_A"
        lid = lbl["id"]
        # list
        r2 = staff_session.get(f"{API}/labels")
        assert r2.status_code == 200
        assert any(x["id"] == lid for x in r2.json())
        # delete
        r3 = staff_session.delete(f"{API}/labels/{lid}")
        assert r3.status_code == 200
        # verify gone
        r4 = staff_session.get(f"{API}/labels")
        assert not any(x["id"] == lid for x in r4.json())


# ---------- Comments ----------
class TestComments:
    def test_comment_crud(self, staff_session, staff_created_task):
        tid = staff_created_task["id"]
        r = staff_session.post(f"{API}/tasks/{tid}/comments",
                               json={"body": "TEST_hello_world"})
        assert r.status_code == 200
        c = r.json()
        cid = c["id"]
        # list
        r2 = staff_session.get(f"{API}/tasks/{tid}/comments")
        assert r2.status_code == 200
        assert any(x["id"] == cid for x in r2.json())
        # delete
        r3 = staff_session.delete(f"{API}/tasks/{tid}/comments/{cid}")
        assert r3.status_code == 200
        r4 = staff_session.get(f"{API}/tasks/{tid}/comments")
        assert not any(x["id"] == cid for x in r4.json())


# ---------- Activity ----------
class TestActivity:
    def test_task_activity_has_entries(self, staff_session, staff_created_task):
        tid = staff_created_task["id"]
        r = staff_session.get(f"{API}/tasks/{tid}/activity")
        assert r.status_code == 200
        entries = r.json()
        assert len(entries) >= 1
        # at least one action should be recorded (task_created,
        # or subsequent activity)
        actions = [e["action"] for e in entries]
        assert any(a for a in actions)

    def test_no_delete_activity_endpoint(self, admin_session, staff_created_task):
        tid = staff_created_task["id"]
        r = admin_session.get(f"{API}/tasks/{tid}/activity")
        assert r.status_code == 200
        entries = r.json()
        if entries:
            aid = entries[0]["id"]
            # try DELETE — should be 404/405 (no such route)
            r2 = admin_session.delete(f"{API}/tasks/{tid}/activity/{aid}")
            assert r2.status_code in (404, 405)

    def test_admin_activity_list(self, admin_session):
        r = admin_session.get(f"{API}/activity")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_staff_cannot_access_global_activity(self, staff_session):
        r = staff_session.get(f"{API}/activity")
        assert r.status_code == 403


# ---------- Notifications ----------
class TestNotifications:
    def test_admin_task_creates_staff_notification(
            self, staff_session, admin_created_task_for_staff):
        # allow slight async delay
        time.sleep(1)
        r = staff_session.get(f"{API}/notifications")
        assert r.status_code == 200
        found = any(
            n.get("task_id") == admin_created_task_for_staff["id"]
            for n in r.json()
        )
        assert found, "Expected staff to receive notification for admin-assigned task"

    def test_staff_task_creates_admin_notification(
            self, admin_session, staff_created_task):
        time.sleep(1)
        r = admin_session.get(f"{API}/notifications")
        assert r.status_code == 200
        found = any(
            n.get("task_id") == staff_created_task["id"]
            for n in r.json()
        )
        assert found, "Expected admin to receive notification for staff-created task"


# ---------- Dashboard ----------
class TestDashboard:
    def test_admin_dashboard(self, admin_session):
        r = admin_session.get(f"{API}/dashboard")
        assert r.status_code == 200
        d = r.json()
        for k in ("total", "completed", "pending", "overdue",
                  "completion_rate", "priority_distribution", "per_user"):
            assert k in d
        assert isinstance(d["per_user"], list)

    def test_staff_dashboard(self, staff_session):
        r = staff_session.get(f"{API}/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "total" in d and "completion_rate" in d


# ---------- RBAC ----------
class TestRBAC:
    def test_staff_cannot_view_other_users_task(self, admin_session, staff_session):
        # admin creates own task
        r = admin_session.post(f"{API}/tasks", json={
            "name": f"TEST_{TEST_RUN_ID}_admin_own_task", "priority": "P4"
        })
        assert r.status_code == 200
        tid = r.json()["id"]
        r2 = staff_session.get(f"{API}/tasks/{tid}")
        assert r2.status_code == 403
        # cleanup
        admin_session.delete(f"{API}/tasks/{tid}")

    def test_staff_cannot_post_users(self, staff_session):
        r = staff_session.post(f"{API}/users", json={
            "email": f"TEST_deny_{uuid.uuid4().hex[:6]}@x.com",
            "password": "abcd1234", "name": "d", "role": "staff",
        })
        assert r.status_code == 403

    def test_staff_cannot_get_global_activity(self, staff_session):
        r = staff_session.get(f"{API}/activity")
        assert r.status_code == 403


# ---------- Cleanup ----------
@pytest.fixture(scope="session", autouse=True)
def cleanup(request, admin_session):
    yield
    # Delete test tasks & staff user
    try:
        tasks = admin_session.get(f"{API}/tasks").json()
        for t in tasks:
            if TEST_RUN_ID in t.get("name", ""):
                admin_session.delete(f"{API}/tasks/{t['id']}")
        users = admin_session.get(f"{API}/users").json()
        for u in users:
            if TEST_RUN_ID in u["email"]:
                admin_session.delete(f"{API}/users/{u['id']}")
        labels = admin_session.get(f"{API}/labels").json()
        for l in labels:
            if TEST_RUN_ID in l.get("name", ""):
                admin_session.delete(f"{API}/labels/{l['id']}")
    except Exception as e:
        print(f"cleanup error: {e}")
