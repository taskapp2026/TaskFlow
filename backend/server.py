from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import json
import logging
import asyncio
import requests
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

import bcrypt
import jwt
from bson import ObjectId
from fastapi import (
    FastAPI,
    APIRouter,
    HTTPException,
    Depends,
    Request,
    Response,
    UploadFile,
    File,
    Header,
    Query,
    WebSocket,
    WebSocketDisconnect,
)
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

# =========================================================
# Config
# =========================================================
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 12  # 12 hours (dev friendly)
REFRESH_TOKEN_DAYS = 7
APP_NAME = os.environ.get("APP_NAME", "taskflow")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"


def env_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def env_list(name: str, default: str) -> List[str]:
    return [v.strip() for v in os.environ.get(name, default).split(",") if v.strip()]


COOKIE_SECURE = env_bool("COOKIE_SECURE", False)
COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "lax").strip().lower()
if COOKIE_SAMESITE not in ("lax", "strict", "none"):
    COOKIE_SAMESITE = "lax"
COOKIE_DOMAIN = os.environ.get("COOKIE_DOMAIN") or None
CORS_ORIGINS = env_list("CORS_ORIGINS", "http://localhost:3000")
ENABLE_DOCS = env_bool("ENABLE_DOCS", False)

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(
    title="TaskFlow API",
    docs_url="/docs" if ENABLE_DOCS else None,
    redoc_url="/redoc" if ENABLE_DOCS else None,
    openapi_url="/openapi.json" if ENABLE_DOCS else None,
)
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("taskflow")

# =========================================================
# Object Storage
# =========================================================
storage_key: Optional[str] = None


def init_storage() -> Optional[str]:
    global storage_key
    if storage_key:
        return storage_key
    if not EMERGENT_LLM_KEY:
        return None
    try:
        resp = requests.post(
            f"{STORAGE_URL}/init",
            json={"emergent_key": EMERGENT_LLM_KEY},
            timeout=30,
        )
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        return storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage not configured")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> tuple[bytes, str]:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage not configured")
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# =========================================================
# Auth helpers
# =========================================================
def hash_password(pwd: str) -> str:
    return bcrypt.hashpw(pwd.encode(), bcrypt.gensalt()).decode()


def verify_password(pwd: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pwd.encode(), hashed.encode())
    except Exception:
        return False


def create_token(payload: dict, minutes: Optional[int] = None, days: Optional[int] = None) -> str:
    now = datetime.now(timezone.utc)
    if minutes:
        exp = now + timedelta(minutes=minutes)
    else:
        exp = now + timedelta(days=days or 7)
    p = {**payload, "exp": exp, "iat": now}
    return jwt.encode(p, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str):
    cookie_options = {
        "httponly": True,
        "secure": COOKIE_SECURE,
        "samesite": COOKIE_SAMESITE,
        "domain": COOKIE_DOMAIN,
        "path": "/",
    }
    response.set_cookie("access_token", access, max_age=ACCESS_TOKEN_MINUTES * 60, **cookie_options)
    response.set_cookie("refresh_token", refresh, max_age=REFRESH_TOKEN_DAYS * 24 * 3600, **cookie_options)


def clear_auth_cookies(response: Response):
    response.delete_cookie("access_token", path="/", domain=COOKIE_DOMAIN)
    response.delete_cookie("refresh_token", path="/", domain=COOKIE_DOMAIN)


def user_public(u: dict) -> dict:
    return {
        "id": str(u["_id"]),
        "email": u["email"],
        "name": u.get("name", ""),
        "role": u.get("role", "staff"),
        "disabled": u.get("disabled", False),
        "created_at": u.get("created_at"),
    }


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        u = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not u:
            raise HTTPException(status_code=401, detail="User not found")
        if u.get("disabled"):
            raise HTTPException(status_code=403, detail="Account disabled")
        return u
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


# =========================================================
# Models
# =========================================================
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserCreateIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "staff"


