
"use client";

import * as React from 'react';
import { useState, useEffect, useMemo, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, getYear, getMonth } from 'date-fns';
import { IndianRupee, Trash2, PlusCircle, ArrowUpCircle, ArrowDownCircle, AlertCircle } from 'lucide-react';

import { getPayments } from '@/services/firestore';
import { addExpense, getExpenses, deleteExpense, getOtherIncomes, addOtherIncome, deleteOtherIncome } from '@/services/firestore';
import type { Payment, Expense, OtherIncome } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useAuth } from '@/hooks/use-auth';

const formSchema = z.object({
  description: z.string().min(1, 'Description is required.'),
  amount: z.coerce.number().positive('Amount must be positive.'),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Please enter a valid date in YYYY-MM-DD format.",
  }),
});

const ALL_MONTHS = "all-months";
const ALL_YEARS = "all-years";

const OPENING_BALANCE = 63348.64;

export default function Dashboard() {
  const { toast } = useToast();
  const { isEditor } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [otherIncomes, setOtherIncomes] = useState<OtherIncome[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isIncomeDialogOpen, setIsIncomeDialogOpen] = useState(false);

  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [incomeToDelete, setIncomeToDelete] = useState<OtherIncome | null>(null);

  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: '',
      amount: '' as any,
      date: format(new Date(), 'yyyy-MM-dd'),
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [paymentsData, expensesData, otherIncomesData] = await Promise.all([
          getPayments(),
          getExpenses(),
          getOtherIncomes(),
        ]);
        setPayments(paymentsData);
        setExpenses(expensesData);
        setOtherIncomes(otherIncomesData);
      } catch (error) {
        console.error('Failed to load dashboard data', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not load dashboard data from the server.',
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [toast]);
  
  useEffect(() => {
    if (!isExpenseDialogOpen && !isIncomeDialogOpen) {
        form.reset({
            description: '',
            amount: '' as any,
            date: format(new Date(), 'yyyy-MM-dd'),
        });
    }
  }, [isExpenseDialogOpen, isIncomeDialogOpen, form])

  const filteredData = useMemo(() => {
    const isAllTime = selectedMonth === ALL_MONTHS && selectedYear === ALL_YEARS;
    
    const filterByDate = (items: (Payment | Expense | OtherIncome)[]) => {
        return items.filter(item => {
            if (isAllTime) return true;
            const itemDate = new Date(item.date);
            const monthMatch = selectedMonth === ALL_MONTHS || getMonth(itemDate).toString() === selectedMonth;
            const yearMatch = selectedYear === ALL_YEARS || getYear(itemDate).toString() === selectedYear;
            return monthMatch && yearMatch;
        });
    }

    return { 
        filteredPayments: filterByDate(payments) as Payment[], 
        filteredExpenses: filterByDate(expenses) as Expense[],
        filteredIncomes: filterByDate(otherIncomes) as OtherIncome[],
    };

  }, [payments, expenses, otherIncomes, selectedMonth, selectedYear]);

  const { totalCollected, totalExpenses, netBalance, openingBalance } = useMemo(() => {
    const memberCollections = filteredData.filteredPayments.reduce((sum, p) => sum + p.amount, 0);
    const otherIncomeTotal = filteredData.filteredIncomes.reduce((sum, i) => sum + i.amount, 0);
    const expensesTotal = filteredData.filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    const isAllTime = selectedMonth === ALL_MONTHS && selectedYear === ALL_YEARS;
    const currentOpeningBalance = isAllTime ? OPENING_BALANCE : 0;

    const totalCollected = memberCollections + otherIncomeTotal + currentOpeningBalance;
    const netBalance = totalCollected - expensesTotal;

    return { totalCollected, totalExpenses: expensesTotal, netBalance, openingBalance: currentOpeningBalance };
  }, [filteredData, selectedMonth, selectedYear]);
  
  const sortedExpenses = useMemo(() => {
    return [...filteredData.filteredExpenses].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredData.filteredExpenses]);

  const sortedIncomes = useMemo(() => {
    return [...filteredData.filteredIncomes].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredData.filteredIncomes]);

  const availableYears = useMemo(() => {
    const allDates = [
        ...payments.map(p => p.date), 
        ...expenses.map(e => e.date),
        ...otherIncomes.map(i => i.date),
    ];
    const years = new Set(allDates.map(d => getYear(new Date(d)).toString()));
    return Array.from(years).sort((a,b) => parseInt(b) - parseInt(a));
  }, [payments, expenses, otherIncomes]);


  const onExpenseSubmit = (values: z.infer<typeof formSchema>) => {
    if (!isEditor) return;
    startTransition(async () => {
      try {
        const expenseData = {
          ...values,
          date: new Date(values.date).toISOString(),
        };
        const newExpense = await addExpense(expenseData);
        setExpenses((prev) => [...prev, newExpense]);
        toast({
          title: 'Expense Recorded',
          description: 'The new expense has been successfully recorded.',
        });
      } catch (error) {
        console.error('Failed to save expense', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not save the expense. Please try again.',
        });
      } finally {
        setIsExpenseDialogOpen(false);
      }
    });
  };

  const onIncomeSubmit = (values: z.infer<typeof formSchema>) => {
    if (!isEditor) return;
    startTransition(async () => {
      try {
        const incomeData = {
          ...values,
          date: new Date(values.date).toISOString(),
        };
        const newIncome = await addOtherIncome(incomeData);
        setOtherIncomes((prev) => [...prev, newIncome]);
        toast({
          title: 'Income Recorded',
          description: 'The new income has been successfully recorded.',
        });
      } catch (error) {
        console.error('Failed to save income', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not save the income. Please try again.',
        });
      } finally {
        setIsIncomeDialogOpen(false);
      }
    });
  };

  const handleDeleteExpense = () => {
    if (!expenseToDelete || !isEditor) return;
    startTransition(async () => {
        try {
            await deleteExpense(expenseToDelete.id);
            setExpenses(prev => prev.filter(e => e.id !== expenseToDelete.id));
            toast({
                title: "Expense Deleted",
                description: "The expense record has been successfully deleted."
            });
        } catch (error) {
            console.error("Failed to delete expense", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Could not delete expense. Please try again."
            });
        } finally {
            setExpenseToDelete(null);
        }
    });
  };

  const handleDeleteIncome = () => {
    if (!incomeToDelete || !isEditor) return;
    startTransition(async () => {
        try {
            await deleteOtherIncome(incomeToDelete.id);
            setOtherIncomes(prev => prev.filter(i => i.id !== incomeToDelete.id));
            toast({
                title: "Income Deleted",
                description: "The income record has been successfully deleted."
            });
        } catch (error) {
            console.error("Failed to delete income", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Could not delete income. Please try again."
            });
        } finally {
            setIncomeToDelete(null);
        }
    });
  };


  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const renderForm = (type: 'income' | 'expense') => {
    const isIncome = type === 'income';
    const title = isIncome ? 'Record New Income' : 'Record New Expense';
    const description = isIncome ? 'Enter the details of the income.' : 'Enter the details of the expense.';
    const placeholder = isIncome ? 'e.g. Bank Interest' : 'e.g. Security guard salary';
    const onSubmit = isIncome ? onIncomeSubmit : onExpenseSubmit;
    const setIsOpen = isIncome ? setIsIncomeDialogOpen : setIsExpenseDialogOpen;

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <FormField control={form.control} name="description" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                                <Input placeholder={placeholder} {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="amount" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Amount (₹)</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. 1000" type="number" step="0.01" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="date" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Date</FormLabel>
                            <FormControl>
                                <Input placeholder="YYYY-MM-DD" type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} disabled={isPending}>Cancel</Button>
                    <Button type="submit" disabled={isPending || !isEditor}>Save {isIncome ? 'Income' : 'Expense'}</Button>
                </DialogFooter>
            </form>
        </Form>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <h2 className="text-xl font-semibold text-foreground">
          Financial Overview
        </h2>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Collected
            </CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-3/4" /> : <div className="text-2xl font-bold">{formatCurrency(totalCollected)}</div>}
            {openingBalance > 0 && (
                 <p className="text-xs text-muted-foreground">
                    (Including Opening Balance)
                </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Expenses
            </CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-3/4" /> : <div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-3/4" /> : <div className="text-2xl font-bold">{formatCurrency(netBalance)}</div>}
          </CardContent>
        </Card>
      </div>

      <div className='grid gap-6 md:grid-cols-2'>
        <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
                <CardTitle>Other Income</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Track all other sources of income.
                </p>
            </div>
            {isEditor && (
                <Dialog open={isIncomeDialogOpen} onOpenChange={setIsIncomeDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="print-hide w-full sm:w-auto">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Record Income
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        {renderForm('income')}
                    </DialogContent>
                </Dialog>
            )}
            </CardHeader>
            <CardContent>
            <div className="rounded-md border table-print overflow-x-auto">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right print-hide">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-5 w-32 sm:w-48" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded-full" /></TableCell>
                            </TableRow>
                        ))
                    ) : sortedIncomes.length > 0 ? (
                    sortedIncomes.map((income) => (
                        <TableRow key={income.id}>
                        <TableCell className="font-medium min-w-[150px]">{income.description}</TableCell>
                        <TableCell>{formatCurrency(income.amount)}</TableCell>
                        <TableCell>{format(new Date(income.date), 'PPP')}</TableCell>
                        <TableCell className="text-right print-hide">
                            {isEditor && (
                                <AlertDialog open={incomeToDelete?.id === income.id} onOpenChange={(open) => !open && setIncomeToDelete(null)}>
                                    <Button variant="ghost" size="icon" onClick={() => setIncomeToDelete(income)} disabled={isPending}>
                                        <Trash2 className="h-4 w-4" />
                                        <span className="sr-only">Delete</span>
                                    </Button>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete the income: "{income.description}".
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel onClick={() => setIncomeToDelete(null)}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteIncome}>Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </TableCell>
                        </TableRow>
                    ))
                    ) : (
                    <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                        <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                        No income recorded for the selected period.
                        </TableCell>
                    </TableRow>
                    )}
                </TableBody>
                </Table>
            </div>
            </CardContent>
        </Card>
      
        <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
                <CardTitle>Expense History</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Track all society expenditures.
                </p>
            </div>
            {isEditor && (
                <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="print-hide w-full sm:w-auto">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Record Expense
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        {renderForm('expense')}
                    </DialogContent>
                </Dialog>
            )}
            </CardHeader>
            <CardContent>
            <div className="rounded-md border table-print overflow-x-auto">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right print-hide">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-5 w-32 sm:w-48" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded-full" /></TableCell>
                            </TableRow>
                        ))
                    ) : sortedExpenses.length > 0 ? (
                    sortedExpenses.map((expense) => (
                        <TableRow key={expense.id}>
                        <TableCell className="font-medium min-w-[150px]">{expense.description}</TableCell>
                        <TableCell>{formatCurrency(expense.amount)}</TableCell>
                        <TableCell>{format(new Date(expense.date), 'PPP')}</TableCell>
                        <TableCell className="text-right print-hide">
                            {isEditor && (
                                <AlertDialog open={expenseToDelete?.id === expense.id} onOpenChange={(open) => !open && setExpenseToDelete(null)}>
                                    <Button variant="ghost" size="icon" onClick={() => setExpenseToDelete(expense)} disabled={isPending}>
                                        <Trash2 className="h-4 w-4" />
                                        <span className="sr-only">Delete</span>
                                    </Button>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete the expense: "{expense.description}".
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel onClick={() => setExpenseToDelete(null)}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteExpense}>Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </TableCell>
                        </TableRow>
                    ))
                    ) : (
                    <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                        <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                        No expenses recorded for the selected period.
                        </TableCell>
                    </TableRow>
                    )}
                </TableBody>
                </Table>
            </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
