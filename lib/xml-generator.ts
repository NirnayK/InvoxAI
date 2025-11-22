import type { InvoiceExtractionResult } from "./invoice/helpers";
import type { InvoiceData } from "./xml/types";
import { InvoiceDataMapper } from "./xml/invoice-mapper";
import { TallyXmlBuilder } from "./xml/tally-xml-builder";

export type { InvoiceData, InvoiceItem } from "./xml/types";
export { InvoiceDataMapper } from "./xml/invoice-mapper";
export { TallyXmlBuilder } from "./xml/tally-xml-builder";

const mapper = new InvoiceDataMapper();

export const convertToInvoiceData = (result: InvoiceExtractionResult): InvoiceData => {
  return mapper.convertToInvoiceData(result);
};

export const generateTallyXml = (invoices: InvoiceData[]): string => {
  const builder = new TallyXmlBuilder();
  invoices.forEach((invoice) => builder.addVoucher(invoice));
  return builder.build();
};

