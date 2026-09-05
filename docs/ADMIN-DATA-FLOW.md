# Kaun kya banata hai — admin, driver app, aur beech me database

Ye doc teen sawaal ka jawab hai:

1. **Ye cheez kahan banti hai** — admin console me ya driver app me?
2. **Ban ke kahan dikhti hai** — poora round trip.
3. **Agar khali dikh raha hai to kyun** — table khali hai, ya peeche kuch banaya hi nahi gaya?

2 September 2026 ki haalat. Code badle to ye file bhi badalni hai.

---

## Ek line ka rule

| Kaun | Kya karta hai |
|---|---|
| **Admin console** | Master data banata hai — driver, gaadi, depot, route, form, course, work order, settings |
| **Driver app** | Event bharta hai — duty status, inspection, defect, photo, message, arrival |
| **Admin console** | Wapas padhta hai aur faisla karta hai — approve, reject, coach, repair kholna |

Master data admin se **neeche** jaata hai. Event app se **upar** aata hai. Faisla admin me hota hai.

Console me **koi demo data nahi bacha**. Jo dikh raha hai wo database me hai.

---

## Kaun banata hai — poori list

Ye maine guess nahi kiya. Ye database ki **RLS policies** me likha hua hai — matlab agar app galat
table me likhne ki koshish kare to database khud rok dega, UI ka bharosa nahi karna padta.

| Cheez | Kahan banti hai | App kya kar sakta hai |
|---|---|---|
| Driver (roster) | **Admin** | Apna record padh sakta hai, badal nahi sakta |
| Vehicle / trailer | **Admin** | Sirf padhna |
| Depot / fleet | **Admin** — *screen pending* | — |
| Office staff + role | **Admin** | — |
| Form template | **Admin** | Bharta hai |
| Course | **Admin** | Complete karta hai |
| Route + stops | **Admin** | Arrival mark karta hai |
| Alert rule | **Admin** — *create pending* | — |
| Org settings | **Admin** | — |
| **Work order** | **Admin** — *app se ho hi nahi sakta* | — |
| **Maintenance schedule** | **Admin** — *create pending* | — |
| Duty status event | **Driver app** | Banata hai; admin ka edit review karta hai |
| Din certify karna (log) | **Driver app** | Uska legal signature |
| Inspection submission | **Driver app** | Banata hai |
| **Defect** | **Driver app** | Banata hai; admin resolve karta hai |
| Trip document (POD, e-way) | **Driver app** | Banata hai |
| Message | **Dono taraf** | Bhejta aur padhta hai |
| Gaadi pick karna (assignment) | **Driver app** shift start par — admin override bhi | Khud choose karta hai |
| Safety event | **Telemetry / dashcam** | Sirf padhna |
| Audit entry | **Server** | Koi bhi client nahi — admin bhi nahi |

---

## Work order: tera sawaal ka seedha jawab

**Work order admin se banega. Driver app se ban hi nahi sakta.** Ye meri opinion nahi, code me likha
hai — do jagah:

1. `work_orders.opened_by` aur `assigned_to` **`users`** table ko point karte hain — office staff.
   Driver `drivers` table me hota hai. Schema me driver ke liye jagah hi nahi hai.
2. RLS policy `work_orders_write` sirf `fleet_admin` ya `mechanic` role ko likhne deti hai. Driver ke
   paas dono nahi hain. **Koshish karega to database mana kar dega.**

**Aur ye theek hai.** Work order me parts cost, labour hours, mechanic assign, open/close hota hai —
wo workshop ka kaam hai. Driver ka kaam hai batana ki **kya kharab hai**.

### To driver app se kya banega — **defect**

Bilkul wahi flow jo tu chahta hai, bas object ka naam alag hai:

```
DRIVER APP    Login → gaadi choose → inspection form bharta hai
              → "Brakes: front pads khatam" defect add karta hai
                       ↓
DATABASE      form_submissions row + defects row
              (defects.reported_by_driver = us driver ka id)
                       ↓
WEB ADMIN     Inspections tab me row aa jaati hai
              Critical defect ho to notification bell me sabse upar
                       ↓
WEB ADMIN     "Create work order" dabata hai
              → work_orders row banti hai
              → defects.work_order_id usse jud jaata hai
                       ↓
WEB ADMIN     Repair complete → work order band → defect resolved
```

Ek zaruri baat: `defects.submission_id` **nullable** hai. Matlab driver **poora inspection bina bhi**
seedha defect utha sakta hai — "AC kaam nahi kar raha", beech raste me. Uske liye pehle poora pre-trip
form bharna zaruri nahi.

`defects.work_order_id` column **pehle se maujood hai**. Link ke liye migration nahi chahiye — sirf
admin me button chahiye.

---

## 1. Fleet / Depot — sabse pehle isi ki zarurat hai

