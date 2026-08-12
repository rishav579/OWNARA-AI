# BIHARI AI — Design Partner Pilot Checklist

## What This Is

BIHARI AI is an AI Employee Operating System. Your first AI Employee is **Kavya**, a Finance / Accounts Receivable & Collections Employee. You delegate a persistent responsibility to her — a **Mandate** — and she continuously pursues the desired outcome within boundaries you define.

---

## 1. Customer Onboarding Steps

1. **Sign up** at the login page (email, password, name, workspace name)
2. **Enter your workspace** — you are the owner
3. **Import receivables data** via CSV (invoices, customers, or payments)
4. **Review imported data** in the Receivables page
5. **Kavya is hired automatically** during onboarding setup
6. **The "Maintain Healthy Receivables" Mandate is granted automatically**
7. **Review the authority** Kavya has been granted (autonomous / approval-required / forbidden)
8. **The Mandate activates immediately** — Kavya begins observing your receivables

No developer intervention, SQL, or seeding is required.

---

## 2. Required CSV Format

### Invoices CSV

```
customer_name,customer_email,invoice_number,issue_date,due_date,subtotal,tax
Alpha Industries,accounts@alpha.com,INV-001,2025-01-01,2025-02-15,500000,90000
Beta Trading,finance@beta.com,INV-002,2025-01-01,2025-01-15,300000,54000
```

- `subtotal` and `tax` are in paise (1 rupee = 100 paise). Example: ₹5,000 = 500000
- `issue_date` and `due_date` format: YYYY-MM-DD
- If `due_date` is in the past, the invoice is automatically marked overdue

### Customers CSV

```
name,email,phone,gstin,payment_terms,credit_limit,risk_level
Alpha Industries,accounts@alpha.com,+91 98765 43210,33AABCS1234F1Z5,30,500000,low
```

### Payments CSV

```
invoice_number,amount,payment_date,method,reference
INV-001,500000,2025-02-10,bank_transfer,NEFT-HDFC-984732
```

- `amount` is in paise
- The invoice must already exist in the workspace

---

## 3. Authority Explanation

Kavya operates within a strict authority boundary:

| Category | What it means | Examples |
|----------|--------------|----------|
| **Autonomous** | Kavya may do these WITHOUT your approval | generate_reminder, search_knowledge, update_collection_case |
| **Requires Approval** | Kavya asks for your approval before acting | send_reminder, send_email |
| **Forbidden** | Kavya must NEVER do these | offer_discount_above_10, send_legal_notice, write_off_invoice |

You can review and modify the authority on the Mandate Detail page.

---

## 4. Email Setup Requirements

### Development / Demo (current)

Email uses **MOCK TRANSPORT**. No email is actually sent. Reminders are labeled:
- Status: `sent_mock`
- Evidence: `MOCK TRANSPORT — email not actually delivered`

### Production

Set these environment variables:
```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM=noreply@yourdomain.com
SMTP_FROM_NAME="BIHARI AI"
```

When SMTP is configured, reminders will be sent via real SMTP and status will be `sent` with a real `messageId`.

---

## 5. Mock vs Real Execution

| Mode | Status | What happens | Label |
|------|--------|-------------|-------|
| Mock | `sent_mock` | Email logged to console, NOT sent | "MOCK TRANSPORT" |
| Real | `sent` | Email sent via SMTP, messageId stored | (no special label) |
| Failed | `failed` | SMTP error, error message stored | "failed" |

The UI always shows which mode was used. Mock is never presented as real.

---

## 6. What Kavya Can Do

- Observe your receivables data (invoices, customers, payments, reminders)
- Evaluate whether your receivables are healthy (overdue rate vs target)
- Select an appropriate strategy based on observed state:
  - **investigate_disputed** — when invoices have open disputes
  - **prioritize_high_value** — when one customer represents concentrated risk
  - **escalate_unresponsive** — when customers haven't responded to reminders
  - **send_reminder_campaign** — for standard overdue invoices
  - **wait_for_promise** — when customers have promised to pay
- Generate draft reminders
- Send reminders (requires your approval)
- Update collection cases
- Learn from each episode (Mandate-level memory with provenance)
- Survive employee replacement (the Mandate persists, the memory persists)

---

## 7. What Kavya Cannot Do

- Cannot send emails without your approval
- Cannot offer discounts above 10%
- Cannot send legal notices
- Cannot write off invoices
- Cannot modify invoice amounts or payment records
- Cannot choose strategies outside the deterministic selector (no unrestricted LLM autonomy)
- Cannot access data from other workspaces
- Cannot fabricate business outcomes

---

## 8. Approval Workflow

1. Kavya selects a strategy and spawns an episode
2. If the episode requires an action that needs approval (e.g., `send_reminder`), an approval request is created
3. You see the approval in the **Decision Center** with:
   - WHAT action Kavya wants to take
   - WHICH customer and invoice
   - WHY the strategy was selected
   - WHAT authority is required
   - WHAT evidence supports the recommendation
   - WHAT risk is involved
4. You **Approve** or **Reject**
5. If approved, Kavya executes the action and records evidence
6. The audit trail records the decision

---

## 9. How Outcomes Are Measured

### Activity (what Kavya did)
- Reminders sent
- Episodes executed
- Approvals requested

### Outcome (whether the business improved)
- Overdue rate (current vs target)
- Overdue amount
- Amount recovered (from payments)
- Customer responses
- Mandate health score (0-100)

### Reliability
- Approval rate
- Intervention rate
- Execution success rate
- Failure rate

**100 reminders sent ≠ healthy receivables.** The Mandate measures OUTCOME, not just activity.

---

## 10. Known Limitations

1. **Strategy selector is deterministic.** Kavya uses a fixed decision tree, not unrestricted AI. This is intentional for trust and auditability.
2. **No trend history yet.** Health shows current state, not improving/stable/worsening over time.
3. **No real SMTP in development.** Email uses mock transport. Production requires SMTP credentials.
4. **No multi-agent.** Only Kavya (Finance Employee) exists. Other employees are future.
5. **No Mandate composition.** Parent/child Mandates are not yet implemented.
6. **No CI pipeline.** Tests are run manually.
7. **No load testing.** Single-user reliability is proven; multi-tenant load is not.

---

## Demo Account

For design-partner demonstrations:

```
Email: demo@bihari.ai
Password: BihariDemo@2026!
```

This account has a pre-seeded workspace with realistic receivables data. All seeded data is labeled "DEMO DATA" in the UI. Mock email is labeled "MOCK TRANSPORT".

**This account is for development/demo only. It must NOT be available in production.**

---

## Contact

For technical questions during the pilot, contact the BIHARI AI engineering team.
