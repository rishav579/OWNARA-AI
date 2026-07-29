// Backfill risk scores, confidence, business impact, and policy triggers on existing approvals
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const approvals = await db.approval.findMany({ orderBy: { createdAt: "asc" } });
  const riskData = [
    { riskScore: 78, confidence: 0.86, businessImpact: "Financial — ₹3,499 refund to customer. Reputational — positive if handled well.", policyTrigger: "POL-001: Refund Authorization Limit", policyId: "POL-001" },
    { riskScore: 45, confidence: 0.91, businessImpact: "Revenue — potential ₹50K deal. Low risk, standard follow-up.", policyTrigger: "POL-003: Outbound Email Approval", policyId: "POL-003" },
    { riskScore: 62, confidence: 0.88, businessImpact: "Customer retention — escalated 12-day delay. Goodwill credit issued.", policyTrigger: "POL-003: Outbound Email Approval", policyId: "POL-003" },
    { riskScore: 85, confidence: 0.72, businessImpact: "Brand — generic outreach may damage reputation. Low personalization.", policyTrigger: "POL-003: Outbound Email Approval", policyId: "POL-003" },
    { riskScore: 38, confidence: 0.93, businessImpact: "Customer satisfaction — wrong item replacement. Low financial risk.", policyTrigger: "POL-008: Replacement Authorization", policyId: "POL-008" },
    { riskScore: 20, confidence: 0.95, businessImpact: "Internal — research draft. No external impact.", policyTrigger: "POL-006: Source Citation Requirement", policyId: "POL-006" },
  ];

  for (let i = 0; i < approvals.length && i < riskData.length; i++) {
    await db.approval.update({
      where: { id: approvals[i].id },
      data: riskData[i],
    });
  }
  console.log(`✓ Backfilled ${Math.min(approvals.length, riskData.length)} approvals with risk data`);

  // Also enrich task steps with policy/knowledge refs for the first task
  const firstTask = await db.task.findFirst({ orderBy: { createdAt: "asc" } });
  if (firstTask) {
    const steps = await db.taskStep.findMany({ where: { taskId: firstTask.id }, orderBy: { stepNumber: "asc" } });
    const enrichments = [
      { policyRefs: null, knowledgeRefs: null, confidence: 0.92 }, // step 1 plan
      { policyRefs: null, knowledgeRefs: JSON.stringify(["returns-policy.pdf:chunks 3,7,12"]), confidence: 0.95 }, // step 2 search_knowledge
      { policyRefs: null, knowledgeRefs: JSON.stringify(["returns-policy.pdf:chunk 7"]), confidence: 0.89 }, // step 3 reasoning
      { policyRefs: null, knowledgeRefs: null, confidence: 0.91 }, // step 4 draft_response
      { policyRefs: JSON.stringify(["POL-001"]), knowledgeRefs: null, confidence: 0.87 }, // step 5 reasoning (refund check)
      { policyRefs: JSON.stringify(["POL-001", "POL-003"]), knowledgeRefs: null, confidence: 0.83 }, // step 6 approval_gate
      { policyRefs: null, knowledgeRefs: null, confidence: null }, // step 7 pending
    ];
    for (let i = 0; i < steps.length && i < enrichments.length; i++) {
      await db.taskStep.update({
        where: { id: steps[i].id },
        data: enrichments[i],
      });
    }
    console.log(`✓ Enriched ${steps.length} task steps with policy/knowledge refs`);
  }
}

main().finally(() => db.$disconnect());