**Table:** `fleets`  ·  **Banega:** Admin  ·  **Status:** screen nahi hai

```
WEB ADMIN     Depots screen → "Add depot" → naam + code       ← YE BANANA HAI
                       ↓
DATABASE      fleets row
                       ↓
WEB ADMIN     Driver dialog ka depot picker bhar jaata hai
              Users tab me staff ko depot assign kar sakte ho
              Reports ka depot filter chalne lagta hai
              Form / course ek depot ko assign ho sakte hain
                       ↓
DRIVER APP    Driver ka home terminal — uska legal din isi depot ke
              timezone me kata jaata hai
```

Depot teen kaam karta hai:

1. **Driver ka base** — `drivers.home_terminal` + `drivers.timezone`. Working hours ka legal din
   *isi timezone* me kata jaata hai, phone ke timezone me nahi. Driver timezone cross kare to uska
   kanooni din uske neeche se shift nahi hona chahiye.
2. **Office staff ko seemit karna** — `user_roles.assigned_fleet_id`. Users tab ka "Fleet" column.
   Ek dispatcher ko sirf Pune depot dikhe, poora fleet nahi.
3. **Filter aur assign** — Reports ka depot chip, form ka "assign to", course ka "assign to".

**Abhi:** fleet banane ki koi screen nahi. Table khali hai, to driver dialog "No depots yet" dikhata
hai aur reports me sirf "All".

> **Baad me kaatega:** driver ka depot *text* me store hota hai (`home_terminal`, naam se match),
> staff ka *FK* se (`assigned_fleet_id`). Depot rename karo to driver ka link chupchaap toot jaayega.
> Depots screen banate waqt driver ko bhi `fleet_id` par le jaana chahiye.

---

## 2. Driver (A03)

**Banega:** Admin  ·  **Status:** chalta hai

```
WEB ADMIN     Drivers → "Add driver" → naam, employee number, depot,
              email, phone, licence number + expiry
                       ↓
DATABASE      drivers row
              + documents row (category=compliance, doc_type=licence)
              + auth user, 8-character random password
                       ↓
EMAIL         Driver ko one-time password chala jaata hai
                       ↓
DRIVER APP    Wo email + password se login karta hai
              → pehli login par drivers.user_id jud jaata hai
              → password badalne ko majboor (must_change_password)
                       ↓
WEB ADMIN     Driver list me "on app" ho jaata hai
              Dashboard ka "drivers without login" tile ghat jaata hai
```

### Licence ka alag table nahi hai

Licence `documents` me row banti hai: `category = 'compliance'`, `doc_type = 'licence'`. Isliye
dashboard ka "expiring documents" tile aur driver list ka licence warning **ek hi jagah** se aate hain
— do jagah gin ke do jawab nahi milte.

### Password

8 character, `crypto.getRandomValues` se. `0 O 1 l I` alphabet se nikaale gaye — phone par padhne me
confuse na ho. **Expire nahi hota** — Friday ko hire hua driver agle hafte phone uthaye to bhi
login kar sake, aur resend ka koi button hai nahi. Isliye app me `must_change_password` enforce karna
**zaroori** hai: wahi ek cheez hai jo emailed password ko permanent login banne se rokti hai.

Ye `invite-driver` Edge Function karta hai. **Do baat pending:**

```bash
npx supabase functions deploy invite-driver
```
```bash
npx supabase secrets set RESEND_API_KEY=...
```

Email fail ho gaya to password dialog me dikhta hai, taaki office khud bata sake. Email chala gaya to
password kahin nahi dikhta. Driver save ho jaata hai chaahe invite fail ho — roster pehle banta hai,
phone baad me.

### Driver detail ke 5 tab

| Tab | Kya dikhta hai | Banaya kisne |
|---|---|---|
| **Overview** | Employment, depot, licence, assigned vehicle | Admin |
| **Hours** | 24-ghante duty graph, us hafte ka log | **Driver app** |
| **Inspections** | Is driver ne jo inspection bhare | **Driver app** |
| **Safety** | Is driver ke safety event | Telemetry — *abhi nahi* |
| **Documents** | Licence, medical | Admin (compliance) + app (trip) |

Graph ke neeche ka recap (on duty / driving / break / cycle) **dashes dikhata hai**. Wo chaar figure
nikalne ke liye rule engine chahiye. Nahi hai, to number banane se accha dash dikhana hai.

---

## 3. Vehicle (A04)

**Banega:** Admin  ·  **Status:** gaadi chalti hai, work order + maintenance nahi

