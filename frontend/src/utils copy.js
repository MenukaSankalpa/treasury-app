export const TODAY = new Date("2025-01-24");
export const fmt = d => new Date(d).toISOString().split("T")[0];
export const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth()+n); return fmt(x); };

export const fmtM = n => `LKR ${(n/1e6).toFixed(1)}M`;
export const fmtFull = n => "LKR " + Math.round(n).toLocaleString();
export const fmtUSD = n => "USD " + n.toLocaleString();
export const fmtPct = n => n.toFixed(2) + "%";

export const daysLeft = toDate => Math.round((new Date(toDate) - TODAY) / 86400000);

export const matBucket = toDate => {
  const d = daysLeft(toDate);
  if (d <= 7) return "0–7 days";
  if (d <= 30) return "8–30 days";
  if (d <= 90) return "31–90 days";
  if (d <= 180) return "91–180 days";
  if (d <= 365) return "181–365 days";
  return ">365 days";
};

export const wtdRate = loans => {
  const tot = loans.reduce((s,l) => s+l.outstanding, 0);
  if (!tot) return 0;
  return loans.reduce((s,l) => s + l.outstanding * l.rate, 0) / tot;
};

export const genAmort = (loan, months = 24) => {
  const rows = [];
  let bal = loan.outstanding;
  const mr = loan.rate / 100 / 12;
  for (let i = 1; i <= months && bal > 0; i++) {
    const interest = Math.round(bal * mr);
    let principal = 0;
    if (loan.repayFreq === "Monthly") principal = loan.repayAmt;
    else if (loan.repayFreq === "Quarterly" && i % 3 === 0) principal = loan.repayAmt;
    principal = Math.min(principal, bal);
    const opening = bal;
    bal = Math.round(bal - principal);
    rows.push({period:i, date:addMonths(TODAY, i), opening, principal, interest, total:principal+interest, closing:bal});
  }
  return rows;
};

export const latestBalances = (balances) => {
  const map = new Map();
  for (const b of balances) {
    const existing = map.get(b.accountNo);
    if (!existing || b.asOfDate > existing.asOfDate) map.set(b.accountNo, b);
  }
  return [...map.values()];
};

export const daysOverdue = (repaymentDate) => {
  if (!repaymentDate) return 0;
  const d = Math.round((TODAY - new Date(repaymentDate)) / 86400000);
  return d > 0 ? d : 0;
};

export const isOverdue = (repaymentDate, settled) => !settled && daysOverdue(repaymentDate) > 0;

export const calcAccruedInterest = (loan) => {
  const decision = loan.treasuryDecision;
  if (!decision) return 0;
  const segments = decision.interestHistory || [];
  const endDate = loan.settlement?.settled ? loan.settlement.settledDate : fmt(TODAY);
  let total = 0;
  segments.forEach((seg, i) => {
    const segEnd = segments[i+1] ? segments[i+1].fromDate : endDate;
    const days = Math.max(0, Math.round((new Date(segEnd) - new Date(seg.fromDate))/86400000));
    total += loan.amount * (seg.rate/100) * (days/365);
  });
  return Math.round(total);
};

export const calcSettlementAmount = (loan) => {
  const principal = loan.amount;
  const interest = calcAccruedInterest(loan);
  const handlingFee = loan.treasuryDecision?.handlingFee || 0;
  const total = principal + interest + handlingFee;
  return { principal, interest, handlingFee, total };
};

export const outstandingSummary = (icLoans, company) => {
  const mine = icLoans.filter(l => l.borrowerCompany === company && l.status === "Active" && !l.settlement?.settled);
  const repayDateOf = l => l.treasuryDecision?.finalRepaymentDate || l.requestedRepaymentDate;
  const overdue = mine.filter(l => isOverdue(repayDateOf(l), false));
  const current = mine.filter(l => !isOverdue(repayDateOf(l), false));
  return {
    currentTotal: current.reduce((s,l)=>s+l.amount,0), currentCount: current.length,
    overdueTotal: overdue.reduce((s,l)=>s+l.amount,0), overdueCount: overdue.length,
  };
};

export const lenderStepsFor = (lenders) => {
  const steps = [];
  lenders.forEach(l => {
    steps.push({company:l.company, amount:l.amount, role:"Accountant", status:"Pending"});
    steps.push({company:l.company, amount:l.amount, role:"CompanyHead", status:"Pending"});
  });
  return steps;
};

export const settlementStepsFor = () => ([
  { role:"Accountant", status:"Pending" },
  { role:"CompanyHead", status:"Pending" },
  { role:"FinanceController", status:"Pending" },
]);

// Add alongside your existing exports
export const loanEditHistoryEntry = (user, changes) => ({
  by: user.name, role: user.role, date: fmt(TODAY), changes,
});

// Add alongside your existing exports
export const suggestRepayAmount = (facilityAmt, facilityDate, maturityDate, repayFreq) => {
  if (!facilityAmt || !facilityDate || !maturityDate || repayFreq === "Bullet") return 0;
  const months = Math.max(1, Math.round((new Date(maturityDate) - new Date(facilityDate)) / (1000*60*60*24*30)));
  const periods = repayFreq === "Quarterly" ? Math.max(1, Math.round(months/3)) : months;
  return Math.round((+facilityAmt) / periods);
};