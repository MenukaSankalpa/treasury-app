USE treasury_db;

ALTER TABLE ic_loans
  ADD COLUMN bank_name VARCHAR(50) NULL AFTER borrower_purpose,
  ADD COLUMN bank_account_no VARCHAR(50) NULL AFTER bank_name,
  ADD COLUMN loan_type VARCHAR(50) NULL AFTER bank_account_no,
  ADD COLUMN loan_needed_date DATE NULL AFTER grant_date;