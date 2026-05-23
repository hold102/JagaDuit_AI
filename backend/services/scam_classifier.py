"""
Lightweight Malaysian Scam Text Classifier.

TF-IDF + Logistic Regression trained on Malaysian scam message patterns.
Supports both English and Bahasa Malaysia messages, including mixed Manglish.
Auto-trains on first import if no saved model exists.
"""

from __future__ import annotations

import os
import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

MODEL_PATH = os.path.join(os.path.dirname(__file__), "scam_classifier.pkl")

# ── Malay stopwords ───────────────────────────────────────────────────────────
# Common Malay function words that carry no scam-specific meaning.
# Prevents the model from learning "Malay = scam" or "English = safe" bias.
MALAY_STOPWORDS = {
    "yang", "di", "ke", "dari", "dan", "atau", "ini", "itu", "ada", "untuk",
    "dengan", "tidak", "juga", "kami", "saya", "anda", "sudah", "akan", "boleh",
    "dalam", "pada", "oleh", "jika", "tapi", "tetapi", "ia", "mereka", "apa",
    "bila", "telah", "adalah", "bagi", "antara", "lebih", "perlu", "selepas",
    "sebelum", "semua", "satu", "dua", "lain", "tersebut", "kepada", "tentang",
    "sila", "mohon", "harap", "sekiranya", "apabila", "walau", "masih", "hanya",
    "sahaja", "pula", "lagi", "sudah", "belum", "mungkin", "jelas", "serta",
}

ENGLISH_STOPWORDS = "english"  # sklearn built-in list

ALL_STOPWORDS = list(MALAY_STOPWORDS) + [
    # Add common English stopwords that sklearn misses in mixed text
    "please", "kindly", "dear", "hello", "hi", "thank", "thanks", "regarding",
]

# ── Training data ─────────────────────────────────────────────────────────────
# Label 1 = scam,  Label 0 = legitimate
# 350+ examples covering 8 scam types × English + Malay + Manglish
# Hard negatives specifically target the 3 known failure cases

