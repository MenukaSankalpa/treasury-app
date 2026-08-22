import { pool } from "./config/db.js";
import "dotenv/config";

// ── Loans ──
const loans = [
  {id:"L001",company:"CHL",type:"Term Loan",bank:"HNB",bankAccountNo:null,currency:"LKR",facilityAmt:500000000,outstanding:380000000,interestType:"Variable",rate:10.75,spread:0.75,awplr:10.0,facilityDate:"2022-01-15",maturityDate:"2027-01-14",repayFreq:"Monthly",repayAmt:8333333,security:"Mortgage – Ratmalana land",purpose:"Working Capital",status:"Active"},
  {id:"L002",company:"CHL",type:"Revolving Facility",bank:"Sampath Bank",bankAccountNo:null,currency:"LKR",facilityAmt:250000000,outstanding:180000000,interestType:"Variable",rate:11.0,spread:1.0,awplr:10.0,facilityDate:"2023-06-01",maturityDate:"2025-05-31",repayFreq:"Bullet",repayAmt:0,security:"Corporate Guarantee",purpose:"Working Capital",status:"Active"},
  {id:"L003",company:"MSTS",type:"Term Loan",bank:"Commercial Bank",bankAccountNo:null,currency:"LKR",facilityAmt:200000000,outstanding:150000000,interestType:"Fixed",rate:12.5,spread:0,awplr:0,facilityDate:"2021-09-01",maturityDate:"2026-08-31",repayFreq:"Monthly",repayAmt:4166667,security:"FD Lien",purpose:"CAPEX",status:"Active"},
  {id:"L004",company:"Ceymed",type:"Mortgage Loan",bank:"HNB",bankAccountNo:null,currency:"LKR",facilityAmt:300000000,outstanding:260000000,interestType:"Fixed",rate:11.5,spread:0,awplr:0,facilityDate:"2023-01-01",maturityDate:"2033-12-31",repayFreq:"Quarterly",repayAmt:7500000,security:"Mortgage – Borella",purpose:"CAPEX",status:"Active"},
  {id:"L005",company:"CSL",type:"Permanent Overdraft",bank:"Seylan Bank",bankAccountNo:null,currency:"LKR",facilityAmt:100000000,outstanding:65000000,interestType:"Variable",rate:11.5,spread:1.5,awplr:10.0,facilityDate:"2024-01-01",maturityDate:"2025-12-31",repayFreq:"Bullet",repayAmt:0,security:"Corporate Guarantee",purpose:"Working Capital",status:"Active"},
  {id:"L006",company:"CAL",type:"Term Loan",bank:"NTB",bankAccountNo:null,currency:"LKR",facilityAmt:150000000,outstanding:90000000,interestType:"Hybrid",rate:11.0,spread:0,awplr:0,facilityDate:"2020-07-01",maturityDate:"2027-06-30",repayFreq:"Monthly",repayAmt:3571429,security:"Mortgage – Kandy",purpose:"CAPEX",status:"Active"},
  {id:"L007",company:"CES",type:"Term Loan",bank:"DFCC",bankAccountNo:null,currency:"LKR",facilityAmt:80000000,outstanding:48000000,interestType:"Fixed",rate:13.0,spread:0,awplr:0,facilityDate:"2021-03-01",maturityDate:"2026-02-28",repayFreq:"Monthly",repayAmt:2000000,security:"Equipment Mortgage",purpose:"CAPEX",status:"Active"},
  {id:"L008",company:"CMLS",type:"Lease",bank:"Commercial Bank",bankAccountNo:null,currency:"LKR",facilityAmt:45000000,outstanding:32000000,interestType:"Fixed",rate:12.0,spread:0,awplr:0,facilityDate:"2022-10-01",maturityDate:"2027-09-30",repayFreq:"Monthly",repayAmt:1100000,security:"Asset Mortgage",purpose:"CAPEX",status:"Active"},
  {id:"L009",company:"CSV",type:"Revolving Facility",bank:"Peoples Bank",bankAccountNo:null,currency:"LKR",facilityAmt:120000000,outstanding:95000000,interestType:"Variable",rate:11.25,spread:1.25,awplr:10.0,facilityDate:"2024-03-01",maturityDate:"2026-02-28",repayFreq:"Bullet",repayAmt:0,security:"Corporate Guarantee",purpose:"Working Capital",status:"Active"},
  {id:"L010",company:"CMS",type:"Term Loan",bank:"NDB",bankAccountNo:null,currency:"LKR",facilityAmt:100000000,outstanding:72000000,interestType:"Variable",rate:10.5,spread:0.5,awplr:10.0,facilityDate:"2022-05-15",maturityDate:"2027-05-14",repayFreq:"Quarterly",repayAmt:5000000,security:"FD Lien",purpose:"Working Capital",status:"Active"},
  {id:"L011",company:"CTL",type:"Temporary Overdraft",bank:"SCB",bankAccountNo:null,currency:"LKR",facilityAmt:50000000,outstanding:28000000,interestType:"Variable",rate:12.0,spread:2.0,awplr:10.0,facilityDate:"2024-06-01",maturityDate:"2025-08-31",repayFreq:"Bullet",repayAmt:0,security:"Corporate Guarantee",purpose:"Working Capital",status:"Active"},
  {id:"L012",company:"OCN",type:"Invoice Factoring",bank:"HNB",bankAccountNo:null,currency:"LKR",facilityAmt:60000000,outstanding:42000000,interestType:"Fixed",rate:14.0,spread:0,awplr:0,facilityDate:"2024-01-15",maturityDate:"2025-01-14",repayFreq:"Bullet",repayAmt:0,security:"Invoice Assignment",purpose:"Working Capital",status:"Active"},
];

