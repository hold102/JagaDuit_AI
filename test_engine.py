"""
JagaDuit AI — Rule Engine + AI Strength Test
Run: python3 test_engine.py
Requires backend running at http://localhost:8000
"""

import requests
import json

BASE = "http://localhost:8000/api/analyze"

RESET  = "\033[0m"
BOLD   = "\033[1m"
RED    = "\033[91m"
AMBER  = "\033[93m"
GREEN  = "\033[92m"
CYAN   = "\033[96m"
GRAY   = "\033[90m"
WHITE  = "\033[97m"

SCENARIOS = [
    {
        "label": "Parcel Fee Scam (obvious)",
        "tier":  "Should be HIGH",
        "message": (
            "Notis: Parcel anda (MY-48210) telah ditahan di pusat logistik. "
            "Bayaran RM4.80 perlu dibuat dalam masa 24 jam. "
            "Klik pautan untuk bayar: http://pos-malaysia-delivery.xyz/pay"
        ),
        "context": {
            "recipient": "Unknown Sender",
            "amount": "4.80",
            "paymentPurpose": "parcel_fee",
            "requestSource": "whatsapp",
            "recipientType": "unknown",
        },
    },
    {
        "label": "LHDN Impersonation (obvious)",
        "tier":  "Should be HIGH",
        "message": (
            "LHDN: Akaun cukai anda menunjukkan tunggakan RM 1,200. "
            "Bayar segera kepada Mohd Faizi bin Razak atau tindakan undang-undang akan diambil. "
            "Jangan beritahu sesiapa tentang pembayaran ini."
        ),
        "context": {
            "recipient": "Mohd Faizi bin Razak",
            "amount": "1200",
            "paymentPurpose": "bank_request",
            "requestSource": "sms",
            "recipientType": "unknown",
        },
    },
    {
        "label": "Investment Scam (obvious)",
        "tier":  "Should be HIGH",
        "message": (
            "Peluang pelaburan terbaik! Jamin pulangan 30% dalam 7 hari. "
            "Deposit RM 500 sekarang ke akaun crypto kami. "
            "Hubungi segera sebelum tempat penuh."
        ),
        "context": {
            "recipient": "Investment Group",
            "amount": "500",
            "paymentPurpose": "investment",
            "requestSource": "telegram",
            "recipientType": "unknown",
        },
    },
    {
        "label": "Fake Job Offer",
        "tier":  "Should be HIGH",
        "message": (
            "Tahniah! Anda telah dipilih untuk jawatan Pengurus Jualan. "
            "Sila bayar yuran pendaftaran RM 200 dan yuran latihan RM 150 "
            "untuk mengesahkan tempat anda. Bayar hari ini juga."
        ),
        "context": {
            "recipient": "HR Department",
            "amount": "350",
            "paymentPurpose": "job_fee",
            "requestSource": "whatsapp",
            "recipientType": "unknown",
        },
    },
    {
        "label": "Paraphrased Threat (AI should catch, rules may miss)",
        "tier":  "Should be HIGH — tests AI advantage",
        "message": (
            "Your banking privileges have been temporarily suspended due to unusual activity. "
            "To restore full access, kindly transfer RM 800 to our verification account. "
            "Our specialist is standing by to assist you."
        ),
        "context": {
            "recipient": "Verification Account",
            "amount": "800",
            "paymentPurpose": "bank_request",
            "requestSource": "email",
            "recipientType": "unknown",
        },
    },
    {
        "label": "Emergency Family Scam",
        "tier":  "Should be MEDIUM–HIGH",
        "message": (
            "Ibu, ini kakak. Kakak kemalangan dan kena masuk hospital sekarang. "
            "Doktor cakap perlu bayar RM 600 dahulu. "
            "Tolong transfer cepat, kakak dalam kesakitan."
        ),
        "context": {
            "recipient": "Unknown",
            "amount": "600",
            "paymentPurpose": "other",
            "requestSource": "whatsapp",
            "recipientType": "unknown",
        },
    },
    {
        "label": "Prize / Lucky Draw Scam",
        "tier":  "Should be MEDIUM–HIGH",
        "message": (
            "Tahniah! Anda telah memenangi hadiah wang tunai RM 10,000 dalam cabutan bertuah kami. "
            "Untuk menuntut hadiah, sila bayar yuran tuntutan sebanyak RM 50 dahulu."
        ),
        "context": {
            "recipient": "Lucky Draw Centre",
            "amount": "50",
            "paymentPurpose": "other",
            "requestSource": "sms",
            "recipientType": "unknown",
        },
    },
    {
        "label": "Legitimate Transfer (friend)",
        "tier":  "Should be LOW",
        "message": (
            "Hi, boleh tolong transfer RM 30 untuk makan tengahari tadi? "
            "Terima kasih banyak-banyak!"
        ),
        "context": {
            "recipient": "Ahmad",
            "amount": "30",
            "paymentPurpose": "other",
            "requestSource": "whatsapp",
            "recipientType": "individual",
            "isNewReceiver": False,
        },
    },
    {
        "label": "Legitimate Bill Payment",
        "tier":  "Should be LOW",
        "message": (
            "Your Unifi bill for this month is RM 129.00. "
            "Please make payment before 30th to avoid service interruption."
        ),
        "context": {
            "recipient": "TM Unifi",
            "amount": "129",
            "paymentPurpose": "other",
            "requestSource": "email",
            "recipientType": "business",
            "isNewReceiver": False,
        },
    },
    {
        "label": "Subtle Scam — No Obvious Keywords (AI stress test)",
        "tier":  "Should be MEDIUM — tests AI advantage",
        "message": (
            "Hello, I am calling from your bank's security team. "
            "We noticed some unusual transactions on your account. "
            "For your protection, please move your funds to our secure holding account. "
            "This is completely confidential and time-sensitive."
        ),
        "context": {
            "recipient": "Secure Account",
            "amount": "2000",
            "paymentPurpose": "bank_request",
            "requestSource": "phone_call",
            "recipientType": "unknown",
        },
    },
]


