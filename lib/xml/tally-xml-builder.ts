import type { InvoiceData } from "./types";

const TALLY_CONFIG = {
  purchaseLedger: "Purchase @GST",
  cgstLedger: "CGST",
  sgstLedger: "SGST",
  defaultUnit: "Nos",
};

const escapeXml = (unsafe: string | null | undefined): string => {
  if (!unsafe) return "";
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
};

const formatTallyDate = (dateStr: string | null): string => {
  if (!dateStr) return new Date().toISOString().slice(0, 10).replace(/-/g, "");

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "20250401";

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
};

const formatAddress = (address: string | null | undefined): string => {
  if (!address) return "";

  const lines = address.split(/\\n|\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return "";

  const addressElements = lines
    .map((line) => `   <ADDRESS>${escapeXml(line.trim())}</ADDRESS>`)
    .join("\n");

  return `<ADDRESS.LIST TYPE="String">
${addressElements}
  </ADDRESS.LIST>`;
};

export class TallyXmlBuilder {
  private vouchers: string[] = [];

  addVoucher(invoice: InvoiceData): this {
    this.vouchers.push(this.buildVoucher(invoice));
    return this;
  }

  build(): string {
    return this.wrapInEnvelope(this.vouchers.join("\n"));
  }

  private buildVoucher(invoice: InvoiceData): string {
    const partyName = escapeXml(invoice["seller name"] || "Unknown Supplier");
    const voucherDate = formatTallyDate(invoice.date);
    const refNumber = escapeXml(invoice["invoce number"] || "REF-001");
    const voucherNumber = escapeXml(invoice["voucher number"] || "AUTO-001");
    const gstIn = escapeXml(invoice["seller gstin"]);
    const stateName = escapeXml(invoice["place of supply"] || "Maharashtra");
    const sellerAddress = formatAddress(invoice["seller address"]);
    const grandTotal = (invoice["grand total"] || 0).toFixed(2);

    const totalCGST = invoice.items.reduce((sum, item) => sum + (item.cgst || 0), 0);
    const totalSGST = invoice.items.reduce((sum, item) => sum + (item.sgst || 0), 0);

    const inventoryEntries = invoice.items
      .map((item) => {
        const itemName = escapeXml(item.name || item.description || "General Item");
        const qty = item.quantity || 0;
        const rate = item.rate || 0;
        const unit = escapeXml(item.unit || TALLY_CONFIG.defaultUnit);
        const itemAmount = -Math.abs(item.amount || 0);

        return `
      <ALLINVENTORYENTRIES.LIST>
       <STOCKITEMNAME>${itemName}</STOCKITEMNAME>
       <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
       <RATE>${rate}/${unit}</RATE>
       <ACTUALQTY> ${qty} ${unit}</ACTUALQTY>
       <BILLEDQTY> ${qty} ${unit}</BILLEDQTY>
       <AMOUNT>${itemAmount.toFixed(2)}</AMOUNT>

       <ACCOUNTINGALLOCATIONS.LIST>
        <LEDGERNAME>${TALLY_CONFIG.purchaseLedger}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>${itemAmount.toFixed(2)}</AMOUNT>
       </ACCOUNTINGALLOCATIONS.LIST>
      </ALLINVENTORYENTRIES.LIST>`;
      })
      .join("\n");

    const sgstEntry =
      totalSGST > 0
        ? `
      <LEDGERENTRIES.LIST>
       <LEDGERNAME>${TALLY_CONFIG.sgstLedger}</LEDGERNAME>
       <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
       <AMOUNT>${(-Math.abs(totalSGST)).toFixed(2)}</AMOUNT>
      </LEDGERENTRIES.LIST>`
        : "";

    const cgstEntry =
      totalCGST > 0
        ? `
      <LEDGERENTRIES.LIST>
       <LEDGERNAME>${TALLY_CONFIG.cgstLedger}</LEDGERNAME>
       <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
       <AMOUNT>${(-Math.abs(totalCGST)).toFixed(2)}</AMOUNT>
      </LEDGERENTRIES.LIST>`
        : "";

    return `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     <VOUCHER VCHTYPE="Purchase" ACTION="Create" OBJVIEW="Invoice Voucher View">
      
      <DATE>${voucherDate}</DATE>
      <EFFECTIVEDATE>${voucherDate}</EFFECTIVEDATE>
      <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${voucherNumber}</VOUCHERNUMBER>
      <REFERENCE>${refNumber}</REFERENCE>
      
      <PARTYLEDGERNAME>${partyName}</PARTYLEDGERNAME>
      <PARTYGSTIN>${gstIn}</PARTYGSTIN>
      <STATENAME>${stateName}</STATENAME>
      ${sellerAddress}
      
      <ISINVOICE>Yes</ISINVOICE>
      <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>

      <LEDGERENTRIES.LIST>
       <LEDGERNAME>${escapeXml(invoice["seller name"] || "Unknown Supplier")}</LEDGERNAME>
       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
       <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
       <AMOUNT>${grandTotal}</AMOUNT> <BILLALLOCATIONS.LIST>
        <NAME>${refNumber}</NAME>
        <BILLTYPE>New Ref</BILLTYPE>
        <AMOUNT>${grandTotal}</AMOUNT>
       </BILLALLOCATIONS.LIST>
      </LEDGERENTRIES.LIST>

      ${inventoryEntries}

      ${sgstEntry}

      ${cgstEntry}

     </VOUCHER>
    </TALLYMESSAGE>`;
  }

  private wrapInEnvelope(content: string): string {
    return `
<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Import Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>Vouchers</REPORTNAME>
    <STATICVARIABLES>
     <SVC_CURRENT_COMPANY>##SVC_CURRENT_COMPANY</SVC_CURRENT_COMPANY>
    </STATICVARIABLES>
   </REQUESTDESC>
   <REQUESTDATA>
    ${content}
   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>`;
  }
}