// ── Deposits ──
const deposits = [
  {id:"D001",company:"CHL",bank:"HNB",branch:"Head Office",accountNo:"HNB-FD-2401",currency:"LKR",type:"Fixed Deposit - LKR",amount:50000000,rate:10.5,fromDate:"2024-10-01",toDate:"2025-04-01",pledged:true,facilityValue:45000000,leeway:5000000,purpose:"Lien for CSL OD"},
  {id:"D002",company:"CHL",bank:"Sampath Bank",branch:"Colombo 03",accountNo:"SB-FD-2402",currency:"LKR",type:"Fixed Deposit - LKR",amount:30000000,rate:10.0,fromDate:"2024-11-15",toDate:"2025-05-15",pledged:false,facilityValue:0,leeway:0,purpose:"Treasury Investment"},
  {id:"D003",company:"MSTS",bank:"Commercial Bank",branch:"Fort",accountNo:"CB-FD-2403",currency:"USD",type:"Fixed Deposit - USD",amount:100000,rate:5.5,fromDate:"2024-09-01",toDate:"2025-03-01",pledged:false,facilityValue:0,leeway:0,purpose:"USD Reserve"},
  {id:"D004",company:"Ceymed",bank:"HNB",branch:"Borella",accountNo:"HNB-FD-2404",currency:"LKR",type:"Fixed Deposit - LKR",amount:25000000,rate:10.25,fromDate:"2024-12-01",toDate:"2025-06-01",pledged:true,facilityValue:22000000,leeway:3000000,purpose:"Lien for OD"},
  {id:"D005",company:"CAL",bank:"NTB",branch:"Colombo 05",accountNo:"NTB-FD-2405",currency:"LKR",type:"Fixed Deposit - LKR",amount:40000000,rate:10.75,fromDate:"2025-01-15",toDate:"2025-07-15",pledged:false,facilityValue:0,leeway:0,purpose:"Investment"},
  {id:"D006",company:"CHL",bank:"Peoples Bank",branch:"Maradana",accountNo:"PB-MM-2406",currency:"LKR",type:"Money Market Account",amount:15000000,rate:9.5,fromDate:"2025-01-01",toDate:"2025-12-31",pledged:false,facilityValue:0,leeway:0,purpose:"Liquidity Buffer"},
  {id:"D007",company:"CMS",bank:"NDB",branch:"Maradana",accountNo:"NDB-FD-2407",currency:"LKR",type:"Fixed Deposit - LKR",amount:20000000,rate:10.0,fromDate:"2024-12-15",toDate:"2025-03-15",pledged:true,facilityValue:18000000,leeway:2000000,purpose:"Lien for Term Loan"},
  {id:"D008",company:"CSL",bank:"Seylan Bank",branch:"Galle Road",accountNo:"SB-FD-2408",currency:"LKR",type:"Fixed Deposit - LKR",amount:35000000,rate:10.5,fromDate:"2025-02-01",toDate:"2025-08-01",pledged:false,facilityValue:0,leeway:0,purpose:"Investment"},
];

