CREATE DATABASE IF NOT EXISTS treasury_db;
USE treasury_db;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  emp_id VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('SuperAdmin','Accountant','CompanyHead','Treasury','FinanceController','GCFO') NOT NULL,
  company VARCHAR(50) NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE loans (
  id VARCHAR(30) PRIMARY KEY,
  company VARCHAR(50), type VARCHAR(50), bank VARCHAR(50), currency VARCHAR(10),
  facility_amt DECIMAL(18,2), outstanding DECIMAL(18,2), interest_type VARCHAR(20),
  rate DECIMAL(6,3), spread_pct DECIMAL(6,3) DEFAULT 0, awplr DECIMAL(6,3) DEFAULT 0,
  facility_date DATE, maturity_date DATE, repay_freq VARCHAR(20), repay_amt DECIMAL(18,2) DEFAULT 0,
  security VARCHAR(255), purpose VARCHAR(150),
  status VARCHAR(30) DEFAULT 'Pending Treasury Approval',
  cash_backed BOOLEAN DEFAULT FALSE, requested_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE deposits (
  id VARCHAR(30) PRIMARY KEY,
  company VARCHAR(50), bank VARCHAR(50), branch VARCHAR(50), account_no VARCHAR(50),
  currency VARCHAR(10), type VARCHAR(50), amount DECIMAL(18,2), rate DECIMAL(6,3),
  from_date DATE, to_date DATE, pledged BOOLEAN DEFAULT FALSE,
  facility_value DECIMAL(18,2) DEFAULT 0, leeway DECIMAL(18,2) DEFAULT 0, purpose VARCHAR(150)
);

CREATE TABLE balances (
  id VARCHAR(30) PRIMARY KEY,
  company VARCHAR(50), bank VARCHAR(50), branch VARCHAR(50), account_no VARCHAR(50),
  account_type VARCHAR(20), currency VARCHAR(10), balance DECIMAL(18,2), as_of_date DATE
);

CREATE TABLE rates (
  date DATE PRIMARY KEY,
  awplr DECIMAL(6,3), tb3m DECIMAL(6,3), tb6m DECIMAL(6,3), tb12m DECIMAL(6,3),
  tbond2y DECIMAL(6,3), tbond5y DECIMAL(6,3), tbond10y DECIMAL(6,3), usdlkr DECIMAL(8,2)
);

-- Intercompany loans: nested workflow state (steps, treasury decision,
-- lender confirmations, finance controller, settlement) stored as JSON —
-- mirrors the frontend object shape exactly, avoiding a dozen join tables
-- for what is inherently a single evolving document per request.
CREATE TABLE ic_loans (
  id VARCHAR(30) PRIMARY KEY,
  request_no VARCHAR(30) UNIQUE NOT NULL,
  borrower_company VARCHAR(50), amount DECIMAL(18,2), borrower_purpose TEXT,
  grant_date DATE, requested_repayment_date DATE, remarks TEXT,
  attachments JSON,
  requested_by VARCHAR(100), requested_by_email VARCHAR(150),
  status VARCHAR(40) DEFAULT 'Pending Company Head',
  steps JSON,
  treasury_decision JSON NULL,
  lender_confirmations JSON,
  finance_controller JSON,
  settlement JSON,
  reject_reason VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
  id VARCHAR(30) PRIMARY KEY,
  title VARCHAR(150), message VARCHAR(500),
  target_emails JSON, target_roles JSON,
  type VARCHAR(20) DEFAULT 'info', entity_id VARCHAR(30),
  is_read BOOLEAN DEFAULT FALSE,
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_log (
  id VARCHAR(30) PRIMARY KEY,
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_name VARCHAR(100), user_email VARCHAR(150), user_role VARCHAR(30),
  action VARCHAR(200), entity_type VARCHAR(50), entity_id VARCHAR(30), details VARCHAR(500)
);

CREATE TABLE page_access (
  page_key VARCHAR(30) PRIMARY KEY,
  roles JSON
);

CREATE TABLE action_access (
  action_key VARCHAR(30) PRIMARY KEY,
  roles JSON, emails JSON
);