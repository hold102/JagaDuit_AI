"""
Voice Call Scanner — Full Pipeline Accuracy Test
Simulates realistic voice call transcripts and runs the complete
4-signal pipeline (Rule + AI + ML Classifier + Reputation + Dynamic Scoring).

Run: python3 test_voice.py
"""

import asyncio
import sys
import os

from services.ai_analyzer     import analyze_message_sync
from services.risk_engine     import analyze_risk
from services.scam_classifier import classify
from services.reputation      import check_reputation
from services.dynamic_scoring import compute

RESET = "\033[0m"; BOLD = "\033[1m"
RED   = "\033[91m"; AMBER = "\033[93m"; GREEN = "\033[92m"
CYAN  = "\033[96m"; GRAY  = "\033[90m"; WHITE = "\033[97m"

# ── Realistic voice call transcripts ─────────────────────────────────────────
# Each entry: (transcript, expected_label, scenario_name)
# 1 = scam call,  0 = legitimate call

VOICE_SCENARIOS = [

    # ════════════════════════════════════════════════
    #  MACAU SCAM / AUTHORITY IMPERSONATION
    #  Most common scam call type in Malaysia
    # ════════════════════════════════════════════════
    ("""Hello, selamat pagi. Saya Inspektor Ahmad dari Polis DiRaja Malaysia.
Kami sedang menyiasat kes pengubahan wang haram dan nombor akaun anda
telah dikenal pasti terlibat. Anda perlu bekerjasama dengan siasatan kami.
Untuk membersihkan nama anda, anda perlu memindahkan wang simpanan ke
akaun selamat kami dalam masa 2 jam. Jangan beritahu sesiapa tentang perkara ini.""",
     1, "Macau Scam — Malay police impersonation"),

    ("""Good morning, this is Officer Ramesh from the Cybercrime Division.
We have detected that your bank account has been used for illegal transactions.
To avoid arrest, you must transfer all your savings to our protected government
account immediately. Do not hang up and do not tell your family about this call.""",
     1, "Macau Scam — English cybercrime impersonation"),

    ("""Saya dari LHDN. Akaun cukai pendapatan anda menunjukkan tunggakan sebanyak
RM 4,500. Jika tidak dijelaskan dalam tempoh 24 jam, kami terpaksa mengambil
tindakan undang-undang termasuk membekukan akaun bank anda dan mengeluarkan
waran tangkap. Hubungi pegawai kami segera untuk menyelesaikan perkara ini.""",
     1, "LHDN tax scam — Malay"),

    ("""This is a call from Bank Negara Malaysia compliance department.
Our system detected suspicious activity on your account.
For your protection, please cooperate with our officer and transfer
your funds to our secure holding account while we investigate.
This is strictly confidential — do not inform anyone.""",
     1, "Bank Negara impersonation — English"),

    ("""Selamat petang, saya dari Jabatan Imigresen Malaysia.
Pasport anda telah digunakan untuk aktiviti haram di sempadan.
Anda akan dideportasi jika tidak membayar denda RM 3,000 dalam masa sejam.
Transfer ke akaun pegawai kami untuk selesaikan kes ini segera.""",
     1, "Immigration scam — Malay"),

    # ════════════════════════════════════════════════
    #  SUBTLE SCAMS — no direct authority keywords
    # ════════════════════════════════════════════════
    ("""Hi, I am calling from your bank's security team.
We noticed some unusual login attempts on your account last night.
As a precaution, we need you to temporarily move your money to a
safe account that we have set up for you. This will take about
10 minutes and will protect your savings from the hackers.""",
     1, "Subtle bank security scam — no keywords"),

    ("""Selamat pagi. Saya menghubungi anda berkaitan dengan simpanan anda.
Sistem kami mengesan beberapa transaksi yang tidak dibenarkan pada akaun anda.
Untuk keselamatan, pegawai kami akan membimbing anda untuk memindahkan
dana ke akaun yang lebih selamat. Ini adalah prosedur standard kami.""",
     1, "Subtle Malay scam — paraphrased authority"),

    ("""Hello, we are conducting a routine compliance audit.
Your account has been flagged for review due to recent activity.
To avoid any disruption to your banking services, please cooperate
by consolidating your funds into our designated secure account.
Our specialist is standing by to assist you right now.""",
     1, "Subtle compliance scam — business language"),

    # ════════════════════════════════════════════════
    #  INVESTMENT SCAM CALLS
    # ════════════════════════════════════════════════
    ("""Hello, I am calling about an exclusive investment opportunity.
Our platform has been delivering guaranteed returns of 40 percent monthly.
Minimum investment is only RM 500. We have already helped thousands
of Malaysians achieve financial freedom. You must act today as
slots are very limited. Transfer to our account to get started.""",
     1, "Investment scam call — English"),

    ("""Selamat malam, saya hubungi tentang peluang pelaburan kripto kami.
Platform kami menjamin pulangan 30 peratus dalam masa 7 hari.
Modal minimum hanya RM 300. Ramai pelanggan kami sudah untung besar.
Transfer wang sekarang dan kami akan mulakan pelaburan anda malam ini.""",
     1, "Crypto investment scam — Malay"),

    # ════════════════════════════════════════════════
    #  EMERGENCY / FAMILY SCAMS
    # ════════════════════════════════════════════════
    ("""Mak, ini Along. Along kena kemalangan teruk di lebuh raya tadi.
Along sekarang dalam hospital. Doktor kata perlu pembedahan segera.
Kena bayar deposit RM 2,000 dulu sebelum doktor boleh operate.
Tolong transfer ke nombor akaun baru Along sekarang. Cepat mak.""",
     1, "Emergency family scam — Malay hospital"),

    ("""Dad, it's me. I'm in serious trouble right now.
I got into an accident and the other driver is threatening to sue.
I need RM 1,500 urgently to settle this before police come.
Please transfer to this account number. I'll explain everything later.
Don't call mum, she will panic. Just trust me and transfer now.""",
     1, "Emergency family scam — English accident"),

    # ════════════════════════════════════════════════
    #  LEGITIMATE CALLS
    # ════════════════════════════════════════════════
    ("""Hello, this is Sarah calling from Maybank customer service.
I am just calling to inform you that your fixed deposit of RM 10,000
has matured today and will be automatically renewed for another year
unless you call us to change your instructions. Have a good day.""",
     0, "Legitimate Maybank FD maturity call"),

    ("""Selamat pagi, saya dari Telekom Malaysia. Saya hubungi untuk
memaklumkan bahawa permohonan pemasangan Unifi anda telah diluluskan.
Jurujual kami akan datang ke rumah anda pada Isnin antara pukul 2 hingga 5 petang.
Tiada bayaran tambahan diperlukan. Sila pastikan ada orang di rumah.""",
     0, "Legitimate TM Unifi installation call"),

    ("""Hi, this is Dr Farah's clinic calling. We would like to remind you
that you have an appointment scheduled for tomorrow at 3pm.
Please bring your insurance card and arrive 15 minutes early.
If you need to reschedule, please call us before 5pm today. Thank you.""",
     0, "Legitimate clinic appointment reminder"),

    ("""Ibu, ini Along. Along dah selamat sampai KL tadi.
Dah check in hotel dah. Seminar esok bermula pukul 9 pagi.
Ibu tak payah risau. Along call nanti malam untuk update.
Minta doa ibu Along okay dalam seminar tu. Assalamualaikum.""",
     0, "Legitimate family check-in call"),

    ("""Good afternoon, calling from CIMB bank regarding your loan application.
Your home loan of RM 350,000 has been approved in principle.
We will send the letter of offer to your email within 3 working days.
No action is needed from you at this point. Congratulations.""",
     0, "Legitimate CIMB loan approval call"),

    ("""Selamat pagi, saya dari syarikat insurans Prudential.
Polisi insurans hayat anda akan tamat tempoh bulan hadapan.
Kami ingin menawarkan pembaharuan dengan premium yang sama.
Jika berminat, kami boleh hantar ejen untuk berbincang dengan anda.""",
     0, "Legitimate Prudential insurance renewal"),

    # ════════════════════════════════════════════════
    #  EDGE CASES — borderline calls
    # ════════════════════════════════════════════════
    ("""Hello, I represent a debt collection agency. We are calling on
behalf of a creditor regarding an outstanding balance on your account.
Please contact us to arrange payment before further action is taken.
You can call our office between 9am and 5pm on weekdays.""",
     0, "Edge: Legitimate debt collection call"),

    ("""Encik, saya dari syarikat pemaju hartanah. Kami ada projek baru
yang menarik di kawasan Klang Valley. Harga bermula dari RM 400,000.
Adakah encik berminat untuk mengetahui lebih lanjut tentang projek ini?
Kami boleh hantar brosur dan atur lawatan tapak jika berminat.""",
     0, "Edge: Legitimate property sales call"),
]


