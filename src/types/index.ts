export interface Member {
  id: string;
  name: string;
  flatNumber: string;
  mobileNumber: string;
}

export interface Payment {
  id: string; // Unique ID for the payment, e.g., timestamp
  memberId: string;
  amount: number;
  date: string; // Stored as ISO string
  receiptNumber?: string;
  paymentMode: 'Cash' | 'Online';
  transactionId?: string;
}

export interface Expense {
    id: string;
    description: string;
    amount: number;
    date: string; // Stored as ISO string
}

export interface OtherIncome {
    id: string;
    description: string;
    amount: number;
    date: string; // Stored as ISO string
}
