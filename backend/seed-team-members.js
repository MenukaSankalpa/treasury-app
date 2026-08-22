import bcrypt from "bcryptjs";
import { pool } from "./config/db.js";
import "dotenv/config";

const members = [
  { empId:"EMP-0011", name:"T. Wijesinghe", email:"team.chl@chlgroup.com", password:"Pass@123", role:"TeamMember", company:"CHL" },
  { empId:"EMP-0012", name:"L. Bandaranaike", email:"team.csl@chlgroup.com", password:"Pass@123", role:"TeamMember", company:"CSL" },
  { empId:"EMP-0013", name:"H. Peris", email:"team.msts@chlgroup.com", password:"Pass@123", role:"TeamMember", company:"MSTS" },
];

async function seed() {
  for (const m of members) {
    const hash = await bcrypt.hash(m.password, 10);
    await pool.query(
      `INSERT INTO users (emp_id,name,email,password_hash,role,company) VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE name=VALUES(name)`,
      [m.empId, m.name, m.email, hash, m.role, m.company]
    );
  }
  console.log("Team members seeded. Login e.g. team.chl@chlgroup.com / Pass@123");
  process.exit(0);
}
seed().catch(err => { console.error(err); process.exit(1); });