def level_badge(level, score):
    if level == "high" or score >= 70:
        return f"{RED}{BOLD}🔴 HIGH  ({score}/100){RESET}"
    if level == "medium" or score >= 40:
        return f"{AMBER}{BOLD}🟡 MEDIUM ({score}/100){RESET}"
    return f"{GREEN}{BOLD}🟢 LOW   ({score}/100){RESET}"


def bar(score, width=30):
    filled = int(score / 100 * width)
    if score >= 70:
        colour = RED
    elif score >= 40:
        colour = AMBER
    else:
        colour = GREEN
    return f"{colour}{'█' * filled}{GRAY}{'░' * (width - filled)}{RESET}"


def run():
    print(f"\n{BOLD}{CYAN}{'═' * 65}")
    print("  JagaDuit AI — Rule Engine + AI Strength Test")
    print(f"{'═' * 65}{RESET}\n")

    passed = failed = 0
    results = []

    for i, s in enumerate(SCENARIOS, 1):
        print(f"{BOLD}{WHITE}[{i:02d}] {s['label']}{RESET}")
        print(f"     {GRAY}Expected: {s['tier']}{RESET}")

        try:
            resp = requests.post(BASE, json={
                "message": s["message"],
                "payment_context": s["context"],
            }, timeout=30)
            resp.raise_for_status()
            d = resp.json()
        except requests.exceptions.ConnectionError:
            print(f"     {RED}✗ Cannot connect to backend. Is it running?{RESET}\n")
            return
        except Exception as e:
            print(f"     {RED}✗ Error: {e}{RESET}\n")
            failed += 1
            continue

        score      = d.get("risk_score", 0)
        level      = d.get("risk_level", "low")
        ai_contrib = d.get("ai_contribution", 0)
        rule_score = score - ai_contrib
        scam_type  = d.get("scam_type") or d.get("scamType") or "—"
        red_flags  = d.get("red_flags") or []

        print(f"\n     {bar(score)}  {level_badge(level, score)}")
        print(f"     {CYAN}Rule engine:{RESET} {rule_score:>3}/100  {GRAY}│{RESET}  "
              f"{CYAN}AI contribution:{RESET} +{ai_contrib:>2}  {GRAY}│{RESET}  "
              f"{CYAN}Blended:{RESET} {score}/100")
        print(f"     {CYAN}Scam type:{RESET}   {scam_type}")

        if red_flags:
            print(f"     {CYAN}Red flags:{RESET}")
            for flag in red_flags[:4]:
                print(f"       {RED}•{RESET} {flag}")
            if len(red_flags) > 4:
                print(f"       {GRAY}… and {len(red_flags) - 4} more{RESET}")

        results.append({
            "label": s["label"],
            "score": score,
            "level": level,
            "ai_contrib": ai_contrib,
            "rule_score": rule_score,
        })

        print()

    # ── Summary table ──────────────────────────────────────
    print(f"\n{BOLD}{CYAN}{'─' * 65}")
    print(f"  SUMMARY")
    print(f"{'─' * 65}{RESET}")
    print(f"  {'Scenario':<42} {'Rules':>5}  {'AI':>4}  {'Final':>5}  Level")
    print(f"  {'─'*42} {'─'*5}  {'─'*4}  {'─'*5}  {'─'*6}")

    for r in results:
        lvl = r["level"]
        col = RED if lvl == "high" else (AMBER if lvl == "medium" else GREEN)
        print(f"  {r['label'][:42]:<42} "
              f"{r['rule_score']:>5}  "
              f"+{r['ai_contrib']:>3}  "
              f"{r['score']:>5}  "
              f"{col}{lvl.upper():<6}{RESET}")

    ai_boosts = [r for r in results if r["ai_contrib"] > 0]
    print(f"\n  {CYAN}AI boosted {len(ai_boosts)}/{len(results)} scenarios "
          f"(avg +{sum(r['ai_contrib'] for r in results) // max(len(results),1)} pts){RESET}")
    print(f"  {CYAN}Run against {len(SCENARIOS)} scenarios "
          f"({sum(1 for r in results if r['level']=='high')} high, "
          f"{sum(1 for r in results if r['level']=='medium')} medium, "
          f"{sum(1 for r in results if r['level']=='low')} low){RESET}")
    print()


if __name__ == "__main__":
    run()
