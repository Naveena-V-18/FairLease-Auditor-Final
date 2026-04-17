import re


def _safe_number(value):
    try:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        cleaned = re.sub(r"[^0-9.-]", "", str(value))
        if not cleaned or cleaned in {"-", ".", "-."}:
            return None
        return float(cleaned)
    except Exception:
        return None


def _has_any(text: str, terms):
    return any(term in text for term in terms)


def _snippet(text: str, terms, width: int = 160):
    lower = text.lower()
    for term in terms:
        index = lower.find(term)
        if index >= 0:
            start = max(0, index - width // 2)
            end = min(len(text), index + len(term) + width // 2)
            return text[start:end].strip()
    return ""


def _extract_first_match(text: str, patterns):
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            for group in match.groups():
                if group is not None:
                    return group.strip()
            return match.group(0).strip()
    return None


def _extract_number(text: str, patterns):
    value = _extract_first_match(text, patterns)
    return _safe_number(value)


def _status_to_confidence(status: str, evidence: str):
    if status == "fail":
        return "high" if evidence else "medium"
    if status == "pass":
        return "high" if evidence else "medium"
    if status == "warning":
        return "medium" if evidence else "low"
    return "low"


def evaluate_lease_rules(text: str, extracted_data: dict | None = None):
    extracted_data = extracted_data or {}
    lower_text = text.lower()

    rent = _safe_number(extracted_data.get("rent"))
    deposit = _safe_number(extracted_data.get("deposit"))

    if rent is None:
        rent = _extract_number(
            lower_text,
            [
                r"rent\s*[:=]?\s*(?:rs\.?\s*)?([0-9][0-9,]*(?:\.[0-9]+)?)",
                r"monthly rent\s*[:=]?\s*(?:rs\.?\s*)?([0-9][0-9,]*(?:\.[0-9]+)?)",
            ],
        )

    if deposit is None:
        deposit = _extract_number(
            lower_text,
            [
                r"deposit\s*[:=]?\s*(?:rs\.?\s*)?([0-9][0-9,]*(?:\.[0-9]+)?)",
                r"security deposit\s*[:=]?\s*(?:rs\.?\s*)?([0-9][0-9,]*(?:\.[0-9]+)?)",
            ],
        )

    notice_period = _extract_first_match(
        lower_text,
        [
            r"(\d+\s*(?:days?|months?))\s+notice",
            r"notice\s+period\s*[:=]?\s*(\d+\s*(?:days?|months?))",
        ],
    )
    lock_in = _extract_first_match(
        lower_text,
        [
            r"lock[- ]?in\s*(?:period\s*)?(?:of)?\s*(\d+\s*(?:months?|month))",
            r"minimum lock[- ]?in\s*(\d+\s*(?:months?|month))",
        ],
    )
    late_fee = _extract_first_match(
        lower_text,
        [
            r"late\s+fee[^\n\r.]*?(\d+%|rs\.?\s*\d[\d,]*(?:\.\d+)?)",
            r"penalty[^\n\r.]*?(\d+%|rs\.?\s*\d[\d,]*(?:\.\d+)?)",
        ],
    )
    maintenance = _extract_first_match(
        lower_text,
        [r"maintenance[^\n\r.]{0,140}", r"repair[^\n\r.]{0,140}"],
    )
    entry_notice = _extract_first_match(
        lower_text,
        [r"entry[^\n\r.]{0,180}", r"access[^\n\r.]{0,180}"],
    )
    termination = _extract_first_match(
        lower_text,
        [r"termination[^\n\r.]{0,180}", r"eviction[^\n\r.]{0,180}"],
    )
    refund_timeline = _extract_first_match(
        lower_text,
        [r"refund[^\n\r.]{0,180}", r"returned[^\n\r.]{0,180}"],
    )
    dispute_resolution = _extract_first_match(
        lower_text,
        [r"dispute[^\n\r.]{0,180}", r"jurisdiction[^\n\r.]{0,180}", r"arbitration[^\n\r.]{0,180}"],
    )
    property_details = _extract_first_match(
        lower_text,
        [r"address[^\n\r.]{0,180}", r"premises[^\n\r.]{0,180}", r"schedule[^\n\r.]{0,180}"],
    )

    rule_breakdown = []
    critical_flags = []
    deduction_total = 0

    def add_rule(rule_id, title, status, deduction, reason, evidence, severity="medium"):
        nonlocal deduction_total
        deduction_total += max(0, int(deduction))
        if status == "fail":
            critical_flags.append(title)
        rule_breakdown.append(
            {
                "rule_id": rule_id,
                "title": title,
                "status": status,
                "severity": severity,
                "score_impact": int(deduction),
                "reason": reason,
                "evidence": evidence,
                "confidence": _status_to_confidence(status, evidence),
            }
        )

    party_terms = ["lessor", "lessee", "landlord", "tenant"]
    identity_present = _has_any(lower_text, party_terms) and _has_any(lower_text, ["address", "premises", "property"])
    if not identity_present:
        add_rule(
            "R-12",
            "Mandatory identity and property details",
            "fail",
            18,
            "Party or property identity details are not clearly visible in the document text.",
            _snippet(lower_text, party_terms + ["address", "property", "premises"]),
            "critical",
        )
    else:
        add_rule(
            "R-12",
            "Mandatory identity and property details",
            "pass",
            0,
            "The lease text includes the core party and property markers.",
            _snippet(lower_text, party_terms + ["address", "property", "premises"]),
            "low",
        )

    if rent is None or deposit is None:
        add_rule(
            "R-01",
            "Deposit fairness",
            "warning",
            10,
            "Rent or deposit could not be fully extracted, so the cap check is only partially verified.",
            _snippet(lower_text, ["deposit", "security deposit", "rent"]),
            "medium",
        )
    else:
        ratio = deposit / rent if rent else None
        if ratio is not None and ratio > 3:
            add_rule(
                "R-01",
                "Deposit fairness",
                "fail",
                28,
                f"Deposit is about {ratio:.1f}x the monthly rent, which is above the expected 3-month style cap.",
                _snippet(lower_text, ["deposit", "security deposit", "rent"]),
                "high",
            )
        elif ratio is not None and ratio > 2.5:
            add_rule(
                "R-01",
                "Deposit fairness",
                "warning",
                14,
                f"Deposit is about {ratio:.1f}x the monthly rent and is approaching the expected cap.",
                _snippet(lower_text, ["deposit", "security deposit", "rent"]),
                "medium",
            )
        else:
            add_rule(
                "R-01",
                "Deposit fairness",
                "pass",
                0,
                "Deposit stays within the expected fairness threshold.",
                _snippet(lower_text, ["deposit", "security deposit", "rent"]),
                "high",
            )

    escalation_present = _has_any(lower_text, ["rent increase", "escalation", "revision", "increase in rent"])
    if not escalation_present:
        add_rule(
            "R-02",
            "Rent escalation clarity",
            "warning",
            8,
            "The lease text does not clearly mention how rent escalation will happen.",
            _snippet(lower_text, ["rent increase", "escalation", "revision", "increase in rent"]),
            "medium",
        )
    else:
        percent_or_timing = _has_any(lower_text, ["%", "month", "year", "annually", "once every"])
        add_rule(
            "R-02",
            "Rent escalation clarity",
            "pass" if percent_or_timing else "warning",
            0 if percent_or_timing else 10,
            "The escalation clause is visible and has a measurable condition." if percent_or_timing else "The lease mentions rent escalation but the timing or percentage is not clearly bounded.",
            _snippet(lower_text, ["rent increase", "escalation", "revision", "increase in rent"]),
            "high" if percent_or_timing else "medium",
        )

    if not notice_period:
        add_rule(
            "R-03",
            "Notice period balance",
            "warning",
            8,
            "The exit notice period is not clearly extractable from the lease text.",
            _snippet(lower_text, ["notice", "termination", "vacate"]),
            "medium",
        )
    else:
        notice_number = _extract_number(notice_period.lower(), [r"(\d+)"])
        if notice_number is not None and notice_number > 90:
            add_rule(
                "R-03",
                "Notice period balance",
                "fail",
                14,
                f"The notice period appears unusually long at about {int(notice_number)} days or months, which can be one-sided.",
                notice_period,
                "medium",
            )
        else:
            add_rule(
                "R-03",
                "Notice period balance",
                "pass",
                0,
                "A notice period is visible and appears reasonably defined.",
                notice_period,
                "high",
            )

    if not lock_in:
        add_rule(
            "R-04",
            "Lock-in period fairness",
            "warning",
            8,
            "The lock-in period is not clearly visible in the document text.",
            _snippet(lower_text, ["lock-in", "lock in", "minimum period"]),
            "medium",
        )
    else:
        lock_in_months = _extract_number(lock_in.lower(), [r"(\d+)"])
        has_penalty = _has_any(lower_text, ["penalty", "forfeit", "forfeiture", "liquidated damages"])
        if lock_in_months is not None and lock_in_months > 12:
            add_rule(
                "R-04",
                "Lock-in period fairness",
                "fail",
                15,
                f"The lock-in period appears to be about {int(lock_in_months)} months, which is relatively heavy for a tenant.",
                lock_in,
                "medium",
            )
        elif has_penalty and lock_in_months is not None:
            add_rule(
                "R-04",
                "Lock-in period fairness",
                "warning",
                10,
                "The lease combines lock-in language with penalty wording, which can become tenant-unfriendly.",
                lock_in,
                "medium",
            )
        else:
            add_rule(
                "R-04",
                "Lock-in period fairness",
                "pass",
                0,
                "The lock-in language is visible and does not look unusually harsh.",
                lock_in,
                "high",
            )

    if not late_fee:
        add_rule(
            "R-05",
            "Penalty and late fee proportionality",
            "warning",
            7,
            "Late fee or penalty wording is not clearly visible.",
            _snippet(lower_text, ["late fee", "penalty", "default"]),
            "medium",
        )
    else:
        open_ended = _has_any(lower_text, ["per day", "every day", "without limit", "until payment"])
        if open_ended:
            add_rule(
                "R-05",
                "Penalty and late fee proportionality",
                "warning",
                12,
                "The late fee appears open-ended or recurring, so it may not be proportionate.",
                late_fee,
                "medium",
            )
        else:
            add_rule(
                "R-05",
                "Penalty and late fee proportionality",
                "pass",
                0,
                "A bounded penalty or late fee clause is visible.",
                late_fee,
                "high",
            )

    if not maintenance:
        add_rule(
            "R-06",
            "Maintenance responsibility clarity",
            "warning",
            6,
            "Maintenance responsibilities are not clearly visible in the text.",
            _snippet(lower_text, ["maintenance", "repair", "repairs"]),
            "medium",
        )
    else:
        one_sided = _has_any(lower_text, ["tenant shall bear all", "tenant is responsible for all repairs", "owner shall not be liable"])
        add_rule(
            "R-06",
            "Maintenance responsibility clarity",
            "warning" if one_sided else "pass",
            8 if one_sided else 0,
            "The maintenance clause looks heavily one-sided." if one_sided else "Maintenance language is visible and appears balanced enough for review.",
            maintenance,
            "medium" if one_sided else "high",
        )

    if not entry_notice:
        add_rule(
            "R-07",
            "Entry and privacy rights",
            "warning",
            8,
            "Landlord entry or access rules are not clearly visible.",
            _snippet(lower_text, ["entry", "access", "inspection"]),
            "medium",
        )
    else:
        if _has_any(lower_text, ["any time", "without notice", "no notice", "unrestricted access"]):
            add_rule(
                "R-07",
                "Entry and privacy rights",
                "fail",
                16,
                "The lease appears to allow entry without notice or with overly broad access rights.",
                entry_notice,
                "high",
            )
        else:
            add_rule(
                "R-07",
                "Entry and privacy rights",
                "pass",
                0,
                "The entry clause is visible and does not look openly intrusive.",
                entry_notice,
                "high",
            )

    if not termination:
        add_rule(
            "R-08",
            "Termination and eviction terms",
            "warning",
            8,
            "Termination or eviction language is not clearly visible.",
            _snippet(lower_text, ["termination", "eviction", "cancel"]),
            "medium",
        )
    else:
        if _has_any(lower_text, ["any time", "at sole discretion", "without reason", "immediate termination"]):
            add_rule(
                "R-08",
                "Termination and eviction terms",
                "fail",
                16,
                "The termination clause appears arbitrary or too one-sided.",
                termination,
                "high",
            )
        else:
            add_rule(
                "R-08",
                "Termination and eviction terms",
                "pass",
                0,
                "The termination wording is visible and appears bounded.",
                termination,
                "high",
            )

    if not refund_timeline:
        add_rule(
            "R-09",
            "Refund timeline for deposit",
            "warning",
            8,
            "The deposit refund timeline is not clearly visible.",
            _snippet(lower_text, ["refund", "returned", "security deposit"]),
            "medium",
        )
    else:
        refund_days = _extract_number(refund_timeline.lower(), [r"(\d+)"])
        if refund_days is not None and refund_days > 60:
            add_rule(
                "R-09",
                "Refund timeline for deposit",
                "fail",
                12,
                f"The refund timeline appears to be around {int(refund_days)} days, which may be too slow for tenant protection.",
                refund_timeline,
                "medium",
            )
        else:
            add_rule(
                "R-09",
                "Refund timeline for deposit",
                "pass",
                0,
                "A refund timeline is visible and does not look unusually delayed.",
                refund_timeline,
                "high",
            )

    if not _has_any(lower_text, ["charge", "charges", "brokerage", "utility", "service fee", "service charge"]):
        add_rule(
            "R-10",
            "Hidden charges",
            "warning",
            6,
            "No explicit charge section is visible, so hidden fees cannot be ruled out from the text alone.",
            _snippet(lower_text, ["charge", "charges", "brokerage", "utility", "service fee", "service charge"]),
            "medium",
        )
    else:
        add_rule(
            "R-10",
            "Hidden charges",
            "pass",
            0,
            "The lease mentions charge-related terms, which helps surface potential extra costs.",
            _snippet(lower_text, ["charge", "charges", "brokerage", "utility", "service fee", "service charge"]),
            "high",
        )

    if not dispute_resolution:
        add_rule(
            "R-11",
            "Dispute resolution clause",
            "warning",
            6,
            "Jurisdiction or arbitration language is not clearly visible.",
            _snippet(lower_text, ["jurisdiction", "arbitration", "dispute", "court"]),
            "medium",
        )
    else:
        if _has_any(lower_text, ["exclusive jurisdiction", "solely", "only", "far away"]):
            add_rule(
                "R-11",
                "Dispute resolution clause",
                "warning",
                8,
                "The dispute resolution language appears restrictive and may favour one side.",
                dispute_resolution,
                "medium",
            )
        else:
            add_rule(
                "R-11",
                "Dispute resolution clause",
                "pass",
                0,
                "A dispute resolution clause is visible and can be reviewed by the user.",
                dispute_resolution,
                "high",
            )

    deduction_total = min(deduction_total, 100)
    rule_score = max(0, 100 - deduction_total)
    supported_rules = sum(1 for rule in rule_breakdown if rule["status"] != "unknown")
    confidence_percent = round((supported_rules / max(len(rule_breakdown), 1)) * 100)
    if confidence_percent >= 75:
        confidence_level = "high"
    elif confidence_percent >= 50:
        confidence_level = "medium"
    else:
        confidence_level = "low"

    structured_fields = {
        "rent": rent,
        "deposit": deposit,
        "notice_period": notice_period or extracted_data.get("notice_period", "MISSING"),
        "lock_in": lock_in or extracted_data.get("lock_in", "MISSING"),
        "late_fee": late_fee or extracted_data.get("late_fee", "MISSING"),
        "maintenance": maintenance or extracted_data.get("maintenance", "MISSING"),
        "entry_notice": entry_notice or extracted_data.get("entry_notice", "MISSING"),
        "termination": termination or extracted_data.get("termination", "MISSING"),
        "refund_timeline": refund_timeline or extracted_data.get("refund_timeline", "MISSING"),
        "dispute_resolution": dispute_resolution or extracted_data.get("dispute_resolution", "MISSING"),
        "property_details": property_details or extracted_data.get("property_details", "MISSING"),
    }

    return {
        "rule_score": rule_score,
        "rule_breakdown": rule_breakdown,
        "critical_flags": critical_flags,
        "confidence_level": confidence_level,
        "confidence_percent": confidence_percent,
        "structured_fields": structured_fields,
    }