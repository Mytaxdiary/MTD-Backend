A. Tenant isolation 
This is critical. Each customer must be logically separated. 
Implement: 

Control 

Requirement 

Tenant ID on every record 

Every raw, transformed, AI and export record must include tenant_id 

Row-level access control 

Users can only query their own tenant data 

API-level tenant checks 

Never rely only on frontend filtering 

Separate storage paths 

Raw data, transformed data, logs and exports partitioned by tenant 

No cross-tenant LLM context 

AI prompts must never include data from another tenant 

Admin access restrictions 

Internal team access must be justified, logged and time-bound 
This is especially important for dashboards, root-cause analysis and PDF exports because these features can easily create accidental data leakage if tenant filters fail. 
B. Data classification 
Create a formal classification model: 

Classification 

Examples 

Controls 

Public 

Website content, public marketing assets 

Low control 

Internal 

Roadmaps, documentation, non-client code notes 

Internal-only 

Confidential 

Customer financial statements, forecasts, dashboard data, AI outputs 

Encrypted, access-controlled, logged 

Restricted 

OAuth tokens, API secrets, refresh tokens, bank data, credentials, security logs 

Strongest controls, secret manager, limited access 
Xero/QuickBooks tokens, LLM API keys and customer financial data should be treated as Restricted or Confidential, not ordinary application data. 
4. API best practices for Xero and QuickBooks 
For Xero/QuickBooks integrations, your main risks are token compromise, excessive permissions, poor refresh-token handling and over-collecting data. 
Implement the following: 

Area 

Best practice 

OAuth scopes 

Request the minimum scopes needed for forecasting, dashboards and AI insight 

Token storage 

Store access and refresh tokens in a secrets manager or encrypted vault, never in plain database columns 

Token rotation 

Support refresh-token rotation and revoke tokens when a customer disconnects 

Disconnect flow 

Provide a clear “disconnect accounting system” feature 

API ingestion logs 

Log sync status, not full payloads 

Rate limit handling 

Queue and retry safely without duplicating records 

Idempotency 

Re-running a sync should not duplicate transactions 

Data freshness 

Show “last synced at” clearly in the UI 

Error handling 

Avoid exposing raw API errors to end users if they contain sensitive information 

Least privilege access 

Developers should not have production API token access by default 
OWASP’s API Security Top 10 highlights broken object-level authorisation as the top API risk, meaning every endpoint that accesses tenant objects by ID should enforce object-level authorisation server-side.




Implemented ✅
Password hashing with bcrypt (12 rounds), never stored in plain text
Refresh tokens stored as SHA-256 hashes only, raw tokens never persisted
Single-use password reset tokens with 1-hour expiry
Generic login error message — does not reveal if email exists
Refresh token rotation — old token revoked on every refresh
All refresh tokens revoked on password reset (forces re-login)
Rate limiting globally on all API endpoints (ThrottlerGuard)
Helmet security headers on all responses
CORS restricted to frontend URL in production
DTO whitelist validation — unknown fields rejected on all endpoints
JWT secret required and validated in env on startup
Swagger docs disabled in production
Daily cron jobs to purge expired and revoked tokens from DB
Cascade delete — tokens deleted automatically when user is deleted
401 interceptor on frontend Axios client
Protected vs public route separation on frontend
.env removed from git tracking

Can implement now (easy wins) 🔜
Stricter rate limit on auth endpoints (login, register) — currently global 100/min, should be ~10/min
Frontend JWT token storage and Axios interceptor wiring (TODO stubs already in place)
Frontend checkAuth() real implementation — currently returns mock true
HTTPS enforce on backend in production

Implement later (future phases) 📅
Tenant isolation — tenant_id on all records, row-level filtering in every query
Xero/QuickBooks OAuth token storage in secrets manager/vault, rotation, disconnect flow
Email verification flow (isEmailVerified column already exists, flow missing)
Move env secrets to AWS Secrets Manager or similar vault for production
Admin access logging and audit trail for internal team
Data at-rest encryption for sensitive DB columns (financial data)
LLM tenant isolation — AI prompts must never mix data across tenants
OWASP object-level authorisation — ownership checks on every ID-based endpoint
Formal data classification enforcement in code (Confidential / Restricted handling)












Han — maine jo context aur ab tak ka kaam hai uske basis par isko 3 parts me tod diya hai:

## 1) Jo hum **already implement kar chuke hain** ya partially kar chuke hain

### Backend side

* NestJS backend boilerplate
* TypeORM setup
* global validation
* global exception handling
* response interceptor
* Helmet
* CORS
* rate limiting
* Swagger
* Docker
* env validation with Joi
* health/test API

Yani **basic API security foundation** lag chuki hai.
Iska matlab:

* raw insecure Nest app nahi hai
* request validation ho rahi hai
* error responses controlled hain
* basic middleware/security layer lag chuki hai

### Frontend side