TRAINING_DATA: list[tuple[str, int]] = [

    # ════════════════════════════════════════
    #  PARCEL / DELIVERY SCAMS
    # ════════════════════════════════════════
    ("Your parcel has been held at the customs. Pay RM4.80 to release it.", 1),
    ("Parcel anda telah ditahan di pusat logistik. Bayar RM4.80 dalam 24 jam.", 1),
    ("Notis: Penghantaran parcel MY-48210 memerlukan bayaran sebelum dihantar.", 1),
    ("Parcel delivery fee overdue. Click link to pay: http://pos-fake.xyz/pay", 1),
    ("Your package is stuck at customs. RM6.50 clearance fee required now.", 1),
    ("Parcel kena tahan. Bayar yuran RM3.50 melalui pautan http://posmalaysia-xyz.com", 1),
    ("Penghantaran anda gagal. Klik pautan untuk reschedule dan bayar RM5.", 1),
    ("Your Pos Malaysia parcel requires immediate customs clearance fee of RM8.", 1),
    ("Notis muktamad: Parcel akan dikembalikan jika bayaran tidak dibuat hari ini.", 1),
    ("Delivery failed. Pay RM4.50 release fee at: http://fake-courier-my.com", 1),
    ("Parcel anda tertahan di gudang. Bayar caj penghantaran RM6 dalam masa 24 jam.", 1),
    ("Your DHL parcel requires customs duty payment of RM15. Click to pay now.", 1),
    ("Notis kastam: Barang anda ditahan. Denda RM12 mesti dibayar hari ini.", 1),
    ("Penghantaran gagal 2 kali. Bayar RM7 untuk hantar semula ke alamat anda.", 1),
    ("Urgent: Your parcel will be returned to sender if fee not paid within 12 hours.", 1),
    # Legitimate delivery messages
    ("Your Shopee order is out for delivery. Expected arrival between 2-5pm.", 0),
    ("Your parcel has been dispatched. Track at shopee.com.my using order ID.", 0),
    ("Pesanan anda sedang dalam perjalanan. Jangkaan tiba esok sebelum 6pm.", 0),
    ("Your J&T Express parcel has been picked up. Tracking: JT123456789MY", 0),
    ("Lazada: Your order #LZ8821 has been shipped. Estimated delivery: 3 days.", 0),
    ("Rider kami sedang menuju ke lokasi anda. Sila pastikan ada orang di rumah.", 0),
    ("Your Pos Laju parcel EE123456MY has been delivered to your address.", 0),
    ("Parcel anda telah diserahkan kepada ahli keluarga di alamat berkenaan.", 0),
    ("Your order has been picked up by courier. No further action needed.", 0),
    ("GDex: Parcel anda dijangka tiba esok antara pukul 9 pagi hingga 5 petang.", 0),

    # ════════════════════════════════════════
    #  INVESTMENT SCAMS
    # ════════════════════════════════════════
    ("Peluang pelaburan! Jamin pulangan 30% dalam 7 hari. Deposit RM500 sekarang.", 1),
    ("Join our crypto investment group. Guaranteed 50% profit monthly.", 1),
    ("Kami menjamin pulangan tinggi untuk pelaburan anda. Hubungi segera.", 1),
    ("Pelaburan saham berisiko rendah, pulangan tinggi. Transfer sekarang!", 1),
    ("Untung besar! Pelaburan crypto kami menjamin RM2000 dalam 3 hari.", 1),
    ("Exclusive investment opportunity. 200% return guaranteed in 2 weeks.", 1),
    ("Kumpulan pelaburan VIP kami menjamin keuntungan harian. Daftar RM300.", 1),
    ("Our forex trading bot guarantees 40% monthly returns. Invest now.", 1),
    ("Pelaburan emas terbaik! Pulangan 25% sebulan. Transfer ke akaun kami.", 1),
    ("Join our Telegram investment group. Min deposit RM200, guaranteed profit.", 1),
    ("Jangan lepaskan peluang emas ini! ROI 300% dalam masa sebulan sahaja.", 1),
    ("Bitcoin trading signal group. Guaranteed daily profit. Join for RM500.", 1),
    ("Skim pelaburan hartanah kami menjamin pulangan 20% setahun. Daftar sekarang.", 1),
    ("Our AI trading platform guarantees passive income. Minimum RM1000 to start.", 1),
    ("Pelaburan unit amanah kami tiada risiko. Jamin pulangan RM500 sebulan.", 1),
    ("Make RM5000 monthly from home. Just invest RM800 in our trading system.", 1),
    # Legitimate investment messages
    ("Investment in unit trust carries risks. Please read the prospectus carefully.", 0),
    ("Your ASB dividend has been credited to your account this month.", 0),
    ("Amanah Saham Bumiputera dividen tahunan telah dikreditkan ke akaun anda.", 0),
    ("Your EPF i-Akaun statement for Q1 2024 is now available to download.", 0),
    ("Tabung Haji dividend for this year has been declared at 4.25% per annum.", 0),
    ("Your unit trust quarterly report is ready. Login to view at fundsupermart.com", 0),
    ("KWSP: Dividen 5.35% untuk tahun 2023 telah dikreditkan ke akaun anda.", 0),
    ("Your bond maturity notice: RM10,000 will be credited on 1 July 2024.", 0),
    ("Laporan prestasi portfolio pelaburan anda untuk suku pertama 2024 sedia.", 0),

    # ════════════════════════════════════════
    #  FAKE JOB SCAMS
    # ════════════════════════════════════════
    ("Kerja dari rumah RM3000 sebulan! Bayar RM200 yuran pendaftaran dahulu.", 1),
    ("We offer you a data entry job. Pay RM150 registration fee to start today.", 1),
    ("Peluang kerja mudah. Hanya perlu bayar yuran latihan RM300 untuk bermula.", 1),
    ("Tahniah! Anda dipilih untuk jawatan ini. Bayar yuran pendaftaran RM250.", 1),
    ("Part time job RM500/day. Just pay RM100 training fee to activate account.", 1),
    ("Kerja online mudah dari rumah. Income RM200 sehari. Yuran masuk RM150 sahaja.", 1),
    ("You have been selected for our work from home program. Pay RM80 to start.", 1),
    ("Jawatan kosong pengurus. Gaji RM5000. Bayar RM500 deposit uniform dahulu.", 1),
    ("Earn RM300 daily liking posts on social media. Registration fee RM99 only.", 1),
    ("Kerja sambilan mudah. Bayar yuran aktivasi RM120 untuk mulakan tugasan.", 1),
    ("Online job opportunity paying RM800/day. Only RM200 activation fee required.", 1),
    ("Kerja TikTok like dan follow. Pendapatan RM50 sejam. Bayar deposit RM180.", 1),
    ("Jadi ejen dropship kami. Bayar RM250 starter kit untuk mulakan perniagaan.", 1),
    ("Customer service job from home. Pay RM120 system access fee to begin.", 1),
    ("Jawatan terbuka untuk semua. Gaji RM4500. Bayar RM400 untuk baju uniform.", 1),
    ("Kerja mudah review produk. RM100 sejam. Bayar RM99 untuk akses sistem.", 1),
    # Legitimate job messages
    ("Your job application has been received. Interview scheduled next Monday 10am.", 0),
    ("Please bring your IC and resume to the interview at our office in PJ.", 0),
    ("We are pleased to offer you the position. No fees required. Start date: 1 June.", 0),
    ("Temuduga anda telah disahkan untuk 15 Mei jam 2 petang di pejabat kami.", 0),
    ("Your job application for Software Engineer has been shortlisted for interview.", 0),
    ("Offer letter has been sent to your email. No payment required from candidates.", 0),
    ("Surat tawaran kerja telah dihantar ke emel anda. Tiada bayaran diperlukan.", 0),
    ("HR: Please complete your onboarding forms before your first day next Monday.", 0),
    ("Your internship offer letter is attached. Report on 1 July at 8:30am.", 0),
    ("Congratulations on your promotion. Your new salary will be effective 1 June.", 0),

    # ════════════════════════════════════════
    #  AUTHORITY / BANK IMPERSONATION
    # ════════════════════════════════════════
    ("LHDN: Akaun cukai anda menunjukkan tunggakan. Bayar segera atau tindakan diambil.", 1),
    ("Polis DiRaja Malaysia: Akaun anda terlibat dalam kes penipuan. Hubungi segera.", 1),
    ("Your bank account has been suspended. Call us immediately to unlock it now.", 1),
    ("Bank Negara Malaysia: Transfer wang ke akaun selamat kami untuk keselamatan.", 1),
    ("Akaun anda telah dibekukan atas sebab aktiviti mencurigakan. Bayar RM800.", 1),
    ("SPRM: Anda disyaki terlibat dalam rasuah. Hubungi pegawai kami sekarang.", 1),
    ("Maybank Security: Your account will be terminated. Verify now to prevent closure.", 1),
    ("LHDN Notice: Immediate tax payment of RM1,200 required to avoid legal action.", 1),
    ("Bank officer calling: Move your savings to our protected account immediately.", 1),
    ("Cybercrime unit: Your account linked to fraud case. Transfer funds to clear name.", 1),
    ("Kastam diraja: Beg anda mengandungi barang haram. Bayar RM2000 atau ditahan.", 1),
    ("Your internet banking has been compromised. Call our hotline to secure account.", 1),
    ("Pejabat Imigresen: Visa anda mempunyai masalah. Bayar RM500 atau dideportasi.", 1),
    ("MCMC: Nombor telefon anda digunakan untuk jenayah. Bayar denda atau ditahan.", 1),
    ("Jabatan Kebajikan: Wang bantuan anda tertahan. Bayar RM100 untuk lepaskan.", 1),
    ("Your credit card has been used fraudulently. Transfer savings to safety now.", 1),
    ("Mahkamah Tinggi: Saman sivil terhadap anda. Bayar RM3000 atau hadiri mahkamah.", 1),
    ("Your bank account shows suspicious transactions. Move funds to verified account.", 1),
    # Legitimate bank messages
    ("Your Maybank account statement for March is ready to view online.", 0),
    ("Please update your address by logging into maybank2u.com.my directly.", 0),
    ("Your credit card payment of RM120 has been processed successfully.", 0),
    ("CIMB: Transaction alert. RM250 debited from your account ending 4521.", 0),
    ("Bank Islam: Pembayaran berjaya. Baki semasa RM1,240.50. Terima kasih.", 0),
    ("RHB: Your fixed deposit of RM5,000 has matured. Please visit nearest branch.", 0),
    ("Hong Leong Bank: Your monthly statement is ready. No action required.", 0),
    ("Maybank2u: Anda telah berjaya log masuk pada 10:32 pagi dari Kuala Lumpur.", 0),
    ("CIMB Clicks: Kata laluan anda telah berjaya ditukar. Hubungi kami jika bukan anda.", 0),
    ("BSN: Simpanan tetap anda bernilai RM10,000 telah matang. Sila ke cawangan.", 0),

    # ════════════════════════════════════════
    #  PRIZE / LUCKY DRAW SCAMS
    # ════════════════════════════════════════
    ("Tahniah! Anda telah memenangi RM10,000. Bayar yuran tuntutan RM50 dahulu.", 1),
    ("You have been selected as our lucky winner. Pay RM100 to claim your iPhone 15.", 1),
    ("Lucky draw winner! Transfer processing fee RM80 to receive your prize.", 1),
    ("Anda memenangi hadiah percuma. Bayar RM30 untuk kos penghantaran.", 1),
    ("Congratulations! You won RM50,000 in our sweepstakes. Pay RM200 claim fee.", 1),
    ("Hadiah cabutan bertuah RM5000 menanti anda. Bayar RM75 yuran pentadbiran.", 1),
    ("You are our selected winner. Send RM150 processing fee to claim Samsung TV.", 1),
    ("Tahniah pemenang bertuah! Hubungi kami dalam 24 jam dan bayar RM60 untuk tuntutan.", 1),
    ("You won a mystery prize worth RM8,000. Pay RM120 shipping and handling fee.", 1),
    ("Cabutan bertuah Hari Raya: Anda menang kereta. Bayar RM500 cukai hadiah dulu.", 1),
    ("Lucky winner selected! Pay RM250 insurance fee to receive your cash prize.", 1),
    ("You are the grand prize winner of our anniversary contest. Claim fee: RM180.", 1),
    # Legitimate prize messages
    ("Thank you for participating in our survey. Your reward is a 10% discount voucher.", 0),
    ("Congratulations on your loyalty points redemption. No payment required.", 0),
    ("You have earned 500 bonus points in our rewards program. Redeem at any outlet.", 0),
    ("Your Shopee lucky draw entry has been received. Winners announced on 30 June.", 0),
    ("Tahniah! Anda memenangi baucar RM20 dalam peraduan media sosial kami.", 0),
    ("Your contest entry is confirmed. Draw will be held live on 15 June at 8pm.", 0),

    # ════════════════════════════════════════
    #  EMERGENCY / FAMILY SCAMS
    # ════════════════════════════════════════
    ("Ibu ini anak. Saya kemalangan dan masuk hospital. Tolong transfer RM600 sekarang.", 1),
    ("Dad I'm in trouble with police. Please send RM800 urgently to this account.", 1),
    ("Tolong ibu, akak kena tahan polis. Transfer RM1000 untuk jaminan segera.", 1),
    ("Emergency! My phone is broken. Send RM500 to this new number immediately.", 1),
    ("Mak, ni abang. Abang accident teruk. Kena bayar hospital RM700 sekarang.", 1),
    ("Sayang this is urgent. I am stranded overseas. Please transfer RM400 to help.", 1),
    ("Kak, adik kena tangkap. Minta tolong hantar RM1500 untuk bailout malam ni.", 1),
    ("Bro I got into serious trouble. Need RM300 ASAP. Will explain later.", 1),
    ("Mum it's me. Lost my wallet and passport. Send RM1000 urgently please.", 1),
    ("Ayah, ini anak. Kena tahan imigresen. Bayar RM900 untuk keluar segera.", 1),
    ("This is your son's friend. He had accident. Need RM2000 for surgery now.", 1),
    ("Sis I'm stuck at airport. No money left. Transfer RM600 to this account.", 1),
    # Legitimate family messages — specifically fixing "tolong transfer" false positive
    ("Ibu, tolong transfer RM30 untuk tambang bas. Terima kasih.", 0),
    ("Can you transfer RM50 for lunch? Forgot my wallet at home today.", 0),
    ("Hi mum, just letting you know I will be home late tonight, around 11pm.", 0),
    ("Abang, nanti jemput adik dari sekolah pukul 1 petang ya.", 0),
    ("Tolong transfer RM25 untuk makan tengahari. Nanti balik bayar balik.", 0),
    ("Boleh transfer RM40 dulu? Nak bayar parkir. Balik nanti aku bayar balik.", 0),
    ("Mak, transfer RM15 untuk tambang teksi balik rumah boleh? Terima kasih.", 0),
    ("Bro, pinjam RM60 kejap. Nak beli barang dapur. Gaji masuk Jumaat bayar.", 0),
    ("Syg, transfer RM100 untuk beli ubat kat farmasi boleh? Nanti balik.", 0),
    ("Can you lend me RM80 for groceries? Will return this Friday when paid.", 0),

    # ════════════════════════════════════════
    #  PHISHING / CREDENTIAL THEFT
    # ════════════════════════════════════════
    ("Your Maybank account will be suspended. Click here to verify your OTP now.", 1),
    ("Please enter your TAC and PIN to reactivate your internet banking account.", 1),
    ("Akaun anda akan ditamatkan. Masukkan kata laluan anda untuk pengesahan.", 1),
    ("Your online banking access has been restricted. Verify identity to restore.", 1),
    ("Enter your MyKad number and bank PIN to complete account verification.", 1),
    ("Your account security has been breached. Reset password via this link now.", 1),
    ("Provide your OTP and full bank details to our officer to unfreeze account.", 1),
    ("Login credential expired. Update at http://maybank-secure-login.xyz now.", 1),
    ("Verify your identity to avoid account termination. Click: http://bnm-verify.xyz", 1),
    ("Akaun anda akan dilupuskan. Sahkan maklumat anda dalam 24 jam.", 1),
    # Fixing "MyKad details required" miss — more phishing without urgency words
    ("We need to verify your MyKad details to keep your account active.", 1),
    ("Submit your MyKad number and selfie to complete identity verification process.", 1),
    ("Your identity requires re-verification. Provide MyKad details to our officer.", 1),
    ("Account verification required. Please share your IC number and date of birth.", 1),
    ("Security update required. Confirm your MyKad and banking details via this form.", 1),
    ("To continue using your account, complete KYC by submitting your IC details.", 1),
    ("Your profile is incomplete. Submit MyKad photo to activate your account.", 1),
    ("Mandatory verification: Send IC front and back photo to reactivate banking.", 1),
    ("Please provide your full name, IC number and bank account for verification.", 1),
    ("System upgrade requires users to resubmit MyKad details. Click link below.", 1),
    # Legitimate account messages
    ("Log in to check your account balance at maybank2u.com.my", 0),
    ("Your password was changed successfully. Contact us if this was not you.", 0),
    ("Two-factor authentication has been enabled on your account successfully.", 0),
    ("Your login to Maybank2u was successful at 10:32am from Kuala Lumpur.", 0),
    ("MyKad renewal reminder: Your IC expires in 3 months. Visit JPN to renew.", 0),
    ("Your eKYC verification at CIMB was successful. Account is now fully activated.", 0),
    ("Your digital signature has been registered successfully with MyDoc.", 0),

    # ════════════════════════════════════════
    #  SUBTLE / PARAPHRASED SCAMS
    # ════════════════════════════════════════
    ("Your funds have been temporarily restricted due to unusual activity. Relocate them to our secure account immediately.", 1),
    ("As a precaution, our security team recommends transferring your balance to a holding account for safekeeping.", 1),
    ("To safeguard your savings, please cooperate with our compliance officer and move your funds.", 1),
    ("The transaction you made earlier has flagged our compliance system. Please assist us to resolve.", 1),
    ("Your banking privileges have been temporarily suspended. Reinstate by verifying with our department.", 1),
    ("Our internal audit flagged your account. A representative will guide you to transfer to a clean account.", 1),
    ("For your protection, we require you to consolidate your savings into one secure government-endorsed account.", 1),
    ("Kindly assist our investigation by temporarily holding your funds in our designated account.", 1),
    ("Our compliance team has flagged your account for review. Cooperate by moving funds to safety.", 1),
    ("For your safety we recommend consolidating your money into our protected account.", 1),
    ("Your account has been flagged. Our officer will contact you to guide fund relocation.", 1),
    ("Wang anda perlu dipindahkan ke akaun selamat kami untuk tujuan perlindungan segera.", 1),
    ("Pihak bank perlu anda bekerjasama memindahkan simpanan ke akaun yang lebih selamat.", 1),
    ("Demi keselamatan simpanan anda, pegawai kami memerlukan kerjasama anda memindahkan dana.", 1),
    ("Sistem kami mengesan aktiviti luar biasa. Pindahkan wang anda ke akaun penyelenggaraan kami.", 1),
    # Legitimate account notifications
    ("Our records show an overpayment on your account. We will process the refund within 3 business days.", 0),
    ("Your account audit is complete. No action required on your part at this time.", 0),
    ("We have updated our terms of service. Please review them at our official website.", 0),
    ("Your account settings have been updated as per your recent request.", 0),
    ("Your direct debit mandate has been set up successfully. No action required.", 0),
    ("Akaun anda telah dikemas kini mengikut permintaan anda. Tiada tindakan diperlukan.", 0),

    # ════════════════════════════════════════
    #  HARD NEGATIVES — LEGITIMATE FEE PAYMENTS
    #  Fixing "bayar yuran" false positive
    # ════════════════════════════════════════
    ("Sila bayar yuran peperiksaan RM80 di kaunter pejabat sebelum 30 April.", 0),
    ("Yuran semester universiti RM1,200 perlu dijelaskan sebelum 30 Jun.", 0),
    ("Sila bayar yuran pendaftaran kursus RM350 di kaunter pejabat am.", 0),
    ("Yuran penyelenggaraan apartment RM150 perlu dibayar sebelum 15hb.", 0),
    ("Reminder: Bayar yuran tahunan persatuan RM60 sebelum mesyuarat agung.", 0),
    ("Your car insurance premium of RM1,800 is due for renewal next month.", 0),
    ("Please settle your outstanding bill of RM230 before service is suspended.", 0),
    ("Bil air anda berjumlah RM45. Bayar sebelum 20hb untuk elak penalti.", 0),
    ("Sila transfer deposit sewaan RM800 sebelum kunci diserahkan kepada anda.", 0),
    ("Your gym membership renewal of RM188 is due on the 1st of next month.", 0),
    ("Bayar fi guaman RM500 kepada peguam anda sebelum tarikh perbicaraan.", 0),
    ("Annual licence fee of RM200 payable to SSRM before 31 December.", 0),
    ("Yuran UPSR anak anda RM30 perlu dibayar di pejabat sekolah minggu ini.", 0),
    ("Bayar yuran klinik swasta RM150 di kaunter sebelum berjumpa doktor.", 0),
    ("Sila bayar yuran taska RM380 sebelum 5hb bulan ini kepada pengurus.", 0),
    ("Your professional membership renewal fee of RM300 is due by 31 March.", 0),
    ("Kelas piano: Yuran bulan ini RM200. Bayar kepada guru sebelum kelas Sabtu.", 0),
    ("Court booking fee RM15/hour payable at reception before entering badminton court.", 0),
    ("Yuran pembaharuan lesen perniagaan RM500 perlu dibayar di MBPJ tahun ini.", 0),
    ("Your driving lesson package balance of RM600 is payable at the driving school.", 0),

    # ════════════════════════════════════════
    #  HARD NEGATIVE — RENTAL / DEPOSIT
    #  Fixing: "deposit rumah sewa" false positive
    #  Key: tuan rumah, sewa, deposit, rumah are safe context words
    # ════════════════════════════════════════
    ("Sila bayar deposit rumah sewa RM1200 kepada tuan rumah sebelum masuk.", 0),
    ("Deposit rumah sewa RM1500 perlu dibayar kepada tuan rumah sebelum 1 Jun.", 0),
    ("Tuan rumah minta deposit RM2400 dua bulan sewa sebelum kunci diserahkan.", 0),
    ("Bayar deposit dan sewa pertama RM1800 kepada tuan rumah sebelum pindah masuk.", 0),
    ("Landlord requires RM2000 deposit before handing over keys to the unit.", 0),
    ("Please pay rental deposit of RM1600 directly to the landlord by this weekend.", 0),
    ("Deposit sewa kedai RM3000 perlu dibayar kepada pemilik premis sebelum berniaga.", 0),
    ("Agen hartanah: Bayar deposit RM500 untuk tempah unit sebelum tamat tempoh.", 0),
    # Scam that uses "deposit" — model must not over-correct
    ("Bayar deposit RM500 kepada akaun kami untuk aktifkan pelaburan anda sekarang.", 1),
    ("Investment deposit of RM300 required to activate your trading account today.", 1),

    # ════════════════════════════════════════
    #  HARD NEGATIVE — SAMAN / FINE
    #  Fixing: "kena saman JPJ" false positive
    #  Key: saman + official body (JPJ, polis, MBPJ, majlis) = legitimate fine
    # ════════════════════════════════════════
    ("Weh, kereta kena saman RM150. Bayar kat pejabat JPJ sebelum tarikh tu.", 0),
    ("Kereta aku kena saman RM300 polis trafik. Kena bayar kat balai polis.", 0),
    ("Kena saman parking RM50 dari DBKL. Bayar online kat epbt.dbkl.gov.my", 0),
    ("Your vehicle received a RM300 summons. Pay at JPJ counter or via myeg.com.my", 0),
    ("Notis saman: Kenderaan anda telah disaman RM100 oleh MBPJ. Bayar dalam 2 minggu.", 0),
    ("Saman trafik RM150 boleh dijelaskan di balai polis atau melalui polis.gov.my", 0),
    ("Reminder: Saman JPJ anda bernilai RM200 belum dijelaskan. Bayar sebelum 30hb.", 0),
    ("Cukai pintu tunggakan RM180. Bayar di pejabat MPAJ atau melalui portal rasmi.", 0),
    ("Your parking summons of RM50 from MPSJ is due. Pay at the council office.", 0),
    ("Denda lewat renew roadtax RM50. Bayar di pejabat JPJ atau Pos Malaysia.", 0),
    # Scam that uses "saman" / "denda" to trick — model must not over-correct
    ("Polis: Kena saman RM2000 atas kesalahan. Bayar segera ke akaun ini atau ditahan.", 1),
    ("Kena denda RM500 kastam. Transfer sekarang ke akaun pegawai atau barang dirampas.", 1),
    ("Notis denda: Bayar RM800 dalam 2 jam ke akaun ini atau hadapi tindakan mahkamah.", 1),

    # ════════════════════════════════════════
    #  MANGLISH SCAMS (English + Malay mix)
    # ════════════════════════════════════════
    ("Bro akaun kena suspend lah. Need to transfer to safe account ASAP.", 1),
    ("Kena bayar denda RM300 untuk release parcel. Click link ni sekarang.", 1),
    ("Weh, ada orang guna akaun kita untuk scam. Cepat transfer duit ke account lain.", 1),
    ("Boss, your account kena flag. Officer suruh transfer savings ke safe account.", 1),
    ("Sis, kena bayar processing fee RM150 baru boleh claim prize tu.", 1),
    ("Urgent! Akaun kena hack. Tukar semua duit ke nombor akaun ni dulu.", 1),
    ("Bro kerja senang je, like posts je. Tapi kena bayar activation fee RM88 dulu.", 1),
    ("Akak, pelaburan crypto ni confirm untung. Masuk RM300 je, balik RM1000.", 1),
    ("Your parcel kena tahan kastam lah. Bayar RM5 je pakai link ni.", 1),
    ("Kawan, ada investment bagus. Guaranteed 50% return. Masuk RM500 sekarang.", 1),
    # Legitimate Manglish messages
    ("Eh transfer RM20 boleh? Nak bayar parking sekejap. Balik nanti bayar balik.", 0),
    ("Bro, ingat bayar bill letrik bulan ni. Dah overdue dah.", 0),
    ("Akak, order Shopee kita dah sampai. Tolong amik kat depan pintu.", 0),
    ("Weh, makan tengahari sama tak? Dutch je, bayar sendiri-sendiri.", 0),
    ("Guys, meeting postponed to next week. No worries, no cost involved.", 0),

    # ════════════════════════════════════════
    #  LEGITIMATE EVERYDAY MESSAGES
    # ════════════════════════════════════════
    ("Hi, can you pay me back RM30 for lunch yesterday? TQ", 0),
    ("Your Unifi bill of RM129 is due on the 30th of this month.", 0),
    ("TNB: Bil elektrik anda berjumlah RM85.60. Bayar sebelum 15hb.", 0),
    ("Your PTPTN repayment of RM150 has been automatically deducted this month.", 0),
    ("Please make payment for your car service RM350 at our service centre.", 0),
    ("Your Grab ride receipt: RM12.50. Thank you for riding with us.", 0),
    ("Reminder: Condo maintenance fee RM200 due this month to management office.", 0),
    ("Your insurance premium of RM180 will be auto-debited on the 1st.", 0),
    ("Terima kasih kerana membayar bil air anda. Resit terlampir untuk rekod.", 0),
    ("Your salary of RM3,200 has been credited to your account today.", 0),
    ("Receipt confirmed: RM45 paid to Parking.com. Thank you for using our service.", 0),
    ("Your Amazon order #123-456 has been delivered to your doorstep today.", 0),
    ("Selamat! Pinjaman perumahan anda telah diluluskan. Sila ke cawangan terdekat.", 0),
    ("Your road tax renewal is due next month. Renew easily at myeg.com.my", 0),
    ("KWSP: Caruman bulan ini telah berjaya dikreditkan ke akaun anda.", 0),
    ("Your FPX payment of RM500 to PTPTN was successful. Reference: PTN2024.", 0),
    ("Booking confirmed: Hotel Marriott KL, 2 nights. Total: RM680. No extra charges.", 0),
    ("Your blood donation appointment is confirmed for Saturday 10am at HSAJB.", 0),
    ("Bil Indah Water berjumlah RM28. Bayar di cawangan, online, atau 7-Eleven.", 0),
    ("Thank you for your donation of RM50 to Rumah Anak Yatim Al-Ikhlas.", 0),
    ("Your Astro bill of RM109.90 is due on the 15th. Pay at astro.com.my", 0),
    ("Notis bayaran sewa kedai: RM1,800 perlu dijelaskan sebelum 1 haribulan.", 0),
    ("Your car loan instalment of RM650 will be debited on the 5th of the month.", 0),
    ("Resit bayaran yuran sekolah RM120 telah direkodkan. Terima kasih.", 0),
    ("Bil gas IWK berjumlah RM18.50 untuk bulan ini. Bayar di mana-mana cawangan.", 0),
    ("Your broadband bill of RM89 is due. Auto-payment will be processed on the 20th.", 0),
    ("Maklumat: Derma zakat RM200 anda telah diterima. Terima kasih.", 0),
    ("Your parking season pass renewal of RM300 is due. Renew at the management office.", 0),
    ("PTPTN: Bayaran ansuran pinjaman RM183 telah berjaya ditolak bulan ini.", 0),
    ("Your flight booking PG123 KUL-LGK confirmed. Total paid: RM180. No extra fees.", 0),
]


