import bcrypt from "bcryptjs";
import { pool } from "./config/db.js";
import "dotenv/config";

const users = [
  { empId:"EMP-0001", name:"System Admin",      email:"admin@chlgroup.com",         password:"Admin@123", role:"SuperAdmin", company:null },
  { empId:"EMP-0002", name:"S. Ranasinghe",      email:"accountant.chl@chlgroup.com", password:"Pass@123",  role:"Accountant", company:"CHL" },
  { empId:"EMP-0003", name:"M. Jayawardena",     email:"head.chl@chlgroup.com",       password:"Pass@123",  role:"CompanyHead", company:"CHL" },
  { empId:"EMP-0004", name:"P. Perera",          email:"treasury@chlgroup.com",       password:"Pass@123",  role:"Treasury", company:null },
  { empId:"EMP-0005", name:"D. Kumara",          email:"accountant.csl@chlgroup.com", password:"Pass@123",  role:"Accountant", company:"CSL" },
  { empId:"EMP-0006", name:"R. Gunawardena",     email:"head.csl@chlgroup.com",       password:"Pass@123",  role:"CompanyHead", company:"CSL" },
  { empId:"EMP-0007", name:"N. Silva",           email:"accountant.msts@chlgroup.com",password:"Pass@123",  role:"Accountant", company:"MSTS" },
  { empId:"EMP-0008", name:"K. Fernando",        email:"head.msts@chlgroup.com",      password:"Pass@123",  role:"CompanyHead", company:"MSTS" },
  { empId:"EMP-0009", name:"A. Wickramasinghe",  email:"fc@chlgroup.com",             password:"Pass@123",  role:"FinanceController", company:null },
  { empId:"EMP-0010", name:"T. Bandara",         email:"gcfo@chlgroup.com",           password:"Pass@123",  role:"GCFO", company:null },
];

const DEFAULT_PAGE_ACCESS = {
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

const DEFAULT_ACTION_ACCESS = {
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

async function seed() {
  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    await pool.query(
      `INSERT INTO users (emp_id,name,email,password_hash,role,company) VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE name=VALUES(name)`,
      [u.empId, u.name, u.email, hash, u.role, u.company]
    );
  }
  for (const [key, roles] of Object.entries(DEFAULT_PAGE_ACCESS)) {
    await pool.query(`INSERT INTO page_access (page_key, roles) VALUES (?,?) ON DUPLICATE KEY UPDATE roles=VALUES(roles)`, [key, JSON.stringify(roles)]);
  }
  for (const [key, rule] of Object.entries(DEFAULT_ACTION_ACCESS)) {
    await pool.query(`INSERT INTO action_access (action_key, roles, emails) VALUES (?,?,?) ON DUPLICATE KEY UPDATE roles=VALUES(roles), emails=VALUES(emails)`, [key, JSON.stringify(rule.roles), JSON.stringify(rule.emails)]);
  }
  console.log("Seeded. Login: admin@chlgroup.com / Admin@123");
  process.exit(0);
}
seed();