* auth screens
* protected/public route structure
* reusable components
* mock cleanup
* feature cleanup
* some issue fixes and dashboard/client flows

Yani **UI foundation and auth flow structure** ready hai.

---

## 2) Is CEO note me se **kya abhi tak missing hai**

Yeh important part hai.

# A. Tenant isolation

Yeh **abhi implement nahi hua** lagta hai.

### Missing items:

* `tenant_id` on every relevant record
* row-level tenant isolation
* API-level tenant checks
* separate storage paths by tenant
* admin access restrictions with audit logs
* no cross-tenant AI context

### Current status

Abhi project **single-tenant style foundation** par lag raha hai, ya at least tenant isolation formally enforce nahi hui.

### Risk

Yeh later add karna possible hai, lekin **jitni jaldi karoge utna better**, warna baad me:

* tables change karni padengi
* queries update hongi
* auth guards/update karne padenge
* exports/logs/storage me rework lagega

---

# B. Data classification

Yeh bhi **abhi formalized nahi hua**.

### Missing:

* Public / Internal / Confidential / Restricted classification model
* kis data par kaun se controls lagenge
* tokens / secrets / financial data ki formal handling policy

### Current status

Abhi practical level par env/config hai, but **formal classification framework** nahi.

---

# C. Xero / QuickBooks style API security best practices

Agar future integrations ke liye dekhein, to inme se almost sab **pending** hain:

* minimum OAuth scopes
* token vault / secret manager
* token rotation / revoke flow
* disconnect integration flow
* ingestion logs without full payloads
* idempotent sync
* safe retry handling
* last synced at
* sanitized API error handling
* least-privilege developer access

### Current status

Abhi hum HMRC sandbox/Postman stage par hain, app integration level par nahi.
To yeh sab abhi naturally pending hain.

---

## 3) Inme se **abhi kya implement karna chahiye** aur kya baad me

## Abhi implement karna chahiye

### Priority 1 — Tenant foundation

Yeh sabse pehle karna chahiye.

#### Abhi kya kar sakte ho:

* `tenant_id` strategy decide karo
* users table me tenant relation add karo
* future domain tables ke liye base entity pattern banao
* request se tenant context nikalne ka structure banao
* tenant guard / tenant-aware query pattern define karo
* API-level authorization pattern decide karo

**Matlab full tenant module nahi, but tenant-ready architecture abhi.**

### Priority 2 — Secret handling basics

Abhi hi:

* no secrets in code
* no tokens hardcoded
* env cleanup
* `.env.example`
* token fields ko sensitive mark karo
* logs me tokens/payloads mask karo

### Priority 3 — Data classification document / constants

Abhi ek simple internal policy bana lo:

* Public
* Internal
* Confidential
* Restricted

Aur define karo:

* customer financial data = Confidential
* tokens / refresh tokens / credentials = Restricted

Yeh coding se pehle governance clear karega.

### Priority 4 — Auth + authorization design with tenant-awareness

Auth banate waqt hi:

* user belongs to tenant
* role belongs to tenant
* profile returns tenant context
* protected APIs tenant-aware hon

### Priority 5 — Logging rules

Abhi custom logger full level par nahi bhi lagao, tab bhi:

* sensitive request bodies log na ho
* tokens log na ho
* auth errors sanitize hon
* future exports/log access ke liye placeholders rakho

---

## Baad me implement karna chahiye

### After auth / client module

* actual row-level enforcement in all repositories/services
* admin access logs
* time-bound support access
* PDF/export tenant partition checks
* audit trail

### After integrations

* secret manager / vault
* refresh token rotation
* disconnect flows
* safe sync logs
* idempotency
* retry queues
* last synced at
* sanitized provider error handling

### After AI/features

* no cross-tenant prompt building
* prompt context sanitization
* AI output classification

---

## Short practical verdict

### Already done

* base backend security foundation
* auth/frontend structure
* env/validation/swagger/docker basics

### Not done yet

* tenant isolation
* formal data classification
* secure token vaulting
* integration-specific token lifecycle controls
* admin access controls
* row-level data isolation
* audit-heavy export/log protections

### What to do now

Sabse pehle:

1. **tenant-ready backend architecture**
2. **data classification model**
3. **secret/token handling hygiene**
4. **auth ko tenant-aware banana**

### What to leave for later

* full RBAC
* support/admin audit workflows
* secret manager
* full integration revoke/rotation/disconnect
* AI isolation controls
* export-level advanced restrictions

---

## Mere hisaab se abhi jo immediate tasks banne chahiye

* tenant model define karo
* users + roles ko tenant-aware banao
* coding standards me restricted/confidential data rules define karo
* token/log masking implement karo
* repository/service pattern me tenant filter design karo

Agar chaho to main is note ke basis par **“implemented / pending / do now / do later”** ka ek clean client-facing reply bhi likh deta hoon.