def run_pipeline(transcript: str) -> dict:
    """Run the same 4-signal pipeline as the voice WebSocket handler."""
    ai_result        = analyze_message_sync(transcript, {})
    rule_risk        = analyze_risk(message=transcript, isNewReceiver=True, source="phone_call")
    classifier_result= classify(transcript)
    reputation_result= check_reputation(source="phone_call")

    scored = compute(
        rule_score         = rule_risk.riskScore,
        ai_risk_contrib    = ai_result.get("ai_risk_contribution", 0),
        classifier_prob    = classifier_result["probability"],
        reputation_score   = reputation_result.score,
        is_flagged_account = reputation_result.is_flagged_account,
    )
    return {
        "final_score":    scored.final_score,
        "risk_level":     scored.risk_level,
        "rule_score":     rule_risk.riskScore,
        "ai_contrib":     ai_result.get("ai_risk_contribution", 0),
        "classifier_prob":classifier_result["probability"],
        "rep_score":      reputation_result.score,
        "agreement":      scored.signal_breakdown.get("agreement_index", 0),
        "bonus":          scored.agreement_bonus,
        "scam_type":      ai_result.get("scam_type") or rule_risk.scamType,
        "red_flags":      (ai_result.get("red_flags") or rule_risk.reasons)[:3],
    }