// ── Rates ──
const rates = [
  {date:"2025-01-20",awplr:10.21,tb3m:9.85,tb6m:10.05,tb12m:10.35,tbond2y:11.20,tbond5y:12.10,tbond10y:12.75,usdlkr:298.50},
  {date:"2025-01-21",awplr:10.21,tb3m:9.82,tb6m:10.02,tb12m:10.32,tbond2y:11.18,tbond5y:12.08,tbond10y:12.72,usdlkr:298.75},
  {date:"2025-01-22",awplr:10.19,tb3m:9.80,tb6m:10.00,tb12m:10.30,tbond2y:11.15,tbond5y:12.05,tbond10y:12.70,usdlkr:299.10},
  {date:"2025-01-23",awplr:10.19,tb3m:9.78,tb6m:9.98,tb12m:10.28,tbond2y:11.12,tbond5y:12.02,tbond10y:12.68,usdlkr:299.25},
  {date:"2025-01-24",awplr:10.17,tb3m:9.75,tb6m:9.95,tb12m:10.25,tbond2y:11.10,tbond5y:12.00,tbond10y:12.65,usdlkr:299.50},
];

// ── Balances ──
const balances = [
  {id:"B001",company:"CHL",bank:"HNB",branch:"Head Office",accountNo:"HNB-CA-1001",accountType:"Current",currency:"LKR",balance:42500000,asOfDate:"2025-01-24"},
  {id:"B002",company:"CHL",bank:"Sampath Bank",branch:"Colombo 03",accountNo:"SB-CA-1002",accountType:"Current",currency:"LKR",balance:18750000,asOfDate:"2025-01-24"},
  {id:"B003",company:"CHL",bank:"Commercial Bank",branch:"Fort",accountNo:"CB-USD-1003",accountType:"Current",currency:"USD",balance:85000,asOfDate:"2025-01-24"},
  {id:"B004",company:"MSTS",bank:"Commercial Bank",branch:"Fort",accountNo:"CB-CA-2001",accountType:"Current",currency:"LKR",balance:9600000,asOfDate:"2025-01-24"},
  {id:"B005",company:"Ceymed",bank:"HNB",branch:"Borella",accountNo:"HNB-CA-3001",accountType:"Current",currency:"LKR",balance:6200000,asOfDate:"2025-01-24"},
  {id:"B006",company:"CSL",bank:"Seylan Bank",branch:"Galle Road",accountNo:"SB-OD-4001",accountType:"Overdraft",currency:"LKR",balance:-4300000,asOfDate:"2025-01-24"},
  {id:"B007",company:"CAL",bank:"NTB",branch:"Colombo 05",accountNo:"NTB-CA-5001",accountType:"Current",currency:"LKR",balance:3100000,asOfDate:"2025-01-24"},
  {id:"B008",company:"CMS",bank:"NDB",branch:"Maradana",accountNo:"NDB-CA-6001",accountType:"Current",currency:"LKR",balance:5400000,asOfDate:"2025-01-24"},
  {id:"B009",company:"Starlink",bank:"HNB",branch:"Head Office",accountNo:"HNB-CA-7001",accountType:"Current",currency:"LKR",balance:12800000,asOfDate:"2025-01-24"},
  {id:"B010",company:"CES",bank:"DFCC",branch:"Nugegoda",accountNo:"DFCC-CA-8001",accountType:"Current",currency:"LKR",balance:2950000,asOfDate:"2025-01-24"},
  {id:"B011",company:"CHL",bank:"HNB",branch:"Head Office",accountNo:"HNB-SB-1101",accountType:"Savings",currency:"LKR",balance:8200000,asOfDate:"2025-01-24"},
  {id:"B012",company:"MSTS",bank:"NDB",branch:"Maradana",accountNo:"NDB-SB-2101",accountType:"Savings",currency:"LKR",balance:3400000,asOfDate:"2025-01-24"},
  {id:"B013",company:"Ceymed",bank:"Sampath Bank",branch:"Colombo 03",accountNo:"SB-SB-3101",accountType:"Savings",currency:"LKR",balance:1950000,asOfDate:"2025-01-24"},
];

