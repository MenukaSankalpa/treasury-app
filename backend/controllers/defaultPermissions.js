export const DEFAULT_PAGE_ACCESS = {
  dashboard:     ["Accountant","CompanyHead","Treasury","FinanceController","GCFO"],
  loans:         ["Accountant","CompanyHead","Treasury","GCFO"],
  deposits:      ["Accountant","CompanyHead","Treasury","GCFO"],
  balances:      ["Accountant","CompanyHead","Treasury","GCFO"],
  intercompany:  ["Accountant","CompanyHead","Treasury","FinanceController","GCFO"],
  rates:         ["Treasury","GCFO"],
  reports:       ["Accountant","CompanyHead","Treasury","FinanceController","GCFO"],
  notifications: ["Accountant","CompanyHead","Treasury","FinanceController","GCFO"],
  audit:         ["GCFO","FinanceController"],
  users:         [],
  access:        [],
};

export const DEFAULT_ACTION_ACCESS = {
  add_facility:        { roles:["Accountant","CompanyHead"], emails:[] },
  approve_facility:    { roles:["Treasury"], emails:[] },
  add_deposit:         { roles:["Accountant","CompanyHead","Treasury"], emails:[] },
  record_balance:      { roles:["Accountant","CompanyHead","Treasury"], emails:[] },
  new_funding_request: { roles:["Accountant"], emails:[] },
  treasury_decision:   { roles:["Treasury"], emails:[] },
  lender_confirm:      { roles:["CompanyHead","Accountant"], emails:[] },
  release_payment:     { roles:["FinanceController"], emails:[] },
  settle_ic_loan:      { roles:["Treasury","FinanceController"], emails:[] },
  record_rate:         { roles:["Treasury"], emails:[] },
};