def level_badge(level, score):
    if level == "high":
        return f"{RED}{BOLD}🔴 HIGH   ({score:>3}/100){RESET}"
    if level == "medium":
        return f"{AMBER}{BOLD}🟡 MEDIUM ({score:>3}/100){RESET}"
    return f"{GREEN}{BOLD}🟢 LOW    ({score:>3}/100){RESET}"


def bar(score, w=25):
    filled = int(score / 100 * w)
    c = RED if score >= 70 else (AMBER if score >= 40 else GREEN)
    return f"{c}{'█'*filled}{GRAY}{'░'*(w-filled)}{RESET}"


def main():
    print(f"\n{BOLD}{CYAN}{'═'*68}")
    print("  Voice Call Scanner — Full Pipeline Accuracy Test")
    print(f"  {len(VOICE_SCENARIOS)} scenarios  |  "
          f"{sum(1 for _,l,_ in VOICE_SCENARIOS if l==1)} scam calls  |  "
          f"{sum(1 for _,l,_ in VOICE_SCENARIOS if l==0)} legitimate calls")
    print(f"{'═'*68}{RESET}\n")

    results = []
    tp = tn = fp = fn = 0

    for transcript, expected, name in VOICE_SCENARIOS:
        print(f"{BOLD}{WHITE}{name}{RESET}")

        r = run_pipeline(transcript)

        score = r["final_score"]
        level = r["risk_level"]
        predicted = 1 if level == "high" or score >= 70 else (
                    1 if level == "medium" and expected == 1 else 0)
        # For voice: medium = borderline, high = scam detected
        predicted = 1 if score >= 55 else 0  # voice threshold slightly lower

        ok = predicted == expected
        if predicted == 1 and expected == 1: tp += 1
        elif predicted == 0 and expected == 0: tn += 1
        elif predicted == 1 and expected == 0: fp += 1
        else: fn += 1

        print(f"  {bar(score)}  {level_badge(level, score)}")
        print(f"  {CYAN}Rule:{RESET} {r['rule_score']:>3}  "
              f"{CYAN}AI:{RESET} +{r['ai_contrib']:>2}  "
              f"{CYAN}Classifier:{RESET} {r['classifier_prob']:.2f}  "
              f"{CYAN}Rep:{RESET} +{r['rep_score']}  "
              f"{CYAN}Agreement:{RESET} {r['agreement']:.2f}  "
              f"{CYAN}Bonus:{RESET} +{r['bonus']}")

        if r['scam_type'] and r['scam_type'] != 'No specific scam type detected':
            print(f"  {CYAN}Scam type:{RESET} {r['scam_type']}")
        if r['red_flags']:
            for flag in r['red_flags'][:2]:
                print(f"  {RED}•{RESET} {flag}")

        exp_str = "SCAM" if expected else "LEGIT"
        status = f"{GREEN}✓ Correct{RESET}" if ok else f"{RED}✗ Wrong{RESET}"
        print(f"  Expected: {exp_str}  →  {status}\n")

        results.append((name, score, level, expected, ok))

    # ── Summary ──────────────────────────────────────────
    correct = tp + tn
    total   = len(results)
    precision = tp / (tp + fp) if (tp + fp) else 0
    recall    = tp / (tp + fn) if (tp + fn) else 0
    f1        = 2 * precision * recall / (precision + recall) if (precision + recall) else 0

    print(f"\n{BOLD}{CYAN}{'─'*68}")
    print("  SUMMARY TABLE")
    print(f"{'─'*68}{RESET}")
    print(f"  {'Scenario':<42} {'Score':>5}  {'Expected':>8}  Result")
    print(f"  {'─'*42} {'─'*5}  {'─'*8}  {'─'*7}")
    for name, score, level, expected, ok in results:
        exp_str = "SCAM " if expected else "LEGIT"
        col = RED if score >= 70 else (AMBER if score >= 40 else GREEN)
        status = f"{GREEN}✓{RESET}" if ok else f"{RED}✗{RESET}"
        print(f"  {name[:42]:<42} {col}{score:>5}{RESET}  {exp_str:>8}  {status}")

    print(f"\n{BOLD}{CYAN}{'─'*68}")
    print("  METRICS")
    print(f"{'─'*68}{RESET}")
    print(f"  Accuracy:        {correct}/{total} ({correct/total*100:.1f}%)")
    print(f"  Precision:       {precision:.3f}  (flagged scams that were real)")
    print(f"  Recall:          {recall:.3f}  (real scams that were caught)")
    print(f"  F1 Score:        {f1:.3f}")
    print(f"  True Positives:  {tp}  scam calls correctly flagged")
    print(f"  True Negatives:  {tn}  legit calls correctly passed")
    print(f"  False Positives: {fp}  legit calls wrongly flagged")
    print(f"  False Negatives: {fn}  scam calls that slipped through")
    print()


if __name__ == "__main__":
    main()
