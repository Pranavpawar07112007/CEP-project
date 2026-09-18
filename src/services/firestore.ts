'use server';
import { db } from '@/lib/firebase';
import { Member, Payment, Expense, OtherIncome } from '@/types';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, writeBatch, getDoc } from 'firebase/firestore';

export async function getMembers(): Promise<Member[]> {
    const membersCol = collection(db, 'members');
    const memberSnapshot = await getDocs(membersCol);
    const memberList = memberSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
    return memberList;
}

export async function getPayments(): Promise<Payment[]> {
    const paymentsCol = collection(db, 'payments');
    const paymentSnapshot = await getDocs(paymentsCol);
    const paymentList = paymentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
    return paymentList;
}

export async function getPaymentById(id: string): Promise<Payment | null> {
    const paymentDoc = doc(db, 'payments', id);
    const paymentSnapshot = await getDoc(paymentDoc);
    if (paymentSnapshot.exists()) {
        return { id: paymentSnapshot.id, ...paymentSnapshot.data() } as Payment;
    }
    return null;
}

export async function getMemberById(id: string): Promise<Member | null> {
    const memberDoc = doc(db, 'members', id);
    const memberSnapshot = await getDoc(memberDoc);
    if (memberSnapshot.exists()) {
        return { id: memberSnapshot.id, ...memberSnapshot.data() } as Member;
    }
    return null;
}

export async function addMember(member: Omit<Member, 'id'>): Promise<Member> {
    const docRef = await addDoc(collection(db, 'members'), member);
    return { id: docRef.id, ...member };
}

export async function updateMember(id: string, member: Partial<Member>): Promise<void> {
    const memberDoc = doc(db, 'members', id);
    await updateDoc(memberDoc, member);
}

export async function deleteMember(id: string): Promise<void> {
    const batch = writeBatch(db);

    const memberDoc = doc(db, 'members', id);
    batch.delete(memberDoc);

    const paymentsQuery = query(collection(db, 'payments'), where('memberId', '==', id));
    const paymentsSnapshot = await getDocs(paymentsQuery);
    paymentsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
    });
    
    await batch.commit();
}


export async function addPayment(payment: Omit<Payment, 'id'>): Promise<Payment> {
    const docRef = await addDoc(collection(db, 'payments'), payment);
    return { id: docRef.id, ...payment };
}

export async function updatePayment(id: string, payment: Partial<Payment>): Promise<void> {
    const paymentDoc = doc(db, 'payments', id);
    await updateDoc(paymentDoc, payment);
}

export async function deletePayment(id: string): Promise<void> {
    const paymentDoc = doc(db, 'payments', id);
    await deleteDoc(paymentDoc);
}

export async function getExpenses(): Promise<Expense[]> {
    const expensesCol = collection(db, 'expenses');
    const expenseSnapshot = await getDocs(expensesCol);
    const expenseList = expenseSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
    return expenseList;
}

export async function addExpense(expense: Omit<Expense, 'id'>): Promise<Expense> {
    const docRef = await addDoc(collection(db, 'expenses'), expense);
    return { id: docRef.id, ...expense };
}

export async function deleteExpense(id: string): Promise<void> {
    const expenseDoc = doc(db, 'expenses', id);
    await deleteDoc(expenseDoc);
}

export async function getOtherIncomes(): Promise<OtherIncome[]> {
    const incomesCol = collection(db, 'otherIncomes');
    const incomeSnapshot = await getDocs(incomesCol);
    const incomeList = incomeSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OtherIncome));
    return incomeList;
}

export async function addOtherIncome(income: Omit<OtherIncome, 'id'>): Promise<OtherIncome> {
    const docRef = await addDoc(collection(db, 'otherIncomes'), income);
    return { id: docRef.id, ...income };
}

export async function deleteOtherIncome(id: string): Promise<void> {
    const incomeDoc = doc(db, 'otherIncomes', id);
    await deleteDoc(incomeDoc);
}


export async function getPaymentsForYear(year: number): Promise<Payment[]> {
    const paymentsCol = collection(db, 'payments');
    const paymentSnapshot = await getDocs(paymentsCol);
    const paymentList = paymentSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Payment))
        .filter(p => p.date && new Date(p.date).getFullYear() === year);
    return paymentList;
}