```
WEB ADMIN     Vehicles → "Add vehicle" → naam, plate, make/model,
              year, odometer
                       ↓
DATABASE      vehicles row
                       ↓
DRIVER APP    Shift start par driver isi list se apni gaadi choose karta hai
                       ↓
DATABASE      driver_vehicle_assignments row
                       ↓
WEB ADMIN     Driver list me gaadi ka naam
              Vehicle list me driver ka naam
              Live map ke pin par dono
```

Trailer ka **alag table nahi** hai — wo `vehicles` me `kind = 'trailer'` wali row hai. Isliye trailer
ki detail par odometer aur service ki row nahi dikhti: trailer ka odometer hota hi nahi.

### Gaadi kaun assign karta hai — dono

RLS me do policy hain, aur ye jaan-boojh ke hai:

- `dva_self_write` — **driver khud** apni gaadi pick karta hai. Migration me likha hai: *"Drivers pick
  their own truck at the start of a shift."* ELD me yahi standard hai — driver shift shuru karte waqt
  truck select karta hai.
- `dva_admin_write` — **admin ya dispatcher** bhi assign kar sakta hai (pre-assign / override).

Abhi **dono taraf UI nahi hai**. Isliye list me "Not assigned" aur map par driver ka naam khali.
Asli flow driver app wala hai; admin wala override ke liye chahiye.

### Work order

Upar poora likha hai. Ek line me: **admin banata hai, driver defect uthata hai.** Table
`work_orders` — parts cost, labour hours aur labour cost usi row me hain, alag line-items table nahi
hai.

**Abhi create UI nahi hai** — console sirf padhta hai. Dashboard ka "open work orders" tile aur alert
isi se aate hain, aur dono zero dikhate hain kyunki koi row banata nahi.

### Maintenance schedule

"Har 15,000 km par service" — repeat hone wala rule, ek baar ka job nahi. Table
`maintenance_schedules`. Isse dashboard ka **"service due"** tile aur "service overdue by 800 km" wala
alert aata hai.

```
WEB ADMIN     Vehicle detail → "Add schedule" → kaam ka naam,
              har kitne km / kitne din                        ← YE BANANA HAI
                       ↓
DATABASE      maintenance_schedules row
                       ↓
AUTO          Odometer schedule cross kare to "service due" ban jaata hai
                       ↓
WEB ADMIN     Dashboard tile + alert
              → wahan se ek click me work order khulna chahiye
```

### Recent inspections (vehicle detail par)

Us gaadi ke `form_submissions` — **driver app se**. Admin banata nahi, sirf padhta hai.

---

## 4. Working hours (A06)

**Banega:** poora driver app se  ·  **Status:** 2 cheez chalti hai, 2 nahi

Char cheez ek screen par.

### Logs grid — chalta hai

```
DRIVER APP    Din ke end me driver apna log CERTIFY karta hai
              (ye uska legal signature hai)
                       ↓
DATABASE      hos_daily_logs — per driver, per date ek row
                       ↓
WEB ADMIN     Working hours grid — poora mahina, rang se:
              certified / uncertified / violation / missing / off
```

Grid ka asli sawaal hai "kuch uncertified pada hai kya?" Isliye poora mahina ek nazar me dikhta hai.
Checkbox lagao to us driver ke naam ke **neeche usi table me** graph khul jaata hai — upar ke rang
nazar me rehte hain jab neeche detail padh rahe ho.

### 24-ghante ka graph — chalta hai

```
DRIVER APP    Driver status badalta hai: Off duty → On duty → Driving …
                       ↓
DATABASE      duty_status_events — APPEND ONLY, sirf start time
                       ↓
WEB ADMIN     24-ghante ki 4-band graph (off / sleeper / driving / on duty)
```

**Append-only** table hai: row badalti nahi, nayi row banti hai. Ek status agle event tak chalta hai,
isliye sirf start time store hota hai. Aaj ka aakhri block **abhi tak** chalta hai, midnight tak nahi
— jo driver is waqt on duty hai usne on duty hona band nahi kiya.

### Correction request — chalta hai

```
DRIVER APP    "14:10–15:00 On duty nahi, Off duty tha — gate par khada tha"
                       ↓
DATABASE      duty_status_events me nayi row:
              edit_of_id = purani row, edit_status = 'pending'
                       ↓
WEB ADMIN     Working hours → Correction requests panel
              Approve / Reject
                       ↓
DATABASE      edit_status = 'approved' / 'rejected'
```

**Ulta bhi hota hai** — aur yahan kanoon hai:

```
WEB ADMIN     Office khud driver ka log edit karta hai
                       ↓
DATABASE      row with source = 'carrier_edit'
                       ↓
DRIVER APP    Driver ko dikhta hai — SIRF WO approve/reject kar sakta hai
```

Carrier apne hi edit ko approve nahi kar sakta — FMCSA ka rule hai, aur **RLS policy me likha hai**,
sirf UI me nahi. Approve karna save na ho to request wapas queue me aa jaati hai. Compliance record
hai; "approved" dikha ke chup rehna sabse bura outcome hai.

