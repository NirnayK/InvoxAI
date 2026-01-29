import type { InvoiceExtractionResult } from "../invoice/helpers";
import { InvoiceDataMapper } from "./invoice-mapper";
import { TallyXmlBuilder } from "./tally-xml-builder";
import type { InvoiceData } from "./types";

export { InvoiceDataMapper } from "./invoice-mapper";
export { TallyXmlBuilder } from "./tally-xml-builder";
export type { InvoiceData, InvoiceItem } from "./types";

const mapper = new InvoiceDataMapper();

export const convertToInvoiceData = (result: InvoiceExtractionResult): InvoiceData => {
  return mapper.convertToInvoiceData(result);
};

export const generateTallyXml = (invoices: InvoiceData[]): string => {
  const builder = new TallyXmlBuilder();
  invoices.forEach((invoice) => builder.addVoucher(invoice));
  return builder.build();
};