class UserUpdateIn(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None
    disabled: Optional[bool] = None


class LabelIn(BaseModel):
    name: str
    color: str = "#3b82f6"
    description: Optional[str] = None


class SubtaskIn(BaseModel):
    title: str
    priority: str = "P4"
    due_date: Optional[str] = None
    assignee_id: Optional[str] = None


class SubtaskUpdateIn(BaseModel):
    title: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None
    assignee_id: Optional[str] = None
    completed: Optional[bool] = None


class TaskIn(BaseModel):
    name: str
    description: Optional[str] = ""
    assignee_id: Optional[str] = None
    priority: str = "P4"
    label_ids: List[str] = []
    due_date: Optional[str] = None  # YYYY-MM-DD
    due_time: Optional[str] = None  # HH:MM
    reminder: Optional[Dict[str, Any]] = None


class TaskUpdateIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    assignee_id: Optional[str] = None
    priority: Optional[str] = None
    label_ids: Optional[List[str]] = None
    due_date: Optional[str] = None
    due_time: Optional[str] = None
    reminder: Optional[Dict[str, Any]] = None
    completed: Optional[bool] = None


class CommentIn(BaseModel):
    body: str


class CommentUpdateIn(BaseModel):
    body: str


# =========================================================
# Utility
# =========================================================
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid id: {v}")


def serialize(doc: dict) -> dict:
    if not doc:
        return doc
    doc = dict(doc)
    if "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    for k, v in list(doc.items()):
        if isinstance(v, ObjectId):
            doc[k] = str(v)
    return doc


async def log_activity(task_id: str, user: dict, action: str, field: Optional[str] = None,
                       old_value: Any = None, new_value: Any = None, request: Optional[Request] = None):
    entry = {
        "task_id": task_id,
        "user_id": str(user["_id"]),
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "action": action,
        "field": field,
        "old_value": old_value,
        "new_value": new_value,
        "created_at": now_iso(),
    }
    if request:
        entry["ip"] = request.client.host if request.client else None
        entry["user_agent"] = request.headers.get("user-agent")
    await db.activities.insert_one(entry)


async def notify(user_id: str, task_id: Optional[str], message: str, kind: str = "info"):
    n = {
        "user_id": user_id,
        "task_id": task_id,
        "message": message,
        "kind": kind,
        "read": False,
        "created_at": now_iso(),
    }
    r = await db.notifications.insert_one(n)
    n["id"] = str(r.inserted_id)
    n.pop("_id", None)
    await ws_manager.send_to_user(user_id, {"type": "notification", "data": n})


async def notify_admins(message: str, task_id: Optional[str] = None, exclude_user_id: Optional[str] = None):
    admins = await db.users.find({"role": "admin", "disabled": {"$ne": True}}).to_list(1000)
    for a in admins:
        aid = str(a["_id"])
        if exclude_user_id and aid == exclude_user_id:
            continue
        await notify(aid, task_id, message, "admin")


# =========================================================
# WebSocket manager
# =========================================================
class WSManager:
    def __init__(self):
        self.active: Dict[str, List[WebSocket]] = {}

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(user_id, []).append(ws)

    def disconnect(self, user_id: str, ws: WebSocket):
        if user_id in self.active:
            try:
                self.active[user_id].remove(ws)
            except ValueError:
                pass
            if not self.active[user_id]:
                self.active.pop(user_id, None)

    async def send_to_user(self, user_id: str, message: dict):
        conns = list(self.active.get(user_id, []))
        for ws in conns:
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(user_id, ws)


ws_manager = WSManager()


# =========================================================
# Auth endpoints
# =========================================================
@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower().strip()
    u = await db.users.find_one({"email": email})
    if not u or not verify_password(body.password, u["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if u.get("disabled"):
        raise HTTPException(status_code=403, detail="Account disabled")
    access = create_token({"sub": str(u["_id"]), "email": u["email"], "type": "access"}, minutes=ACCESS_TOKEN_MINUTES)
    refresh = create_token({"sub": str(u["_id"]), "type": "refresh"}, days=REFRESH_TOKEN_DAYS)
    set_auth_cookies(response, access, refresh)
    return {"user": user_public(u), "access_token": access}


@api.post("/auth/logout")
async def logout(response: Response, user=Depends(get_current_user)):
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user_public(user)


# =========================================================
# User (staff) management (admin)
# =========================================================
@api.get("/users")
async def list_users(user=Depends(get_current_user)):
    if user.get("role") == "admin":
        docs = await db.users.find({}).sort("created_at", -1).to_list(1000)
    else:
        # Staff can see basic info for admins only (for context)
        docs = await db.users.find({"_id": user["_id"]}).to_list(10)
    return [user_public(d) for d in docs]


@api.post("/users")
async def create_user(body: UserCreateIn, admin=Depends(require_admin)):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already exists")
    doc = {
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": body.role if body.role in ("admin", "staff") else "staff",
        "disabled": False,
        "created_at": now_iso(),
    }
    r = await db.users.insert_one(doc)
    doc["_id"] = r.inserted_id
    return user_public(doc)


@api.patch("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdateIn, admin=Depends(require_admin)):
    update: Dict[str, Any] = {}
    if body.name is not None:
        update["name"] = body.name
    if body.email is not None:
        update["email"] = body.email.lower().strip()
    if body.role is not None and body.role in ("admin", "staff"):
        update["role"] = body.role
    if body.disabled is not None:
        update["disabled"] = body.disabled
    if body.password:
        update["password_hash"] = hash_password(body.password)
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.users.update_one({"_id": oid(user_id)}, {"$set": update})
    u = await db.users.find_one({"_id": oid(user_id)})
    return user_public(u)


@api.delete("/users/{user_id}")
async def delete_user(user_id: str, admin=Depends(require_admin)):
    if str(admin["_id"]) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    await db.users.delete_one({"_id": oid(user_id)})
    return {"ok": True}


# =========================================================
# Labels
# =========================================================
@api.get("/labels")
async def list_labels(user=Depends(get_current_user)):
    q = {"$or": [{"owner_id": str(user["_id"])}, {"global": True}]}
    docs = await db.labels.find(q).sort("name", 1).to_list(1000)
    return [serialize(d) for d in docs]


@api.post("/labels")
async def create_label(body: LabelIn, user=Depends(get_current_user)):
    doc = {
        "name": body.name,
        "color": body.color,
        "description": body.description or "",
        "owner_id": str(user["_id"]),
        "global": False,
        "created_at": now_iso(),
    }
    r = await db.labels.insert_one(doc)
    doc["_id"] = r.inserted_id
    return serialize(doc)


@api.patch("/labels/{label_id}")
async def update_label(label_id: str, body: LabelIn, user=Depends(get_current_user)):
    lbl = await db.labels.find_one({"_id": oid(label_id)})
    if not lbl:
        raise HTTPException(404, "Label not found")
    if lbl["owner_id"] != str(user["_id"]) and user.get("role") != "admin":
        raise HTTPException(403, "Forbidden")
    await db.labels.update_one({"_id": oid(label_id)}, {"$set": body.model_dump()})
    return serialize(await db.labels.find_one({"_id": oid(label_id)}))


@api.delete("/labels/{label_id}")
async def delete_label(label_id: str, user=Depends(get_current_user)):
    lbl = await db.labels.find_one({"_id": oid(label_id)})
    if not lbl:
        raise HTTPException(404, "Label not found")
    if lbl["owner_id"] != str(user["_id"]) and user.get("role") != "admin":
        raise HTTPException(403, "Forbidden")
    await db.labels.delete_one({"_id": oid(label_id)})
    return {"ok": True}


# =========================================================
# Tasks
# =========================================================
def build_task_query(user: dict, params: dict) -> dict:
    q: Dict[str, Any] = {}
    if user.get("role") != "admin":
        q["assignee_id"] = str(user["_id"])
    else:
        if params.get("assignee_id"):
            q["assignee_id"] = params["assignee_id"]
    if params.get("created_by"):
        q["created_by"] = params["created_by"]
    if params.get("priority"):
        q["priority"] = params["priority"]
    if params.get("label_id"):
        q["label_ids"] = params["label_id"]
    if params.get("status") == "completed":
        q["completed"] = True
    elif params.get("status") == "pending":
        q["completed"] = False
    if params.get("scope") == "today":
        today = datetime.now(timezone.utc).date().isoformat()
        q["due_date"] = today
        q["completed"] = False
    elif params.get("scope") == "upcoming":
        today = datetime.now(timezone.utc).date().isoformat()
        q["due_date"] = {"$gt": today}
        q["completed"] = False
    elif params.get("scope") == "overdue":
        today = datetime.now(timezone.utc).date().isoformat()
        q["due_date"] = {"$lt": today, "$ne": None}
        q["completed"] = False
    elif params.get("scope") == "completed":
        q["completed"] = True
    if params.get("search"):
        s = params["search"]
        q["$or"] = [
            {"name": {"$regex": s, "$options": "i"}},
            {"description": {"$regex": s, "$options": "i"}},
        ]
    return q


@api.get("/tasks")
async def list_tasks(
    request: Request,
    scope: Optional[str] = None,
    priority: Optional[str] = None,
    label_id: Optional[str] = None,
    assignee_id: Optional[str] = None,
    created_by: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    sort: Optional[str] = "created",
    user=Depends(get_current_user),
):
    params = dict(scope=scope, priority=priority, label_id=label_id,
                  assignee_id=assignee_id, created_by=created_by, status=status, search=search)
    q = build_task_query(user, params)
    sort_map = {
        "created": ("created_at", -1),
        "updated": ("updated_at", -1),
        "due": ("due_date", 1),
        "priority": ("priority", 1),
        "alpha": ("name", 1),
    }
    sk, sd = sort_map.get(sort or "created", ("created_at", -1))
    docs = await db.tasks.find(q).sort(sk, sd).to_list(2000)
    return [serialize(d) for d in docs]


@api.get("/tasks/{task_id}")
async def get_task(task_id: str, user=Depends(get_current_user)):
    t = await db.tasks.find_one({"_id": oid(task_id)})
    if not t:
        raise HTTPException(404, "Task not found")
    if user.get("role") != "admin" and t["assignee_id"] != str(user["_id"]):
        raise HTTPException(403, "Forbidden")
    return serialize(t)


@api.post("/tasks")
async def create_task(body: TaskIn, request: Request, user=Depends(get_current_user)):
    assignee_id = body.assignee_id or str(user["_id"])
    if user.get("role") != "admin":
        assignee_id = str(user["_id"])
    doc = {
        "name": body.name,
        "description": body.description or "",
        "assignee_id": assignee_id,
        "created_by": str(user["_id"]),
        "priority": body.priority or "P4",
        "label_ids": body.label_ids or [],
        "due_date": body.due_date,
        "due_time": body.due_time,
        "reminder": body.reminder,
        "completed": False,
        "completed_at": None,
        "subtasks": [],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    r = await db.tasks.insert_one(doc)
    doc["_id"] = r.inserted_id
    tid = str(r.inserted_id)
    await log_activity(tid, user, "task_created", new_value=body.name, request=request)
    # Notifications
    if user.get("role") == "admin" and assignee_id != str(user["_id"]):
        await notify(assignee_id, tid, f"Admin assigned you a task: {body.name}", "assignment")
    elif user.get("role") == "staff":
        await notify_admins(f"{user.get('name','Staff')} created task: {body.name}", tid, exclude_user_id=str(user["_id"]))
    return serialize(doc)


@api.patch("/tasks/{task_id}")
async def update_task(task_id: str, body: TaskUpdateIn, request: Request, user=Depends(get_current_user)):
    t = await db.tasks.find_one({"_id": oid(task_id)})
    if not t:
        raise HTTPException(404, "Task not found")
    if user.get("role") != "admin" and t["assignee_id"] != str(user["_id"]):
        raise HTTPException(403, "Forbidden")
    update: Dict[str, Any] = {}
    tracked = {}
    for field in ["name", "description", "priority", "label_ids", "due_date", "due_time", "reminder", "assignee_id"]:
        val = getattr(body, field)
        if val is not None:
            if user.get("role") != "admin" and field == "assignee_id":
                continue
            if t.get(field) != val:
                tracked[field] = (t.get(field), val)
                update[field] = val
    if body.completed is not None and body.completed != t.get("completed", False):
        update["completed"] = body.completed
        update["completed_at"] = now_iso() if body.completed else None
        tracked["completed"] = (t.get("completed", False), body.completed)
    if not update:
        return serialize(t)
    update["updated_at"] = now_iso()
    await db.tasks.update_one({"_id": oid(task_id)}, {"$set": update})
    for field, (old, new) in tracked.items():
        action = "task_completed" if field == "completed" and new else (
                 "task_reopened" if field == "completed" and not new else f"{field}_changed")
        await log_activity(task_id, user, action, field=field, old_value=old, new_value=new, request=request)
    # Notifications
    new_t = await db.tasks.find_one({"_id": oid(task_id)})
    assignee_id = new_t["assignee_id"]
    is_admin = user.get("role") == "admin"
    actor_id = str(user["_id"])
    if is_admin and assignee_id != actor_id:
        if "completed" in tracked and tracked["completed"][1]:
            await notify(assignee_id, task_id, f"Admin marked '{new_t['name']}' as complete", "update")
        elif "completed" in tracked and not tracked["completed"][1]:
            await notify(assignee_id, task_id, f"Admin reopened '{new_t['name']}'", "update")
        else:
            await notify(assignee_id, task_id, f"Admin updated '{new_t['name']}'", "update")
    elif not is_admin:
        await notify_admins(f"{user.get('name','Staff')} updated '{new_t['name']}'", task_id, exclude_user_id=actor_id)
    return serialize(new_t)


@api.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user=Depends(get_current_user)):
    t = await db.tasks.find_one({"_id": oid(task_id)})
    if not t:
        raise HTTPException(404, "Task not found")
    if user.get("role") != "admin" and t["created_by"] != str(user["_id"]):
        raise HTTPException(403, "Forbidden")
    await db.tasks.delete_one({"_id": oid(task_id)})
    await db.comments.delete_many({"task_id": task_id})
    await db.attachments.delete_many({"task_id": task_id})
    # activities are immutable — keep them
    return {"ok": True}


# ---------------------------------------------------------
# Subtasks (embedded)
# ---------------------------------------------------------
@api.post("/tasks/{task_id}/subtasks")
async def add_subtask(task_id: str, body: SubtaskIn, request: Request, user=Depends(get_current_user)):
    t = await db.tasks.find_one({"_id": oid(task_id)})
    if not t:
        raise HTTPException(404, "Task not found")
    if user.get("role") != "admin" and t["assignee_id"] != str(user["_id"]):
        raise HTTPException(403, "Forbidden")
    sub = {
        "id": str(uuid.uuid4()),
        "title": body.title,
        "priority": body.priority,
        "due_date": body.due_date,
        "assignee_id": body.assignee_id or t["assignee_id"],
        "completed": False,
        "created_at": now_iso(),
    }
    await db.tasks.update_one({"_id": oid(task_id)},
                              {"$push": {"subtasks": sub}, "$set": {"updated_at": now_iso()}})
    await log_activity(task_id, user, "subtask_created", new_value=body.title, request=request)
    return sub


@api.patch("/tasks/{task_id}/subtasks/{subtask_id}")
async def update_subtask(task_id: str, subtask_id: str, body: SubtaskUpdateIn, request: Request, user=Depends(get_current_user)):
    t = await db.tasks.find_one({"_id": oid(task_id)})
    if not t:
        raise HTTPException(404, "Task not found")
    if user.get("role") != "admin" and t["assignee_id"] != str(user["_id"]):
        raise HTTPException(403, "Forbidden")
    subs = t.get("subtasks", [])
    found = None
    for s in subs:
        if s["id"] == subtask_id:
            found = s
            break
    if not found:
        raise HTTPException(404, "Subtask not found")
    for k in ["title", "priority", "due_date", "assignee_id", "completed"]:
        v = getattr(body, k)
        if v is not None:
            found[k] = v
    await db.tasks.update_one({"_id": oid(task_id)}, {"$set": {"subtasks": subs, "updated_at": now_iso()}})
    if body.completed is True:
        await log_activity(task_id, user, "subtask_completed", new_value=found["title"], request=request)
    return found


@api.delete("/tasks/{task_id}/subtasks/{subtask_id}")
async def delete_subtask(task_id: str, subtask_id: str, user=Depends(get_current_user)):
    t = await db.tasks.find_one({"_id": oid(task_id)})
    if not t:
        raise HTTPException(404, "Task not found")
    if user.get("role") != "admin" and t["assignee_id"] != str(user["_id"]):
        raise HTTPException(403, "Forbidden")
    subs = [s for s in t.get("subtasks", []) if s["id"] != subtask_id]
    await db.tasks.update_one({"_id": oid(task_id)}, {"$set": {"subtasks": subs, "updated_at": now_iso()}})
    return {"ok": True}


# ---------------------------------------------------------
# Comments
# ---------------------------------------------------------
@api.get("/tasks/{task_id}/comments")
async def list_comments(task_id: str, user=Depends(get_current_user)):
    t = await db.tasks.find_one({"_id": oid(task_id)})
    if not t:
        raise HTTPException(404, "Task not found")
    if user.get("role") != "admin" and t["assignee_id"] != str(user["_id"]):
        raise HTTPException(403, "Forbidden")
    docs = await db.comments.find({"task_id": task_id}).sort("created_at", 1).to_list(1000)
    return [serialize(d) for d in docs]


@api.post("/tasks/{task_id}/comments")
async def add_comment(task_id: str, body: CommentIn, request: Request, user=Depends(get_current_user)):
    t = await db.tasks.find_one({"_id": oid(task_id)})
    if not t:
        raise HTTPException(404, "Task not found")
    if user.get("role") != "admin" and t["assignee_id"] != str(user["_id"]):
        raise HTTPException(403, "Forbidden")
    doc = {
        "task_id": task_id,
        "user_id": str(user["_id"]),
        "user_name": user.get("name", ""),
        "body": body.body,
        "edited": False,
        "created_at": now_iso(),
    }
    r = await db.comments.insert_one(doc)
    doc["_id"] = r.inserted_id
    await log_activity(task_id, user, "comment_added", new_value=body.body[:100], request=request)
    # notify counterpart
    actor_id = str(user["_id"])
    if user.get("role") == "admin" and t["assignee_id"] != actor_id:
        await notify(t["assignee_id"], task_id, f"Admin commented on '{t['name']}'", "comment")
    elif user.get("role") == "staff":
        await notify_admins(f"{user.get('name','Staff')} commented on '{t['name']}'", task_id, exclude_user_id=actor_id)
    return serialize(doc)


@api.patch("/tasks/{task_id}/comments/{comment_id}")
async def edit_comment(task_id: str, comment_id: str, body: CommentUpdateIn, user=Depends(get_current_user)):
    c = await db.comments.find_one({"_id": oid(comment_id)})
    if not c:
        raise HTTPException(404, "Comment not found")
    if c["user_id"] != str(user["_id"]) and user.get("role") != "admin":
        raise HTTPException(403, "Forbidden")
    await db.comments.update_one({"_id": oid(comment_id)},
                                 {"$set": {"body": body.body, "edited": True, "edited_at": now_iso()}})
    return serialize(await db.comments.find_one({"_id": oid(comment_id)}))


@api.delete("/tasks/{task_id}/comments/{comment_id}")
async def delete_comment(task_id: str, comment_id: str, user=Depends(get_current_user)):
    c = await db.comments.find_one({"_id": oid(comment_id)})
    if not c:
        raise HTTPException(404, "Comment not found")
    if c["user_id"] != str(user["_id"]) and user.get("role") != "admin":
        raise HTTPException(403, "Forbidden")
    await db.comments.delete_one({"_id": oid(comment_id)})
    return {"ok": True}


# ---------------------------------------------------------
# Attachments
# ---------------------------------------------------------
@api.get("/tasks/{task_id}/attachments")
async def list_attachments(task_id: str, user=Depends(get_current_user)):
    t = await db.tasks.find_one({"_id": oid(task_id)})
    if not t:
        raise HTTPException(404, "Task not found")
    if user.get("role") != "admin" and t["assignee_id"] != str(user["_id"]):
        raise HTTPException(403, "Forbidden")
    docs = await db.attachments.find({"task_id": task_id, "is_deleted": {"$ne": True}}).sort("created_at", -1).to_list(1000)
    return [serialize(d) for d in docs]


@api.post("/tasks/{task_id}/attachments")
async def upload_attachment(task_id: str, request: Request, file: UploadFile = File(...), user=Depends(get_current_user)):
    t = await db.tasks.find_one({"_id": oid(task_id)})
    if not t:
        raise HTTPException(404, "Task not found")
    if user.get("role") != "admin" and t["assignee_id"] != str(user["_id"]):
        raise HTTPException(403, "Forbidden")
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin"
    path = f"{APP_NAME}/tasks/{task_id}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    result = put_object(path, data, file.content_type or "application/octet-stream")
    doc = {
        "task_id": task_id,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": file.content_type or "application/octet-stream",
        "size": result.get("size", len(data)),
        "uploaded_by": str(user["_id"]),
        "uploaded_by_name": user.get("name", ""),
        "is_deleted": False,
        "created_at": now_iso(),
    }
    r = await db.attachments.insert_one(doc)
    doc["_id"] = r.inserted_id
    await log_activity(task_id, user, "attachment_uploaded", new_value=file.filename, request=request)
    actor_id = str(user["_id"])
    if user.get("role") == "admin" and t["assignee_id"] != actor_id:
        await notify(t["assignee_id"], task_id, f"Admin uploaded a file to '{t['name']}'", "upload")
    elif user.get("role") == "staff":
        await notify_admins(f"{user.get('name','Staff')} uploaded a file to '{t['name']}'", task_id, exclude_user_id=actor_id)
    return serialize(doc)


@api.get("/attachments/{attachment_id}/download")
async def download_attachment(attachment_id: str, auth: Optional[str] = Query(None), request: Request = None):
    # Auth: cookie OR bearer OR ?auth=
    user = None
    try:
        user = await get_current_user(request)
    except HTTPException:
        if auth:
            try:
                payload = jwt.decode(auth, JWT_SECRET, algorithms=[JWT_ALGORITHM])
                u = await db.users.find_one({"_id": ObjectId(payload["sub"])})
                if u:
                    user = u
            except Exception:
                pass
    if not user:
        raise HTTPException(401, "Not authenticated")
    a = await db.attachments.find_one({"_id": oid(attachment_id), "is_deleted": {"$ne": True}})
    if not a:
        raise HTTPException(404, "Not found")
    t = await db.tasks.find_one({"_id": oid(a["task_id"])})
    if not t:
        raise HTTPException(404, "Task not found")
    if user.get("role") != "admin" and t["assignee_id"] != str(user["_id"]):
        raise HTTPException(403, "Forbidden")
    data, ctype = get_object(a["storage_path"])
    return Response(content=data, media_type=a.get("content_type") or ctype,
                    headers={"Content-Disposition": f'inline; filename="{a["original_filename"]}"'})


@api.delete("/attachments/{attachment_id}")
async def delete_attachment(attachment_id: str, request: Request, user=Depends(get_current_user)):
    a = await db.attachments.find_one({"_id": oid(attachment_id)})
    if not a:
        raise HTTPException(404, "Not found")
    t = await db.tasks.find_one({"_id": oid(a["task_id"])})
    if user.get("role") != "admin" and a["uploaded_by"] != str(user["_id"]):
        raise HTTPException(403, "Forbidden")
    await db.attachments.update_one({"_id": oid(attachment_id)}, {"$set": {"is_deleted": True}})
    await log_activity(a["task_id"], user, "attachment_deleted", old_value=a["original_filename"], request=request)
    actor_id = str(user["_id"])
    if t:
        if user.get("role") == "admin" and t["assignee_id"] != actor_id:
            await notify(t["assignee_id"], a["task_id"], f"Admin deleted an attachment from '{t['name']}'", "delete")
        elif user.get("role") == "staff":
            await notify_admins(f"{user.get('name','Staff')} deleted an attachment from '{t['name']}'", a["task_id"], exclude_user_id=actor_id)
    return {"ok": True}


# ---------------------------------------------------------
# Activity (Audit log)
# ---------------------------------------------------------
@api.get("/tasks/{task_id}/activity")
async def task_activity(task_id: str, user=Depends(get_current_user)):
    t = await db.tasks.find_one({"_id": oid(task_id)})
    if not t:
        raise HTTPException(404, "Task not found")
    if user.get("role") != "admin" and t["assignee_id"] != str(user["_id"]):
        raise HTTPException(403, "Forbidden")
    docs = await db.activities.find({"task_id": task_id}).sort("created_at", -1).to_list(2000)
    return [serialize(d) for d in docs]


@api.get("/activity")
async def all_activity(user=Depends(require_admin), limit: int = 200):
    docs = await db.activities.find({}).sort("created_at", -1).to_list(limit)
    return [serialize(d) for d in docs]


# ---------------------------------------------------------
# Notifications
# ---------------------------------------------------------
@api.get("/notifications")
async def list_notifications(user=Depends(get_current_user), limit: int = 100):
    docs = await db.notifications.find({"user_id": str(user["_id"])}).sort("created_at", -1).to_list(limit)
    return [serialize(d) for d in docs]


@api.post("/notifications/{nid}/read")
async def mark_read(nid: str, user=Depends(get_current_user)):
    await db.notifications.update_one({"_id": oid(nid), "user_id": str(user["_id"])}, {"$set": {"read": True}})
    return {"ok": True}


@api.post("/notifications/read-all")
async def mark_all_read(user=Depends(get_current_user)):
    await db.notifications.update_many({"user_id": str(user["_id"])}, {"$set": {"read": True}})
    return {"ok": True}


# ---------------------------------------------------------
# Dashboards
# ---------------------------------------------------------
@api.get("/dashboard")
async def dashboard(user=Depends(get_current_user)):
    is_admin = user.get("role") == "admin"
    base = {} if is_admin else {"assignee_id": str(user["_id"])}
    today = datetime.now(timezone.utc).date().isoformat()
    total = await db.tasks.count_documents(base)
    completed = await db.tasks.count_documents({**base, "completed": True})
    pending = await db.tasks.count_documents({**base, "completed": False})
    overdue = await db.tasks.count_documents({**base, "completed": False, "due_date": {"$lt": today, "$ne": None}})
    today_count = await db.tasks.count_documents({**base, "due_date": today, "completed": False})
    upcoming = await db.tasks.count_documents({**base, "due_date": {"$gt": today}, "completed": False})
    priority_dist = {}
    for p in ["P1", "P2", "P3", "P4"]:
        priority_dist[p] = await db.tasks.count_documents({**base, "priority": p})
    per_user = []
    if is_admin:
        users = await db.users.find({}).to_list(1000)
        for u in users:
            uid = str(u["_id"])
            per_user.append({
                "user_id": uid,
                "name": u.get("name"),
                "email": u.get("email"),
                "role": u.get("role"),
                "total": await db.tasks.count_documents({"assignee_id": uid}),
                "completed": await db.tasks.count_documents({"assignee_id": uid, "completed": True}),
                "pending": await db.tasks.count_documents({"assignee_id": uid, "completed": False}),
                "overdue": await db.tasks.count_documents({"assignee_id": uid, "completed": False, "due_date": {"$lt": today, "$ne": None}}),
            })
    recent_activity = await db.activities.find({}).sort("created_at", -1).to_list(20) if is_admin else \
        await db.activities.find({"user_id": str(user["_id"])}).sort("created_at", -1).to_list(20)
    return {
        "total": total,
        "completed": completed,
        "pending": pending,
        "overdue": overdue,
        "today": today_count,
        "upcoming": upcoming,
        "completion_rate": round((completed / total * 100) if total else 0, 1),
        "priority_distribution": priority_dist,
        "per_user": per_user,
        "recent_activity": [serialize(a) for a in recent_activity],
    }


@api.get("/users/{user_id}/summary")
async def user_summary(user_id: str, admin=Depends(require_admin)):
    today = datetime.now(timezone.utc).date().isoformat()
    total = await db.tasks.count_documents({"assignee_id": user_id})
    completed = await db.tasks.count_documents({"assignee_id": user_id, "completed": True})
    pending = await db.tasks.count_documents({"assignee_id": user_id, "completed": False})
    overdue = await db.tasks.count_documents({"assignee_id": user_id, "completed": False, "due_date": {"$lt": today, "$ne": None}})
    tasks = await db.tasks.find({"assignee_id": user_id}).sort("created_at", -1).to_list(500)
    recent_comments = await db.comments.find({"user_id": user_id}).sort("created_at", -1).to_list(20)
    activity = await db.activities.find({"user_id": user_id}).sort("created_at", -1).to_list(50)
    u = await db.users.find_one({"_id": oid(user_id)})
    return {
        "user": user_public(u) if u else None,
        "total": total,
        "completed": completed,
        "pending": pending,
        "overdue": overdue,
        "completion_rate": round((completed / total * 100) if total else 0, 1),
        "tasks": [serialize(t) for t in tasks],
        "recent_comments": [serialize(c) for c in recent_comments],
        "activity": [serialize(a) for a in activity],
    }


# =========================================================
# WebSocket
# =========================================================
@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = Query(None)):
    # Accept token via query or cookie
    tok = token or websocket.cookies.get("access_token")
    if not tok:
        await websocket.close(code=4401)
        return
    try:
        payload = jwt.decode(tok, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload["sub"]
    except Exception:
        await websocket.close(code=4401)
        return
    await ws_manager.connect(user_id, websocket)
    try:
        while True:
            # keep alive; accept pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id, websocket)
    except Exception:
        ws_manager.disconnect(user_id, websocket)


# =========================================================
# Startup: indexes, seed admin, init storage
# =========================================================
@app.on_event("startup")
async def startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.tasks.create_index([("assignee_id", 1), ("completed", 1)])
        await db.tasks.create_index("due_date")
        await db.activities.create_index([("task_id", 1), ("created_at", -1)])
        await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    except Exception as e:
        logger.error(f"Index setup: {e}")
    # Seed admin
    try:
        admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
        admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
        existing = await db.users.find_one({"email": admin_email})
        if existing is None:
            await db.users.insert_one({
                "email": admin_email,
                "password_hash": hash_password(admin_password),
                "name": "Admin",
                "role": "admin",
                "disabled": False,
                "created_at": now_iso(),
            })
            logger.info("Admin user seeded")
        elif not verify_password(admin_password, existing["password_hash"]):
            await db.users.update_one({"email": admin_email},
                                      {"$set": {"password_hash": hash_password(admin_password)}})
    except Exception as e:
        logger.error(f"Seed admin failed: {e}")
    # init storage
    init_storage()


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)