### Violations — kuch check hi nahi karta

Panel likhta hai "not checked yet", khali list nahi dikhata. Khali list "sab theek hai" padha jaata
hai, aur ye jhooth hoga.

```
DATABASE      duty_status_events (pehle se aa rahe hain)
                       ↓
RULE ENGINE   11-ghante driving, 14-ghante window, 30-min break,   ← YE BANANA HAI
              70-ghante cycle — organizations.hos_regulator se
              decide hoga ki FMCSA (11h) ya EU (9h)
                       ↓
WEB ADMIN     Violations panel bharta hai
DRIVER APP    Driver ko bhi warning dikhni chahiye limit se pehle
```

`hos_regulator` column **pehle se add hai**. Engine ko sirf padhna hai.

### Unassigned driving — kuch detect nahi karta

Gaadi chali par koi driver logged in nahi tha. Iske liye **telemetry** chahiye — GPS/odometer feed
jise duty events se compare kiya jaaye. Feed nahi hai, to ye panel bhi "not checked yet" bolta hai.

---

## 5. Inspections aur defects (A07)

**Banega:** poora driver app se  ·  **Status:** chalta hai

```
WEB ADMIN     Forms → form banaya (kaun se sawaal poochne hain)
                       ↓
DRIVER APP    Shift start par pre-trip form bharta hai
              Shift end par post-trip
              Problem mile to defect add karta hai + photo
                       ↓
DATABASE      form_submissions row + defects rows
                       ↓
WEB ADMIN     Inspections tab — "2 defects, worst: Brakes — safety critical"
              Critical ho to notification bell me sabse upar
                       ↓
WEB ADMIN     Defect resolve karna / work order kholna          ← YE BANANA HAI
```

Severity: **minor / major / critical**. Critical ka matlab hai gaadi chalni hi nahi chahiye — isliye
bell me wo licence expiry se bhi upar aata hai. Paperwork wait kar sakta hai, kharab brake nahi.

**Kya nahi hai:** defect ko resolved mark karne ki UI, aur defect se work order banane ka button.
Column (`defects.work_order_id`) taiyaar hai.

---

## 6. Dispatch aur routes (A08)

**Banega:** Admin  ·  **Update hoga:** driver app se  ·  **Status:** stop detail pending

```
WEB ADMIN     Dispatch → "Plan route" → driver, vehicle, kitne stops,
              start time, notes
                       ↓
DATABASE      routes row (reference NL-0902-K3M database banata hai)
              + route_stops rows
                       ↓
DRIVER APP    Driver ko apna route dikhta hai — stop list order me   ← APP SCREEN BANNI HAI
                       ↓
DRIVER APP    Har stop par pahunch ke "Arrived" marta hai
                       ↓
DATABASE      route_stops.arrived_at + routes.status
                       ↓
WEB ADMIN     "5 of 8 stops" · late / on time / completed
              Live map par route ka progress
```

Admin ye figures type nahi karta. "5 of 8" aur late/on-time **app se** nikalte hain — window se
compare karke.

> **Gap:** route banate waqt stops "Stop 1", "Stop 2" placeholder bante hain — address aur time window
> ke bina, aur unko edit karne ki UI nahi hai. Zero stops se accha placeholder hai (0 of 0 "finished"
> padha jaata hai), par dispatcher ko asli address bharne ki jagah chahiye.

---

## 7. Forms (A09)

**Banega:** Admin  ·  **Bharega:** driver app  ·  **Status:** chalta hai

```
WEB ADMIN     Forms → "New form" → naam, kisko assign
              (naya form Notes + Photo + Signature se shuru hota hai)
                       ↓
DATABASE      forms row + fields
                       ↓
DRIVER APP    Assigned driver ko form dikhta hai, bharta hai
                       ↓
DATABASE      form_submissions row
                       ↓
WEB ADMIN     Form list me submission count badhta hai
              Inspections tab me submission dikhti hai
```

Naya form *Notes + Photo + Signature* se shuru hota hai — ye product ka faisla hai, demo data nahi:
jo form kuch capture na kare wo publish karne layak nahi.

Versioning: ek key ke sabse naye version dikhte hain, aur submission count us key ke **saare**
versions ka jodh hai. Form badalne par purani submissions gayab nahi hotin.

---

## 8. Messages (A10)

**Banega:** dono taraf  ·  **Status:** chalta hai

```
WEB ADMIN     Messages → driver choose → type → Send
                       ↓
DATABASE      messages row, direction = 'to_driver'
                       ↓
DRIVER APP    Driver ko message dikhta hai, padhta hai
                       ↓
DATABASE      read_at set
                       ↓
WEB ADMIN     Tick / read receipt

DRIVER APP    Driver reply karta hai
                       ↓
DATABASE      messages row, direction = 'from_driver'
                       ↓
WEB ADMIN     Thread me unread badge — kholne par turant clear
```

