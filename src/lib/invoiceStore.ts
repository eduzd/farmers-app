import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface InvoiceItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  sellerId: string;
  sellerName: string;
  sellerAddress: string;
  sellerPhone: string;
  sellerEmail?: string;
  buyerId: string;
  buyerName: string;
  buyerAddress: string;
  buyerPhone: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  discountPercent: number;
  tax: number;
  taxPercent: number;
  shippingCost: number;
  total: number;
  currency: string;
  notes?: string;
  paymentStatus: "paid" | "unpaid" | "partial";
  createdAt: number;
  dueDate?: number;
}

interface InvoiceState {
  invoices: Invoice[];
  
  createInvoice: (invoice: Omit<Invoice, "id" | "invoiceNumber" | "createdAt">) => Invoice;
  getInvoice: (invoiceId: string) => Invoice | undefined;
  getInvoicesByOrder: (orderId: string) => Invoice[];
  getInvoicesBySeller: (sellerId: string) => Invoice[];
  getInvoicesByBuyer: (buyerId: string) => Invoice[];
  updatePaymentStatus: (invoiceId: string, status: Invoice["paymentStatus"]) => void;
  generateInvoiceNumber: () => string;
}

const generateInvoiceNumber = (): string => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `INV-${year}${month}-${random}`;
};

const MOCK_INVOICES: Invoice[] = [];

export const useInvoiceStore = create<InvoiceState>()(
  persist(
    (set, get) => ({
      invoices: MOCK_INVOICES,

      createInvoice: (invoice) => {
        const newInvoice: Invoice = {
          id: Date.now().toString(),
          invoiceNumber: generateInvoiceNumber(),
          ...invoice,
          createdAt: Date.now(),
        };
        set((state) => ({
          invoices: [newInvoice, ...state.invoices],
        }));
        return newInvoice;
      },

      getInvoice: (invoiceId) => {
        return get().invoices.find((i) => i.id === invoiceId);
      },

      getInvoicesByOrder: (orderId) => {
        return get().invoices.filter((i) => i.orderId === orderId);
      },

      getInvoicesBySeller: (sellerId) => {
        return get().invoices.filter((i) => i.sellerId === sellerId);
      },

      getInvoicesByBuyer: (buyerId) => {
        return get().invoices.filter((i) => i.buyerId === buyerId);
      },

      updatePaymentStatus: (invoiceId, status) => {
        set((state) => ({
          invoices: state.invoices.map((i) =>
            i.id === invoiceId ? { ...i, paymentStatus: status } : i
          ),
        }));
      },

      generateInvoiceNumber: () => generateInvoiceNumber(),
    }),
    {
      name: "invoice-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // v2: the sample entries older versions saved on the phone are removed; real ones stay.
      version: 2,
      migrate: (persisted: any) => {
        const sample = new Set(["inv1"]);
        if (persisted && Array.isArray(persisted.invoices)) {
          persisted.invoices = persisted.invoices.filter((x: any) => !sample.has(x?.id));
        }
        return persisted;
      },
    }
  )
);
