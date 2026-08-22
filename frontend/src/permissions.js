export const ROLES = ["SuperAdmin", "TeamMember", "Accountant", "CompanyHead", "Treasury", "FinanceController", "GCFO"];

export const PAGES = [
  {key:"dashboard",     label:"Dashboard"},
  {key:"loans",         label:"Loans & Borrowings"},
  {key:"deposits",      label:"Deposits"},
  {key:"balances",      label:"Bank Balances"},
  {key:"intercompany",  label:"Intercompany"},
  {key:"rates",         label:"Rate Registry"},
  {key:"reports",       label:"Reports"},
  {key:"notifications", label:"Notifications"},
  {key:"audit",         label:"Audit Log"},
  {key:"users",         label:"User Management"},
  {key:"access",        label:"Access Control"},
];

export const DEFAULT_PAGE_ACCESS = {
  dashboard:     ["SuperAdmin","TeamMember","Accountant","CompanyHead","Treasury","FinanceController","GCFO"],
  loans:         ["SuperAdmin","Accountant","CompanyHead","Treasury","GCFO"],
  deposits:      ["SuperAdmin","Accountant","CompanyHead","Treasury","GCFO"],
  balances:      ["SuperAdmin","Accountant","CompanyHead","Treasury","GCFO"],
  intercompany:  ["SuperAdmin","TeamMember","Accountant","CompanyHead","Treasury","FinanceController","GCFO"],
  rates:         ["SuperAdmin","Treasury","GCFO"],
  reports:       ["SuperAdmin","Accountant","CompanyHead","Treasury","FinanceController","GCFO"],
  notifications: ["SuperAdmin","TeamMember","Accountant","CompanyHead","Treasury","FinanceController","GCFO"],
  audit:         ["SuperAdmin","GCFO","FinanceController"],
  users:         ["SuperAdmin"],
  access:        ["SuperAdmin"],
};

export const ACTIONS = [
  {key:"add_facility",         label:"Add Facility",              page:"loans"},
  {key:"approve_facility",     label:"Approve/Reject Facility",   page:"loans"},
  {key:"add_deposit",          label:"Add Deposit",               page:"deposits"},
  {key:"record_balance",       label:"Record Today's Balance",    page:"balances"},
  {key:"new_funding_request",  label:"New IC Funding Request",    page:"intercompany"},
  {key:"accountant_review",    label:"Accountant Review IC Request", page:"intercompany"},
  {key:"treasury_decision",    label:"Treasury Approve/Set Terms",page:"intercompany"},
  {key:"lender_confirm",       label:"Lender Confirm/Reject",     page:"intercompany"},
  {key:"release_payment",      label:"Release Payment (FC)",      page:"intercompany"},
  {key:"settle_ic_loan",       label:"Settle Intercompany Loan",  page:"intercompany"},
  {key:"record_rate",          label:"Record Today's Rate",       page:"rates"},
];

export const DEFAULT_ACTION_ACCESS = {
  add_facility: { roles:["SuperAdmin","TeamMember","Accountant"], emails:[] },
  approve_facility:    { roles:["SuperAdmin","Treasury"], emails:[] },
  add_deposit:         { roles:["SuperAdmin","Accountant","CompanyHead","Treasury"], emails:[] },
  record_balance:      { roles:["SuperAdmin","Accountant","CompanyHead","Treasury"], emails:[] },
  new_funding_request: { roles:["SuperAdmin","TeamMember"], emails:[] },
  accountant_review:   { roles:["SuperAdmin","Accountant"], emails:[] },
  treasury_decision:   { roles:["SuperAdmin","Treasury"], emails:[] },
  lender_confirm:      { roles:["SuperAdmin","CompanyHead","Accountant"], emails:[] },
  release_payment:     { roles:["SuperAdmin","FinanceController"], emails:[] },
  settle_ic_loan:      { roles:["SuperAdmin","Treasury","Accountant","CompanyHead","FinanceController"], emails:[] },
  record_rate:         { roles:["SuperAdmin","Treasury"], emails:[] },
  //add_facility:        { roles:["SuperAdmin","TeamMember"], emails:[] },
  //accountant_review:   { roles:["SuperAdmin","Accountant"], emails:[] },
};

export const IC_PURPOSES = ["Working Capital", "Short Term Project", "Bridging Facility", "CAPEX"];