**Broadcast** har driver ko **alag message** bhejta hai, ek group message nahi. Isliye har driver ka
apna read receipt hai — pata chalta hai kisne padha, kisne nahi. Group message me ye pata nahi chalta.

---

## 9. Documents (A13)

**Banega:** dono taraf  ·  **Status:** bucket nahi hai

**Ek table, do category** — compliance aur trip paperwork ka lifecycle alag hai par shape same hai.
Teen table banane ki zarurat nahi thi.

```
WEB ADMIN     Driver / vehicle banate waqt licence, insurance, RC upload   ← UPLOAD UI BANANA HAI
                       ↓
DATABASE      documents row, category = 'compliance', expires_on ke saath
                       ↓
WEB ADMIN     Dashboard alert: "Licence expiring in 9 days"
DRIVER APP    Driver apne document padh sakta hai

DRIVER APP    Stop par POD / e-way bill / weighbridge slip ka photo
                       ↓
DATABASE      documents row, category = 'trip', route + stop se juda
                       ↓
WEB ADMIN     Documents tab — download (60-second signed URL)
```

| Category | Kya | Kahan se | Expiry |
|---|---|---|---|
| `compliance` | Licence, medical, insurance, RC | Admin | Haan — dashboard alert isi se |
| `trip` | Bill of lading, POD, e-way bill | Driver app | Nahi |

Compliance document **exactly ek cheez** ka hota hai (ek driver *ya* ek gaadi). Trip document ek
**job** ka hota hai — route + stop + driver + vehicle, saath me. Ye constraint database me likha hai.

> **Bucket abhi bana hi nahi hai.** Download button pehle row ke fields ka fake `.txt` deta tha — wo
> hata diya. Ab asli signed URL maangta hai, aur bucket ke bina wo chal nahi sakta. Supabase me
> `documents` naam ka **private** bucket banana hai — dono taraf (admin upload, app upload) ke liye.

---

## 10. Safety aur coaching (A11)

**Banega:** dashcam / telemetry  ·  **Status:** peeche kuch nahi

**Sawaal jo ye tab answer karta hai: "kaun driver risky hai, aur usse kya baat karni hai?"**

```
GAADI         Harsh braking / speeding / phone use            ← YE FEED BANANI HAI
                       ↓
DATABASE      safety_events row (video path, speed, limit, location)
                       ↓
WEB ADMIN     Safety tab — video ke saath review
              Coachable (baat karni hai) ya Dismissed (pothole tha)
                       ↓
WEB ADMIN     Coach assign + due date
                       ↓
DRIVER APP    Driver ko coaching dikhti hai — sirf PADH sakta hai
                       ↓
WEB ADMIN     Baat ho gayi → Coached
              Scoreboard batata hai kis driver ke sabse zyada event
```

Table `safety_events`. Coaching ke fields **usi table me** hain — alag coaching table nahi, kyunki
coaching hamesha ek event ki hoti hai. Alag table hota to ek-se-ek join ke alawa kuch na deta.

Driver is table me **kuch likh nahi sakta** — sirf apne event padh sakta hai. Safety record aisa ho
jise banda khud badal sake, wo record hi nahi hai.

**Abhi list khali hai** kyunki dashcam/telemetry feed nahi hai. Status set karna kaam karta hai (jab
event aayenge tab). Scoreboard bhi khali — score ka formula abhi decide nahi hua.

---

## 11. Training (A12)

**Banega:** Admin  ·  **Complete hoga:** driver app se  ·  **Status:** chalta hai

```
WEB ADMIN     Training → "New course" → naam, kitne minute,
              kisko assign (all drivers / ek depot)
                       ↓
DATABASE      courses row + course_assignments rows
                       ↓
DRIVER APP    Driver ko course dikhta hai, dekhta hai, complete karta hai
                       ↓
DATABASE      course_assignments progress update
                       ↓
WEB ADMIN     Assigned / Completed / Overdue counts
```

Naya course draft banta hai — publish karne se pehle padha jaa sakta hai.

---

## 12. Reports (A14)

**Banega:** kuch nahi banta, sirf padhta hai  ·  **Status:** chalta hai

11 report, char group me: Fleet, Compliance, Safety, Operations. Sab CSV download.

**Koi alag query nahi chalti.** Jo list console me already load hai, report usi se banti hai. Har
report apne matlab ke column deti hai — utilisation report aur defect report me ek bhi column common
nahi hai, to ek generic dump bekaar hota.

Jahan figure record nahi hua wahan `—` jaata hai, khali cell nahi. Inspector ko dikhna chahiye ki
figure **nahi hai**, ye nahi sochna chahiye ki zero hai.

