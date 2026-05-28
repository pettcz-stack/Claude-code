import json
import logging
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from anthropic import Anthropic

from ..config import get_settings

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).resolve().parent.parent.parent / "prompts" / "extract_v1.txt"


@dataclass
class ExtractedTask:
    is_task: bool
    direction: str | None
    phase: str | None
    title: str
    summary: str
    requested_output: str
    counterpart_email: str
    counterpart_name: str
    deadline: datetime | None
    confidence: float
    reason_if_not_task: str = ""
    raw: dict | None = None


def _client() -> Anthropic:
    return Anthropic(api_key=get_settings().anthropic_api_key)


def _load_prompt() -> str:
    return _PROMPT_PATH.read_text(encoding="utf-8")


def extract_from_thread(
    thread_subject: str,
    messages: list[dict],
    user_email: str,
    user_aliases: list[str],
    user_name: str,
) -> ExtractedTask:
    """
    `messages` = seznam dict {direction, from, to, cc, date, subject, body_text}
    Volá Claude (Sonnet 4.6) a vrátí strukturovanou extrakci.
    """
    system_prompt = _load_prompt()

    user_block = {
        "USER_EMAIL": user_email,
        "USER_ALIASES": user_aliases,
        "USER_NAME": user_name,
        "THREAD_SUBJECT": thread_subject,
        "MESSAGES": messages,
    }

    settings = get_settings()
    client = _client()

    msg = client.messages.create(
        model=settings.llm_extractor_model,
        max_tokens=1024,
        system=[
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[
            {
                "role": "user",
                "content": json.dumps(user_block, ensure_ascii=False, default=str),
            }
        ],
    )

    text = "".join(block.text for block in msg.content if hasattr(block, "text"))
    text = text.strip()
    # ochrana pro případ, že by model přidal markdown
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip("` \n")
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        logger.warning("LLM nevrátil validní JSON: %s", text[:500])
        return ExtractedTask(
            is_task=False, direction=None, phase=None,
            title="", summary="", requested_output="",
            counterpart_email="", counterpart_name="",
            deadline=None, confidence=0.0,
            reason_if_not_task="LLM nevrátil validní JSON",
            raw={"text": text},
        )

    deadline = None
    if data.get("deadline_iso"):
        try:
            deadline = datetime.fromisoformat(data["deadline_iso"].replace("Z", "+00:00"))
        except (ValueError, TypeError):
            deadline = None

    return ExtractedTask(
        is_task=bool(data.get("is_task")),
        direction=data.get("direction"),
        phase=data.get("phase"),
        title=(data.get("title") or "")[:512],
        summary=data.get("summary") or "",
        requested_output=data.get("requested_output") or "",
        counterpart_email=(data.get("counterpart_email") or "").lower(),
        counterpart_name=data.get("counterpart_name") or "",
        deadline=deadline,
        confidence=float(data.get("confidence", 0.0)),
        reason_if_not_task=data.get("reason_if_not_task", ""),
        raw=data,
    )


def draft_ping(task_title: str, task_summary: str, last_messages: list[dict]) -> str:
    """Vygeneruje zdvořilý draft pingu / dotazu (volá se na vyžádání, Opus)."""
    settings = get_settings()
    client = _client()
    msg = client.messages.create(
        model=settings.llm_draft_model,
        max_tokens=600,
        system=(
            "Jsi asistent manažera. Napiš stručný, zdvořilý český draft emailu, "
            "kterým se uživatel zeptá na stav úkolu nebo požádá o termín. "
            "Drž se obsahu vlákna, nevymýšlej fakta. Vrať pouze text emailu bez subjectu."
        ),
        messages=[
            {
                "role": "user",
                "content": json.dumps(
                    {"task_title": task_title, "task_summary": task_summary, "last_messages": last_messages},
                    ensure_ascii=False, default=str,
                ),
            }
        ],
    )
    return "".join(block.text for block in msg.content if hasattr(block, "text")).strip()
