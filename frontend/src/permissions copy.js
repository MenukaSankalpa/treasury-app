export const ROLES = ["SuperAdmin", "HOC", "HOF", "Treasury", "GCFO"];

export const PAGES = [
  {key:"dashboard",    label:"Dashboard"},
  {key:"loans",        label:"Loans & Borrowings"},
  {key:"deposits",     label:"Deposits"},
  {key:"balances",     label:"Bank Balances"},
  {key:"intercompany", label:"Intercompany"},
  {key:"rates",        label:"Rate Registry"},
  {key:"reports",      label:"Reports"},
  {key:"users",        label:"User Management"},
  {key:"access",       label:"Access Control"},
];

// SuperAdmin is always full-access and cannot be restricted (enforced in PermissionsContext).
export const DEFAULT_PAGE_ACCESS = {
  dashboard:     ["SuperAdmin", "HOC", "HOF", "Treasury", "GCFO"],
  loans:         ["SuperAdmin", "HOC", "HOF", "Treasury"],
  deposits:      ["SuperAdmin", "HOC", "HOF", "Treasury"],
  balances:      ["SuperAdmin", "HOC", "HOF", "Treasury"],
  intercompany:  ["SuperAdmin", "HOC", "HOF", "Treasury", "GCFO"],
  rates:         ["SuperAdmin", "Treasury"],
  reports:       ["SuperAdmin", "HOC", "HOF", "Treasury", "GCFO"],
  users:         ["SuperAdmin"],
  access:        ["SuperAdmin"],
};

// Action-level permissions — the actual buttons that create/write data.
// A user can perform an action if EITHER their role is checked here
// (role-based default) OR their email is explicitly granted in the
// per-action email list (individual override, on top of role).
export const ACTIONS = [
  {key:"add_facility",         label:"Add Facility",              page:"loans"},
  {key:"add_deposit",          label:"Add Deposit",               page:"deposits"},
  {key:"record_balance",       label:"Record Today's Balance",    page:"balances"},
  {key:"new_funding_request",  label:"New Funding Request",       page:"intercompany"},
  {key:"settle_ic_loan",       label:"Settle Intercompany Loan",  page:"intercompany"},
  {key:"record_rate",          label:"Record Today's Rate",       page:"rates"},
];

export const DEFAULT_ACTION_ACCESS = {
  add_facility:        { roles:["SuperAdmin","HOC","HOF","Treasury"], emails:[] },
  add_deposit:         { roles:["SuperAdmin","HOC","HOF","Treasury"], emails:[] },
  record_balance:      { roles:["SuperAdmin","HOC","HOF","Treasury"], emails:[] },
  new_funding_request: { roles:["SuperAdmin","HOC","HOF","Treasury"], emails:[] },
  settle_ic_loan:      { roles:["SuperAdmin","Treasury","GCFO"],       emails:[] },
  record_rate:         { roles:["SuperAdmin","Treasury"],              emails:[] },
};