
"use client";

import * as React from 'react';
import { useState, useEffect, useMemo, useTransition } from 'react';
import { getMonth, getYear, format } from 'date-fns';
import { ArrowUpDown, Trash2, Search, MoreHorizontal, ReceiptText } from 'lucide-react';
import Link from 'next/link';

import type { Member, Payment } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { deletePayment, getMembers, getPayments } from '@/services/firestore';
import { useAuth } from '@/hooks/use-auth';

type PaymentWithMember = Payment & { member: Member | undefined };
type SortKey = keyof PaymentWithMember | 'member.name' | 'member.flatNumber';

const ALL_MONTHS = "all-months";
const ALL_YEARS = "all-years";

export default function PaymentHistory() {
  const { toast } = useToast();
  const { isEditor } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(ALL_MONTHS);
  const [selectedYear, setSelectedYear] = useState<string>(ALL_YEARS);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [membersData, paymentsData] = await Promise.all([getMembers(), getPayments()]);
                setMembers(membersData);
                setPayments(paymentsData);
            } catch (error) {
                console.error("Failed to load data from Firestore", error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Could not load data from the server."
                });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [toast]);


  const handleDeletePayment = () => {
    if (!paymentToDelete || !isEditor) return;
    startTransition(async () => {
        try {
            await deletePayment(paymentToDelete.id);
            setPayments(updatedPayments => updatedPayments.filter(p => p.id !== paymentToDelete.id));
            toast({
              title: 'Payment Deleted',
              description: 'The payment record has been successfully deleted.',
            });
        } catch (error) {
            console.error("Failed to delete payment", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Could not delete payment. Please try again."
            });
        } finally {
            setPaymentToDelete(null);
        }
    });
  };

  const paymentsWithMemberData: PaymentWithMember[] = useMemo(() => {
    return payments.map(payment => ({
      ...payment,
      member: members.find(m => m.id === payment.memberId),
    }));
  }, [payments, members]);

  const requestSort = (key: SortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIndicator = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return sortConfig.direction === 'ascending' ? '▲' : '▼';
  };
  
  const availableYears = useMemo(() => {
    const years = new Set(payments.map(p => getYear(new Date(p.date)).toString()));
    return Array.from(years).sort((a,b) => parseInt(b) - parseInt(a));
  }, [payments]);

  const sortedAndFilteredPayments = useMemo(() => {
    let sortableItems = [...paymentsWithMemberData];

    if (searchTerm) {
        sortableItems = sortableItems.filter(item => {
            const memberName = item.member?.name.toLowerCase() || '';
            const flatNumber = item.member?.flatNumber.toLowerCase() || '';
            const amount = item.amount.toString();
            return memberName.includes(searchTerm.toLowerCase()) || flatNumber.includes(searchTerm.toLowerCase()) || amount.includes(searchTerm);
        });
    }

    if (selectedMonth !== ALL_MONTHS) {
        sortableItems = sortableItems.filter(item => getMonth(new Date(item.date)) === parseInt(selectedMonth));
    }

    if (selectedYear !== ALL_YEARS) {
        sortableItems = sortableItems.filter(item => getYear(new Date(item.date)) === parseInt(selectedYear));
    }

    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const getNestedValue = (obj: any, path: string) => path.split('.').reduce((o, k) => (o || {})[k], obj);

        const aValue = sortConfig.key.includes('.') ? getNestedValue(a, sortConfig.key) : a[sortConfig.key as keyof PaymentWithMember];
        const bValue = sortConfig.key.includes('.') ? getNestedValue(b, sortConfig.key) : b[sortConfig.key as keyof PaymentWithMember];
        
        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    } else {
        sortableItems.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return sortableItems;
  }, [paymentsWithMemberData, searchTerm, sortConfig, selectedMonth, selectedYear]);

  return (
    <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                placeholder="Search by name, flat, or amount..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                />
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Select Month" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL_MONTHS}>All Months</SelectItem>
                        {Array.from({length: 12}, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>{format(new Date(0, i), 'MMMM')}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-full sm:w-[120px]">
                        <SelectValue placeholder="Select Year" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL_YEARS}>All Years</SelectItem>
                        {availableYears.map(year => (
                            <SelectItem key={year} value={year}>{year}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead onClick={() => requestSort('member.name')}>
                <div className="flex items-center cursor-pointer">
                    Member Name {getSortIndicator('member.name')}
                </div>
              </TableHead>
              <TableHead onClick={() => requestSort('member.flatNumber')}>
                <div className="flex items-center cursor-pointer">
                    Flat No. {getSortIndicator('member.flatNumber')}
                </div>
              </TableHead>
              <TableHead onClick={() => requestSort('amount')}>
                <div className="flex items-center cursor-pointer">
                    Amount Paid {getSortIndicator('amount')}
                </div>
              </TableHead>
              <TableHead onClick={() => requestSort('date')}>
                <div className="flex items-center cursor-pointer">
                    Payment Date {getSortIndicator('date')}
                </div>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                ))
            ) : sortedAndFilteredPayments.length > 0 ? (
              sortedAndFilteredPayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium min-w-[150px]">{payment.member?.name || 'N/A'}</TableCell>
                  <TableCell>{payment.member?.flatNumber || 'N/A'}</TableCell>
                  <TableCell>₹{payment.amount.toFixed(2)}</TableCell>
                  <TableCell>{format(new Date(payment.date), 'PPP')}</TableCell>
                  <TableCell className="text-right">
                    <AlertDialog open={paymentToDelete?.id === payment.id} onOpenChange={(open) => !open && setPaymentToDelete(null)}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0" disabled={isPending}>
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/receipt/${payment.id}`}>
                                    <ReceiptText className="mr-2 h-4 w-4" />
                                    <span>Generate Receipt</span>
                                  </Link>
                                </DropdownMenuItem>
                                {isEditor && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setPaymentToDelete(payment); }} className="text-red-600" disabled={isPending}>
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            <span>Delete</span>
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the payment
                                record for {payment.member?.name} on {format(new Date(payment.date), 'PPP')}.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setPaymentToDelete(null)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeletePayment}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No payment records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