// ── Intercompany loans ──
// Adapted to current schema: bankName/bankAccountNo/loanType/loanNeededDate
// added with sensible defaults since the original mock data predates those fields.
const icLoans = [
  {
    id:"ICR001", requestNo:"ICR-2024-0001", borrowerCompany:"OCN", amount:5000000,
    borrowerPurpose:"Working capital shortfall for December payroll",
    bankName:"HNB", bankAccountNo:"HNB-OCN-001", loanType:"Working Capital Loan",
    grantDate:"2024-11-07", loanNeededDate:"2024-11-08", requestedRepaymentDate:"2024-11-15", remarks:"",
    attachments:[], requestedBy:"D. Kumara", requestedByEmail:"accountant.csl@chlgroup.com",
    status:"Settled",
    steps:[
      {order:1, role:"Accountant", company:"OCN", status:"Approved", by:"D. Kumara", date:"2024-11-07"},
      {order:2, role:"CompanyHead", company:"OCN", status:"Approved", by:"R. Gunawardena", date:"2024-11-07"},
      {order:3, role:"Treasury", status:"Approved", by:"P. Perera", date:"2024-11-08"},
    ],
    treasuryDecision:{
      lenders:[{company:"CSL", amount:5000000}],
      interestRate:12.41, interestHistory:[{rate:12.41, fromDate:"2024-11-08", setBy:"P. Perera"}],
      finalRepaymentDate:"2024-11-15", finalPurpose:"Working Capital",
      remarks:"Standard bridge", handlingFee:10000, decidedBy:"P. Perera", decidedDate:"2024-11-08",
    },
    lenderConfirmations:[
      {company:"CSL", amount:5000000, role:"Accountant", status:"Approved", by:"D. Kumara", date:"2024-11-09"},
      {company:"CSL", amount:5000000, role:"CompanyHead", status:"Approved", by:"R. Gunawardena", date:"2024-11-09"},
    ],
    financeController:{status:"Released", releasedBy:"A. Wickramasinghe", releasedDate:"2024-11-10"},
    settlement:{settled:true, settledDate:"2024-11-15", arRef:"1003633", dnRef:"AR-5091-DN", steps:[
      {role:"Accountant", status:"Approved"}, {role:"CompanyHead", status:"Approved"}, {role:"FinanceController", status:"Approved"},
    ]},
  },
  {
    id:"ICR002", requestNo:"ICR-2024-0002", borrowerCompany:"CMLS", amount:12000000,
    borrowerPurpose:"CAPEX — new equipment purchase",
    bankName:"Commercial Bank", bankAccountNo:"CB-CMLS-002", loanType:"CAPEX Loan",
    grantDate:"2024-12-02", loanNeededDate:"2024-12-03", requestedRepaymentDate:"2025-03-31", remarks:"",
    attachments:[], requestedBy:"N. Silva", requestedByEmail:"accountant.msts@chlgroup.com",
    status:"Active",
    steps:[
      {order:1, role:"Accountant", company:"CMLS", status:"Approved", by:"N. Silva", date:"2024-12-02"},
      {order:2, role:"CompanyHead", company:"CMLS", status:"Approved", by:"K. Fernando", date:"2024-12-02"},
      {order:3, role:"Treasury", status:"Approved", by:"P. Perera", date:"2024-12-03"},
    ],
    treasuryDecision:{
      lenders:[{company:"CSL", amount:12000000}],
      interestRate:10.81, interestHistory:[{rate:10.81, fromDate:"2024-12-03", setBy:"P. Perera"}],
      finalRepaymentDate:"2025-03-31", finalPurpose:"CAPEX",
      remarks:"", handlingFee:20000, decidedBy:"P. Perera", decidedDate:"2024-12-03",
    },
    lenderConfirmations:[
      {company:"CSL", amount:12000000, role:"Accountant", status:"Approved", by:"D. Kumara", date:"2024-12-04"},
      {company:"CSL", amount:12000000, role:"CompanyHead", status:"Approved", by:"R. Gunawardena", date:"2024-12-04"},
    ],
    financeController:{status:"Released", releasedBy:"A. Wickramasinghe", releasedDate:"2024-12-05"},
    settlement:{settled:false, steps:[]},
  },
  {
    id:"ICR003", requestNo:"ICR-2024-0003", borrowerCompany:"CAL", amount:7500000,
    borrowerPurpose:"Short term bridge before term loan drawdown",
    bankName:"NTB", bankAccountNo:"NTB-CAL-003", loanType:"Bridge Loan",
    grantDate:"2024-12-18", loanNeededDate:"2024-12-19", requestedRepaymentDate:"2025-01-10", remarks:"",
    attachments:[], requestedBy:"S. Ranasinghe", requestedByEmail:"accountant.chl@chlgroup.com",
    status:"Active",
    steps:[
      {order:1, role:"Accountant", company:"CAL", status:"Approved", by:"S. Ranasinghe", date:"2024-12-18"},
      {order:2, role:"CompanyHead", company:"CAL", status:"Approved", by:"M. Jayawardena", date:"2024-12-18"},
      {order:3, role:"Treasury", status:"Approved", by:"P. Perera", date:"2024-12-19"},
    ],
    treasuryDecision:{
      lenders:[{company:"MSTS", amount:7500000}],
      interestRate:10.72, interestHistory:[{rate:10.72, fromDate:"2024-12-19", setBy:"P. Perera"}],
      finalRepaymentDate:"2025-01-10", finalPurpose:"Bridging Facility",
      remarks:"", handlingFee:12000, decidedBy:"P. Perera", decidedDate:"2024-12-19",
    },
    // Deliberately overdue vs "today" — demonstrates the overdue rate-update flow.
    lenderConfirmations:[
      {company:"MSTS", amount:7500000, role:"Accountant", status:"Approved", by:"N. Silva", date:"2024-12-20"},
      {company:"MSTS", amount:7500000, role:"CompanyHead", status:"Approved", by:"K. Fernando", date:"2024-12-20"},
    ],
    financeController:{status:"Released", releasedBy:"A. Wickramasinghe", releasedDate:"2024-12-21"},
    settlement:{settled:false, steps:[]},
  },
  {
    id:"ICR004", requestNo:"ICR-2025-0004", borrowerCompany:"CHL", amount:9500000,
    borrowerPurpose:"Working capital for Q1 operations",
    bankName:"HNB", bankAccountNo:"HNB-CHL-004", loanType:"Working Capital Loan",
    grantDate:"2025-01-20", loanNeededDate:"2025-01-22", requestedRepaymentDate:"2025-04-20", remarks:"",
    attachments:[], requestedBy:"S. Ranasinghe", requestedByEmail:"accountant.chl@chlgroup.com",
    status:"Pending Company Head",
    steps:[
      {order:1, role:"Accountant", company:"CHL", status:"Approved", by:"S. Ranasinghe", date:"2025-01-20"},
      {order:2, role:"CompanyHead", company:"CHL", status:"Pending"},
      {order:3, role:"Treasury", status:"Pending"},
    ],
    treasuryDecision:null, lenderConfirmations:[], financeController:{status:"Pending"}, settlement:{settled:false, steps:[]},
  },
  {
    id:"ICR005", requestNo:"ICR-2025-0005", borrowerCompany:"CSL", amount:6000000,
    borrowerPurpose:"Bridge finance pending invoice collection",
    bankName:"Seylan Bank", bankAccountNo:"SB-CSL-005", loanType:"Bridge Loan",
    grantDate:"2025-01-22", loanNeededDate:"2025-01-24", requestedRepaymentDate:"2025-03-15", remarks:"",
    attachments:[], requestedBy:"D. Kumara", requestedByEmail:"accountant.csl@chlgroup.com",
    status:"Pending Treasury",
    steps:[
      {order:1, role:"Accountant", company:"CSL", status:"Approved", by:"D. Kumara", date:"2025-01-22"},
      {order:2, role:"CompanyHead", company:"CSL", status:"Approved", by:"R. Gunawardena", date:"2025-01-22"},
      {order:3, role:"Treasury", status:"Pending"},
    ],
    treasuryDecision:null, lenderConfirmations:[], financeController:{status:"Pending"}, settlement:{settled:false, steps:[]},
  },
];