**Depot filter:** naam `fleets` table se aate hain, driver ke `home_terminal` se match hote hain.
Depot nahi hain → sirf "All". Pehle do naam hardcode the — teesra depot khulta to filter hi nahi hota.

Khali report download **nahi** hoti — "nothing to run" toast aata hai. Khali spreadsheet "aisa koi
record nahi hai" padha jaata hai, jo "abhi kuch record nahi hua" se alag baat hai.

---

## 13. Users, settings aur audit (A05, A15)

**Banega:** Admin  ·  **Status:** audit write pending

```
WEB ADMIN     Users → "Invite" → naam, email, role, depot
                       ↓
DATABASE      invitations row + user_roles row
                       ↓
EMAIL         Invite link
                       ↓
WEB ADMIN     Wo banda accept karta hai, password set karta hai
              → list me naam aa jaata hai (pehle email dikhta tha)
```

Invitation accept hone tak naam nahi hota, to email hi list me dikhta hai — wahi admin ne type kiya
tha aur wahi wo pehchanta hai.

Abhi console me **ek hi role** sign in kar sakta hai: `fleet_admin`. App sirf driver ke liye hai. RLS
baaki roles (`dispatcher`, `mechanic`, `compliance_officer`) ko already samajhta hai — ye sirf
darwaaze ka faisla hai, security ka nahi.

### Organisation

Naam, country, timezone, **regulator**. Regulator cosmetic nahi hai — usse decide hota hai ki working
hours ki kaun si limits lagengi (FMCSA 11 ghante, EU 9 ghante).

Ye box pehle **kuch save nahi karta tha** — type hota tha, "Saved" bolta tha, reload par gayab.
`hos_regulator` column add kiya gaya. Text rakha hai, enum nahi — nayi rulebook add karne ke liye
migration nahi chahiye.

### Alert rules

Table `alert_rules`. On/off toggle **kaam karta hai**. **Naya rule banane ki UI nahi hai.**

```
WEB ADMIN     Settings → "New alert rule" → kya, kisko, kaise      ← YE BANANA HAI
              (email / push / SMS)
                       ↓
DATABASE      alert_rules row
                       ↓
AUTO          Condition poori hone par alert
                       ↓
WEB ADMIN     Notification bell
DRIVER APP    Push notification (agar rule me hai)
```

### Audit trail

`audit_log` padhta hai. **Likhna server ka kaam hai, client ka nahi** — jo client apna audit likh
sakta hai, wo jhoota audit bhi likh sakta hai. Isliye admin bhi seedha nahi likhta.

```
KOI BHI       Admin ya app kuch badalta hai
                       ↓
SERVER        Database trigger ya Edge Function audit_log me likhta hai   ← YE BANANA HAI
                       ↓
WEB ADMIN     Settings → Audit trail
              Dashboard → Recent activity
```

Abhi kuch likhta nahi, to dono list khali hain aur screen bolti hai "changes made in this console
will be recorded here".

---

## 14. Dashboard (A01)

**Banega:** kuch nahi banta, sab gina jaata hai  ·  **Status:** chalta hai

### 6 tile — sab live count

| Tile | Kahan se | Wo data kisne banaya |
|---|---|---|
| Drivers active / total | `drivers` | Admin |
| Vehicles active / total | `vehicles` | Admin |
| Out of service | `vehicles.status` | Admin |
| Expiring documents | `documents.expires_on` | Admin |
| Service due | `maintenance_schedules` | Admin — *pending* |
| Open work orders | `work_orders` | Admin — *pending* |

Ek saatvaan tile sirf rollout ke waqt dikhta hai: **jin drivers ka app account nahi bana.** Sab driver
app par aa gaye to ye hamesha zero rahega, aur hamesha-zero tile koi nahi padhta — isliye zero par
chhup jaata hai.

### Alerts — worst pehle

Overdue service → expired document → expiring document → open work order. Jo truck **aaj** service ke
liye overdue hai wo agle mahine expire hone waali licence se upar hai.

### Jo tile nahi hai

Drivers on duty, vehicles moving, stops completed, hours violations. Inke peeche data nahi hai. Zero
dikhana accha news jaisa padha jaata hai, isliye tile hi nahi hai.

**Recent activity** khali hai kyunki audit trail nahi likha ja raha — screen bolti hai "activity
appears here once the audit trail is recording", "all clear" nahi. "All clear" ka matlab hota "kuch
hua hi nahi".

---

## 15. Live map (A02)

**Banega:** telemetry se  ·  **Status:** map chalta hai, feed nahi