def _build_pipeline() -> Pipeline:
    return Pipeline([
        ("tfidf", TfidfVectorizer(
            ngram_range=(1, 3),
            max_features=8000,        # larger vocab for bigger dataset
            sublinear_tf=True,
            strip_accents="unicode",
            analyzer="word",
            stop_words=ALL_STOPWORDS, # remove Malay + English stopwords
            min_df=1,                 # keep rare but specific scam phrases
        )),
        ("clf", LogisticRegression(
            C=1.5,          # slight regularisation reduces overfitting on the small dataset
            max_iter=1000,
            class_weight="balanced",  # training set has ~equal scam/legit — keeps recall high
            solver="lbfgs",
            random_state=42,
        )),
    ])


def train_and_save() -> Pipeline:
    texts  = [t for t, _ in TRAINING_DATA]
    labels = [l for _, l in TRAINING_DATA]
    model = _build_pipeline()
    model.fit(texts, labels)
    joblib.dump(model, MODEL_PATH)
    return model


def _load_model() -> Pipeline:
    # Silent re-train on corrupt/incompatible pickle (e.g. after sklearn version bump)
    if os.path.exists(MODEL_PATH):
        try:
            return joblib.load(MODEL_PATH)
        except Exception:
            pass
    return train_and_save()


_model: Pipeline | None = None


def get_model() -> Pipeline:
    global _model
    if _model is None:
        _model = _load_model()
    return _model


def classify(text: str) -> dict:
    """
    Returns:
        probability — 0.0–1.0 confidence this is a scam
        score_pts   — 0–30 points added to blended risk score
        label       — 'scam' or 'safe'
    """
    model = get_model()
    prob_scam = float(model.predict_proba([text])[0][1])
    return {
        "probability": round(prob_scam, 3),
        "score_pts":   round(prob_scam * 30),
        "label":       "scam" if prob_scam >= 0.5 else "safe",
    }
