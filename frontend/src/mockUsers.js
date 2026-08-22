export const MOCK_USERS = [
  { id:1,  empId:"EMP-0001", name:"System Admin",       email:"admin@chlgroup.com",         password:"Admin@123", role:"SuperAdmin",      company:null },
  { id:2,  empId:"EMP-0002", name:"S. Ranasinghe",      email:"accountant.chl@chlgroup.com", password:"Pass@123",  role:"Accountant",       company:"CHL" },
  { id:3,  empId:"EMP-0003", name:"M. Jayawardena",     email:"head.chl@chlgroup.com",       password:"Pass@123",  role:"CompanyHead",      company:"CHL" },
  { id:4,  empId:"EMP-0004", name:"P. Perera",          email:"treasury@chlgroup.com",       password:"Pass@123",  role:"Treasury",         company:null },
  { id:5,  empId:"EMP-0005", name:"D. Kumara",          email:"accountant.csl@chlgroup.com", password:"Pass@123",  role:"Accountant",       company:"CSL" },
  { id:6,  empId:"EMP-0006", name:"R. Gunawardena",     email:"head.csl@chlgroup.com",       password:"Pass@123",  role:"CompanyHead",      company:"CSL" },
  { id:7,  empId:"EMP-0007", name:"N. Silva",           email:"accountant.msts@chlgroup.com",password:"Pass@123",  role:"Accountant",       company:"MSTS" },
  { id:8,  empId:"EMP-0008", name:"K. Fernando",        email:"head.msts@chlgroup.com",      password:"Pass@123",  role:"CompanyHead",      company:"MSTS" },
  { id:9,  empId:"EMP-0009", name:"A. Wickramasinghe",  email:"fc@chlgroup.com",             password:"Pass@123",  role:"FinanceController",company:null },
  { id:10, empId:"EMP-0010", name:"T. Bandara",         email:"gcfo@chlgroup.com",           password:"Pass@123",  role:"GCFO",             company:null },
];

export function mockLogin(email, password) {
  const user = MOCK_USERS.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user || user.password !== password) throw new Error("Invalid email or password");
  const { password: _pw, ...safeUser } = user;
  return { token: "mock-token-" + user.id, user: safeUser };
}