async function run() {
  console.log("Seeding loans...");
  for (const l of loans) {
    await pool.query(
      `INSERT INTO loans
        (id,company,type,bank,bank_account_no,currency,facility_amt,outstanding,interest_type,rate,spread_pct,awplr,
         facility_date,maturity_date,repay_freq,repay_amt,security,purpose,status,cash_backed,attachments,edit_history)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE status=VALUES(status), outstanding=VALUES(outstanding)`,
      [l.id,l.company,l.type,l.bank,l.bankAccountNo,l.currency,l.facilityAmt,l.outstanding,l.interestType,
       l.rate,l.spread,l.awplr,l.facilityDate,l.maturityDate,l.repayFreq,l.repayAmt,l.security,l.purpose,
       l.status,false, JSON.stringify([]), JSON.stringify([])]
    );
  }
  console.log(`  ${loans.length} loans seeded.`);

  console.log("Seeding deposits...");
  for (const d of deposits) {
    await pool.query(
      `INSERT INTO deposits
        (id,company,bank,branch,account_no,currency,type,amount,rate,from_date,to_date,pledged,facility_value,leeway,purpose)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE amount=VALUES(amount)`,
      [d.id,d.company,d.bank,d.branch,d.accountNo,d.currency,d.type,d.amount,d.rate,d.fromDate,d.toDate,d.pledged,d.facilityValue,d.leeway,d.purpose]
    );
  }
  console.log(`  ${deposits.length} deposits seeded.`);

  console.log("Seeding rates...");
  for (const r of rates) {
    await pool.query(
      `INSERT INTO rates (date,awplr,tb3m,tb6m,tb12m,tbond2y,tbond5y,tbond10y,usdlkr)
       VALUES (?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE awplr=VALUES(awplr),usdlkr=VALUES(usdlkr)`,
      [r.date,r.awplr,r.tb3m,r.tb6m,r.tb12m,r.tbond2y,r.tbond5y,r.tbond10y,r.usdlkr]
    );
  }
  console.log(`  ${rates.length} rate records seeded.`);

  console.log("Seeding balances...");
  for (const b of balances) {
    await pool.query(
      `INSERT INTO balances (id,company,bank,branch,account_no,account_type,currency,balance,as_of_date)
       VALUES (?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE balance=VALUES(balance)`,
      [b.id,b.company,b.bank,b.branch,b.accountNo,b.accountType,b.currency,b.balance,b.asOfDate]
    );
  }
  console.log(`  ${balances.length} balances seeded.`);

  console.log("Seeding intercompany loans...");
  for (const l of icLoans) {
    await pool.query(
      `INSERT INTO ic_loans
        (id, request_no, borrower_company, amount, borrower_purpose,
         bank_name, bank_account_no, loan_type,
         grant_date, loan_needed_date, requested_repayment_date,
         remarks, attachments, requested_by, requested_by_email, status,
         steps, treasury_decision, lender_confirmations, finance_controller, settlement)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE status=VALUES(status)`,
      [l.id, l.requestNo, l.borrowerCompany, l.amount, l.borrowerPurpose,
       l.bankName, l.bankAccountNo, l.loanType,
       l.grantDate, l.loanNeededDate, l.requestedRepaymentDate,
       l.remarks, JSON.stringify(l.attachments), l.requestedBy, l.requestedByEmail, l.status,
       JSON.stringify(l.steps), l.treasuryDecision ? JSON.stringify(l.treasuryDecision) : null,
       JSON.stringify(l.lenderConfirmations), JSON.stringify(l.financeController), JSON.stringify(l.settlement)]
    );
  }
  console.log(`  ${icLoans.length} intercompany loans seeded.`);

  console.log("\nAll mock data seeded successfully.");
  process.exit(0);
}

run().catch(err => { console.error("Seed failed:", err); process.exit(1); });