```
GAADI / PHONE  GPS position, speed, ignition                    ← YE FEED BANANI HAI
                       ↓
FUNCTION       report_position() — security definer             ← YE MIGRATION BANANI HAI
                       ↓
DATABASE       vehicles.last_latitude / last_longitude /
               last_speed_kph / last_ignition_on / last_position_at
                       ↓
WEB ADMIN      Live map — pin + driver ka naam
               (naam driver_vehicle_assignments se aata hai)
```

> **Driver app abhi position bhej hi nahi sakta.** `vehicles_write` policy sirf `fleet_admin` ko
> `vehicles` par likhne deti hai. Aur isko policy se theek **nahi** karna chahiye: RLS **row** ka
> access deti hai, column ka nahi — driver ko `vehicles` par update dene ka matlab hoga wo plate,
> odometer aur status bhi badal sakta hai. Yahi galti `driver_settings` me ho chuki hai, isliye wo
> alag table hai.
>
> Sahi tarika: ek `security definer` function — `report_position(lat, lng, speed, heading, ignition)`
> — jo sirf **paanch position columns** update kare, aur sirf **us gaadi ka** jo driver ko aaj assign
> hai.

**Status database me nahi hai.** "driving / idle / resting / offline" code me nikalta hai:

- **3 kph se upar = driving** — GPS noise 1–2 kph par baithta hai
- **15 minute se koi report nahi = offline** — 2 minute nahi, kyunki tunnel ya basement dock me gaadi
  routinely chup ho jaati hai. 15 minute ka matlab hai kuch asli galat hai.

Rule ek jagah hai, isliye badalne ke liye migration nahi chahiye. Aur dashboard bhi wahi 15 minute
use karta hai, to do screen kabhi alag baat nahi kehte.

Position nahi hai to **map phir bhi dikhta hai**, upar faded message ke saath. Map ka centre hardcode
nahi hai — jo gaadiyan hain unke hisaab se fit hota hai.

---

## Pending kaam — flow ke saath, order me

### 1. Depots screen — *admin*

```
WEB ADMIN  Depots list + Add/Edit (naam, code)
           → fleets row
           → driver picker, staff scoping, reports filter, form/course assign — sab bhar jaate hain
```
Sabse chhota kaam, sabse zyada faayda. Saath me driver ko `home_terminal` text se `fleet_id` FK par le
jaana.

### 2. Gaadi assignment — *driver app pehle, admin baad me*

```
DRIVER APP  Shift start → "Select your vehicle" → driver_vehicle_assignments row
WEB ADMIN   Vehicle detail → "Assign driver" (override / pre-assign)
            → Driver list, vehicle list, live map — teeno bhar jaate hain
```
RLS dono raaste khol chuki hai. Asli flow app wala hai.

### 3. Storage bucket + upload — *dono taraf*

```
SUPABASE    Private bucket "documents" banana
WEB ADMIN   Driver/vehicle detail → compliance document upload
DRIVER APP  Stop par POD / e-way bill photo → trip document
            → Documents tab, download signed URL se chalne lagta hai
```

### 4. Defect → work order — *driver app se defect, admin se work order*

```
DRIVER APP  Inspection ke saath ya akela defect uthata hai (ye already chalta hai)
WEB ADMIN   Inspections → defect → "Create work order"
            → work_orders row, defects.work_order_id se juda
WEB ADMIN   Work order band → defect resolved
            → Dashboard ka "open work orders" tile asli ho jaata hai
```
`defects.work_order_id` column pehle se hai. Sirf button chahiye.

### 5. Maintenance schedule — *admin*

```
WEB ADMIN   Vehicle detail → "Add schedule" (har kitne km / din)
            → maintenance_schedules row
            → "service due" tile aur overdue alert asli ho jaate hain
```

### 6. Alert rules create — *admin*

```
WEB ADMIN   Settings → "New alert rule" → kya, kisko, kaun channel
            → alert_rules row (toggle pehle se chalta hai)
```

### 7. HOS rule engine — *server*

```
SERVER      duty_status_events ke upar rule chalao
            organizations.hos_regulator se limits uthao (FMCSA 11h / EU 9h)
WEB ADMIN   Violations panel bharta hai
DRIVER APP  Driver ko limit se pehle warning
```

### 8. Audit writes — *server*

```
SERVER      Trigger / Edge Function har change par audit_log me likhe
WEB ADMIN   Settings → Audit trail, Dashboard → Recent activity
```

### 9. Telemetry feed — *sabse bada*

```
GAADI       GPS + speed + ignition (device ya driver ka phone)
            → vehicles.last_* columns
            → safety_events (harsh braking, speeding)
WEB ADMIN   Live map asli ho jaata hai
            Unassigned driving detect hone lagta hai
            Safety tab bharne lagta hai
```
Ek feed, teen module.

---

## App ke saath sync — kya aaj ho jayega, kya nahi

