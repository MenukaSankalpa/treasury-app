USE treasury_db;

ALTER TABLE loans
  ADD COLUMN bank_account_no VARCHAR(50) NULL AFTER bank,
  ADD COLUMN attachments JSON NULL,
  ADD COLUMN edit_history JSON NULL,
  ADD COLUMN requested_by_email VARCHAR(150) NULL AFTER requested_by,
  ADD COLUMN reject_reason VARCHAR(255) NULL,
  ADD COLUMN company_head_decided_by VARCHAR(100) NULL,
  ADD COLUMN company_head_decided_date DATE NULL;