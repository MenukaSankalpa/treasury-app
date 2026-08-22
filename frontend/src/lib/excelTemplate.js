import * as XLSX from "xlsx";

export function downloadIcLoanTemplate() {
  const headers = ["Borrower Company","Amount (LKR)","Purpose / Reason","Grant Date (YYYY-MM-DD)","Requested Repayment Date (YYYY-MM-DD)","Remarks"];
  const sample = ["CHL", 5000000, "Working capital shortfall for Q2", "2025-02-01", "2025-05-01", ""];
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  ws["!cols"] = headers.map(()=>({wch:28}));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "IC Loan Requests");
  XLSX.writeFile(wb, "IC_Loan_Request_Template.xlsx");
}

export function parseIcLoanTemplate(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, {type:"array"});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, {header:1});
        const [, ...dataRows] = rows;
        const parsed = dataRows.filter(r=>r.length && r[0]).map(r => ({
          borrowerCompany: r[0], amount: Number(r[1])||0, purpose: r[2]||"",
          grantDate: r[3], requestedRepaymentDate: r[4], remarks: r[5]||"",
        }));
        resolve(parsed);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}