Ek baat saaf: **Supabase par hone se sync "automatic" nahi ho jaata.** Do alag cheezein hain:

| | Aaj | Kya chahiye |
|---|---|---|
| **Ek hi database** — app likhega, admin reload karte hi dikhega | **Chalta hai** | Kuch nahi |
| **Live sync** — bina reload, turant dikhna | **Nahi hai** | Supabase Realtime — na client me subscription hai, na table publication me |

Live sync do jagah sabse zyada chahiye: **message thread** (chat me reload karna padega, wo bura lagta
hai) aur **live map**. Baaki tabs reload par theek hain.

### Tab-by-tab: backend taiyaar hai ya nahi

| Tab | App ka kaam | Taiyaar? | Kya rok raha hai |
|---|---|---|---|
| Dashboard | Kuch nahi — admin padhta hai | **Haan** | — |
| Live map | GPS bhejna | **Nahi** | Driver ko `vehicles` par likhne ki permission nahi |
| Drivers | Login + apni profile | **Nahi** | `invite-driver` deploy nahi hua |
| Vehicles | Shift par gaadi choose | **Haan** | — |
| Users | App ka role nahi | — | — |
| Working hours | Duty status, certify, correction | **Haan** — poora | — |
| Inspections | Form bharna, defect uthana | **Aadha** | Row ban jayegi, **photo nahi** — bucket nahi |
| Dispatch / routes | Route dekhna, "Arrived" | **Haan** | — |
| Forms | Form bharna | **Haan** | — |
| Messages | Chat | **Haan** | Live nahi — reload par |
| Safety | Sirf padhna | **Haan** | Data nahi — telemetry chahiye |
| Training | Course karna | **Nahi** | `course_assignments` me koi row banata hi nahi |
| Documents | POD / e-way photo | **Nahi** | Storage bucket nahi |
| Reports | App ka role nahi | — | — |
| Settings / audit | App ka role nahi | — | — |

**Ganit:** 12 app screens me se **7 ka backend aaj taiyaar hai** — app likho, chal jayega. 4 blocked
hain, aur 1 (inspection) aadha chalega.

### Char blocker, order me

**1. Login — sabse pehla.** `invite-driver` Edge Function deploy nahi hua, `RESEND_API_KEY` set nahi.
Iske bina driver ka auth account hi nahi banta, matlab **app me koi login hi nahi kar sakta**. Do
command ka kaam hai:

```bash
npx supabase functions deploy invite-driver
```
```bash
npx supabase secrets set RESEND_API_KEY=...
```

**2. Storage bucket.** `documents` me row banane ki permission driver ke paas hai, par file rakhne ki
jagah nahi. Ye do cheezein rokta hai: trip document (POD, e-way bill) **aur** inspection ke saath ka
defect photo.

**3. GPS ki permission.** Upar Live map section me poora likha hai — `security definer` function
chahiye, policy se nahi karna.

**4. Training assignment.** `course_assignments` me code kahin likhta hi nahi. Admin course bana
sakta hai, par kisi driver ko assign nahi kar sakta — to app me training screen khali rahega.
Do taraf ka kaam.

### App-side ka sabse bada risk: offline

Driver truck me network ke bahar hoga — highway, tunnel, basement dock. App ko **offline queue**
chahiye: duty status local me likho, network aane par bhejo, order maintain rakho.

Ye backend ka kaam nahi hai, app ka hai. Par ye optional bhi nahi hai — HOS ka record legally poora
hona chahiye, aur "network nahi tha" koi bahana nahi hai. `duty_status_events` append-only hai, isliye
queue se late aayi rows safely likhi jaa sakti hain — bas start time sahi hona chahiye, bhejne ka waqt
nahi.

---

## Driver app ki taraf ka checklist

App me ye banna hai, is order me:

| # | Screen | Kya karta hai | Table |
|---|---|---|---|
| 1 | Login + password change | `must_change_password` **enforce karna zaruri hai** | `users` |
| 2 | Vehicle select | Shift start par gaadi choose | `driver_vehicle_assignments` |
| 3 | Duty status | Off / Sleeper / Driving / On duty | `duty_status_events` |
| 4 | Day certify | Din ke end me log sign | `hos_daily_logs` |
| 5 | Inspection | Pre-trip / post-trip form + defect + photo | `form_submissions`, `defects` |
| 6 | My route | Stop list, "Arrived" button | `route_stops` |
| 7 | Documents | POD / e-way bill photo | `documents` (trip) |
| 8 | Messages | Office se chat | `messages` |
| 9 | Correction request | Log galat hai to request bhejna | `duty_status_events` |
| 10 | Training | Course dekhna, complete karna | `course_assignments` |

Pehla item optional nahi hai: `must_change_password` enforce na ho to email kiya gaya password
single-use nahi rahega.
