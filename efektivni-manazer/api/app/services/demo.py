"""Seed demo dat - realistické české korporátní scénáře napříč všemi fázemi."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete
from sqlalchemy.orm import Session

from ..models import (
    Message,
    Notification,
    NotificationLevel,
    Task,
    TaskDirection,
    TaskPhase,
    Thread,
)


def _h_ago(hours: float) -> datetime:
    return datetime.now(timezone.utc) - timedelta(hours=hours)


def _h_future(hours: float) -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=hours)


def wipe_demo(db: Session) -> None:
    """Smaže vše. Volat jen na žádost uživatele."""
    db.execute(delete(Notification))
    db.execute(delete(Task))
    db.execute(delete(Message))
    db.execute(delete(Thread))
    db.commit()


SCENARIOS: list[dict] = [
    # ============ DELEGOVANÉ (já → někdo) ============
    {
        "direction": "delegated",
        "phase": "awaiting_ack",
        "counterpart_name": "Petra Nováková",
        "counterpart_email": "petra.novakova@dodavatel.cz",
        "title": "Nabídka na nové kancelářské vybavení",
        "summary": "Poslal jsem požadavek na 30 židlí a 12 stolů pro nový open-space. "
                   "Petra zatím nepotvrdila přijetí.",
        "requested_output": "Cenová nabídka s termínem dodání",
        "subject": "Žádost o nabídku – kancelářské vybavení",
        "hours_ago": 30,
        "deadline": None,
        "outbound_body": "Dobrý den Petro,\n\npotřebovali bychom cenovou nabídku na 30 židlí "
                         "(model jako loni) a 12 pracovních stolů pro nový open-space ve 3. patře.\n\n"
                         "Můžete se prosím podívat a poslat cenu + termín dodání?\n\nDíky\nTorsten",
    },
    {
        "direction": "delegated",
        "phase": "awaiting_eta",
        "counterpart_name": "Jakub Veselý",
        "counterpart_email": "jakub.vesely@firma.cz",
        "title": "Návrh nové bezpečnostní směrnice",
        "summary": "Jakub potvrdil, že na směrnici začne pracovat, ale stále nedal konkrétní termín.",
        "requested_output": "Termín dodání draftu + finální verze",
        "subject": "Re: Revize bezpečnostní směrnice (Q2)",
        "hours_ago": 60,
        "deadline": None,
        "outbound_body": "Ahoj Jakube,\n\nje to úkol z minulého strategy meetingu. "
                         "Potřebujeme nový draft do konce kvartálu. Můžeš vzít?\n\nDíky\nT.",
        "inbound_body": "Ahoj,\n\nano, beru. Kouknu na to a dám vědět.\n\nJakub",
    },
    {
        "direction": "delegated",
        "phase": "in_progress",
        "counterpart_name": "Lucie Dvořáková",
        "counterpart_email": "lucie.dvorakova@firma.cz",
        "title": "Prezentace výsledků Q3 pro představenstvo",
        "summary": "Lucie pracuje na prezentaci. Termín za 3 dny, zatím vše dle plánu.",
        "requested_output": "Hotová prezentace v PowerPointu, cca 25 slidů",
        "subject": "Prezentace Q3 výsledků – board meeting",
        "hours_ago": 96,
        "deadline_hours": 72,
        "outbound_body": "Lucie, díky že to bereš. Termín je pondělí 9:00, board meeting v 10:30.",
        "inbound_body": "Beru, pracuju na tom. Mám draft, ke konci týdne pošlu k revizi.",
    },
    {
        "direction": "delegated",
        "phase": "awaiting_result",
        "counterpart_name": "Marek Procházka",
        "counterpart_email": "marek.prochazka@dodavatel.cz",
        "title": "Implementace platební brány v e-shopu",
        "summary": "Marek byl zticha, deadline je za 18 hodin. Měl by dnes pushnout do stagingu.",
        "requested_output": "Funkční integrace ComGate na staging, dokumentace",
        "subject": "Integrace platební brány – sprint goal",
        "hours_ago": 120,
        "deadline_hours": 18,
        "outbound_body": "Marku, jak to vypadá? Středa je deadline.",
        "inbound_body": "Jedu na tom, ve středu večer pošlu PR.",
    },
    {
        "direction": "delegated",
        "phase": "in_progress",
        "counterpart_name": "Tomáš Černý",
        "counterpart_email": "tomas.cerny@pravnik.cz",
        "title": "Revize smlouvy s dodavatelem XY",
        "summary": "PO TERMÍNU. Měl mít hotové předevčírem, nepřišlo nic, ani vyjádření.",
        "requested_output": "Revidovaná smlouva s komentáři",
        "subject": "Smlouva XY – právní revize",
        "hours_ago": 168,
        "deadline_hours": -48,  # 48h po termínu
        "outbound_body": "Tomáši, posílám smlouvu s dodavatelem XY na revizi. "
                         "Termín nejpozději pondělí.",
        "inbound_body": "Beru, do pondělí to bude.",
    },
    {
        "direction": "delegated",
        "phase": "new",
        "counterpart_name": "Anna Kratochvílová",
        "counterpart_email": "anna.k@hr.cz",
        "title": "Vypsat výběrové řízení na pozici Senior Developer",
        "summary": "Před chvílí odesláno. Anna ještě neodpověděla.",
        "requested_output": "Inzerát + plán pohovorů",
        "subject": "Recruitment – Senior Developer Q4",
        "hours_ago": 2,
        "deadline": None,
        "outbound_body": "Anno, prosím o vypsání pozice Senior Developer. "
                         "Detaily v příloze, salary band 90–120k. Děkuji.",
    },
    {
        "direction": "delegated",
        "phase": "done",
        "counterpart_name": "Pavel Krejčí",
        "counterpart_email": "pavel.krejci@firma.cz",
        "title": "Server upgrade ve výrobě",
        "summary": "Hotovo. Pavel poslal report v sobotu večer, vše proběhlo bez výpadku.",
        "requested_output": "Upgrade Postgres 14 → 16, downtime ne víc než 1h",
        "subject": "Postgres upgrade – produkce",
        "hours_ago": 240,
        "deadline_hours": -120,
        "closed": True,
        "outbound_body": "Pavle, prosím o upgrade Postgresu na produkci tento víkend.",
        "inbound_body": "Hotovo. 23 minut downtime, vše OK.",
    },
    # ============ MOJE ÚKOLY (někdo → já) ============
    {
        "direction": "mine",
        "phase": "new",
        "counterpart_name": "Šéf",
        "counterpart_email": "ceo@firma.cz",
        "title": "Doplnit reporting o segment SaaS",
        "summary": "CEO se ptá na revenue breakdown za SaaS produkt v Q3 reportu. "
                   "Čeká dnes odpoledne.",
        "requested_output": "Reporting Q3 doplněný o SaaS segment",
        "subject": "Q3 report – chybí SaaS",
        "hours_ago": 6,
        "deadline_hours": 4,
        "inbound_body": "Torstene, v Q3 reportu chybí breakdown SaaS revenue. "
                        "Můžeš to do oběda doplnit a poslat?",
    },
    {
        "direction": "mine",
        "phase": "new",
        "counterpart_name": "Jana Holubová",
        "counterpart_email": "jana.holubova@klient.cz",
        "title": "Schůzka 14.6. – potvrdit účast",
        "summary": "Klient navrhuje termín schůzky. Měl bys odpovědět dnes.",
        "requested_output": "Potvrzení / návrh jiného termínu",
        "subject": "Návrh schůzky – kontrakt Q4",
        "hours_ago": 5,
        "deadline": None,
        "inbound_body": "Dobrý den,\n\nnavrhuji schůzku k novému kontraktu 14.6. od 14:00 "
                        "u nás v kanceláři. Vyhovuje?\n\nS pozdravem\nJana Holubová",
    },
    {
        "direction": "mine",
        "phase": "acked",
        "counterpart_name": "Daniel Polák",
        "counterpart_email": "dan@vendor.io",
        "title": "Schválit přidání nového vendora do systému",
        "summary": "Potvrdil jsem že to vyřeším. Čeká se na akci ode mě.",
        "requested_output": "Schválení v admin konzoli + odpověď Danovi",
        "subject": "Approval – nový vendor (Foo a.s.)",
        "hours_ago": 28,
        "deadline": None,
        "inbound_body": "Hi Torsten, můžeš schválit přidání 'Foo a.s.' jako nového vendora?",
        "outbound_body": "Ahoj Dane, kouknu na to do zítřka.",
    },
    {
        "direction": "mine",
        "phase": "blocked",
        "counterpart_name": "Klára Svobodová",
        "counterpart_email": "klara.svobodova@firma.cz",
        "title": "Schválit rozpočet marketingu na Q4",
        "summary": "Čekám na podklady od finančního odd. – bez nich nemohu schválit. "
                   "Klára čeká, je v presu kvůli kampani.",
        "requested_output": "Schválený nebo zamítnutý budget",
        "subject": "Marketing budget Q4 – approval",
        "hours_ago": 50,
        "deadline_hours": 48,
        "inbound_body": "Torstene, posílám návrh marketingového budgetu na Q4. "
                        "Potřebuju do týdne schválit, jinak nestihneme Black Friday.",
        "outbound_body": "Klárko, chci ten budget srovnat s finančním plánem, "
                         "ozvu se až dostanu podklady z účtárny.",
    },
    {
        "direction": "mine",
        "phase": "in_progress",
        "counterpart_name": "Filip Bárta",
        "counterpart_email": "filip@partner.com",
        "title": "Code review PR #2847",
        "summary": "Mám rozdělaný review, zbývá projet poslední 2 commity.",
        "requested_output": "Approve / Request changes",
        "subject": "PR #2847 – feature/payment-flow",
        "hours_ago": 10,
        "deadline": None,
        "inbound_body": "Hoď oko prosím na PR #2847, je to relativně urgent, "
                        "deployujeme ve čtvrtek.",
    },
    {
        "direction": "mine",
        "phase": "done",
        "counterpart_name": "Eva Horáková",
        "counterpart_email": "eva.horakova@klient.cz",
        "title": "Připravit nabídku pro klienta XYZ",
        "summary": "Hotovo, odesláno klientovi včera. Eva poděkovala.",
        "requested_output": "Nabídka v PDF",
        "subject": "Nabídka XYZ – příprava",
        "hours_ago": 72,
        "deadline_hours": -24,
        "closed": True,
        "inbound_body": "Můžeš prosím připravit nabídku pro XYZ do pátku? Detaily v meetingu.",
        "outbound_body": "Hotovo, posílám PDF.",
    },
]


def seed_demo_data(db: Session, my_email: str = "torsten@firma.cz", my_name: str = "Torsten") -> dict[str, int]:
    """Naplní DB demo daty. Předpokládá, že DB je prázdná (nebo bude smazána)."""
    wipe_demo(db)

    created_threads = 0
    created_messages = 0
    created_tasks = 0
    created_notifications = 0

    for i, sc in enumerate(SCENARIOS):
        thread = Thread(
            subject=sc["subject"],
            participants=[my_email, sc["counterpart_email"]],
            last_message_at=_h_ago(sc["hours_ago"]),
        )
        db.add(thread)
        db.flush()
        created_threads += 1

        # Vytvoř messages podle scénáře – mohou být oba směry pro realistický thread
        msg_time = _h_ago(sc["hours_ago"])
        if sc["direction"] == "delegated":
            # Já napsal první
            db.add(Message(
                thread_id=thread.id,
                message_id_hdr=f"demo-{i}-out-1@local",
                folder="Sent", direction="outbound",
                from_addr=my_email,
                to_addrs=[sc["counterpart_email"]],
                cc_addrs=[],
                subject=sc["subject"],
                date=msg_time,
                body_text=sc.get("outbound_body", ""),
                raw_headers={},
            ))
            created_messages += 1
            if "inbound_body" in sc:
                db.add(Message(
                    thread_id=thread.id,
                    message_id_hdr=f"demo-{i}-in-1@local",
                    folder="INBOX", direction="inbound",
                    from_addr=sc["counterpart_email"],
                    to_addrs=[my_email],
                    cc_addrs=[],
                    subject="Re: " + sc["subject"],
                    date=msg_time + timedelta(hours=2),
                    body_text=sc["inbound_body"],
                    raw_headers={},
                ))
                created_messages += 1
        else:
            # Někdo napsal mně
            db.add(Message(
                thread_id=thread.id,
                message_id_hdr=f"demo-{i}-in-1@local",
                folder="INBOX", direction="inbound",
                from_addr=sc["counterpart_email"],
                to_addrs=[my_email],
                cc_addrs=[],
                subject=sc["subject"],
                date=msg_time,
                body_text=sc.get("inbound_body", ""),
                raw_headers={},
            ))
            created_messages += 1
            if "outbound_body" in sc:
                db.add(Message(
                    thread_id=thread.id,
                    message_id_hdr=f"demo-{i}-out-1@local",
                    folder="Sent", direction="outbound",
                    from_addr=my_email,
                    to_addrs=[sc["counterpart_email"]],
                    cc_addrs=[],
                    subject="Re: " + sc["subject"],
                    date=msg_time + timedelta(hours=1),
                    body_text=sc["outbound_body"],
                    raw_headers={},
                ))
                created_messages += 1

        # Deadline
        deadline = None
        if "deadline_hours" in sc and sc["deadline_hours"] is not None:
            deadline = _h_future(sc["deadline_hours"])

        task = Task(
            thread_id=thread.id,
            direction=TaskDirection(sc["direction"]),
            phase=TaskPhase(sc["phase"]),
            counterpart_email=sc["counterpart_email"],
            counterpart_name=sc["counterpart_name"],
            title=sc["title"],
            summary=sc["summary"],
            requested_output=sc["requested_output"],
            deadline=deadline,
            last_activity_at=_h_ago(sc["hours_ago"]),
            closed_at=_h_ago(0) if sc.get("closed") else None,
            extractor_meta={"demo": True, "confidence": 0.95},
        )
        db.add(task)
        db.flush()
        created_tasks += 1

        # Některým úkolům přidej notifikaci
        if sc["phase"] in ("awaiting_ack", "awaiting_eta") and sc["hours_ago"] > 24:
            db.add(Notification(
                task_id=task.id, rule_id=None,
                level=NotificationLevel.warning,
                message="Pingnout – druhá strana zatím nepotvrdila / nedala termín.",
            ))
            created_notifications += 1
        if deadline and deadline < datetime.now(timezone.utc):
            db.add(Notification(
                task_id=task.id, rule_id=None,
                level=NotificationLevel.urgent,
                message="Urgovat – termín prošel.",
            ))
            created_notifications += 1
        if sc["direction"] == "mine" and sc["phase"] == "new" and sc["hours_ago"] > 4:
            db.add(Notification(
                task_id=task.id, rule_id=None,
                level=NotificationLevel.warning,
                message="Odpovědět – druhá strana čeká.",
            ))
            created_notifications += 1

    db.commit()
    return {
        "threads": created_threads,
        "messages": created_messages,
        "tasks": created_tasks,
        "notifications": created_notifications,
    }
