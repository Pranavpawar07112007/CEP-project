'use client';

import * as React from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, FileBarChart, Loader2, Trash2, Download, TrendingUp } from 'lucide-react';
import { createExpense, deleteExpense } from '@/app/actions/modules';
import jsPDF from 'jspdf';

type Expense = {
  id: string;
  description: string;
  amount: number;
  expense_date: string;
  category: string;
  created_at: string;
};

const CATEGORIES = ['GENERAL', 'MAINTENANCE', 'EVENT', 'SALARY', 'UTILITY', 'OTHER'];
const CATEGORY_COLORS: Record<string, string> = {
  GENERAL: 'text-blue-600 bg-blue-500/10 border-blue-500/20',
  MAINTENANCE: 'text-orange-600 bg-orange-500/10 border-orange-500/20',
  EVENT: 'text-purple-600 bg-purple-500/10 border-purple-500/20',
  SALARY: 'text-green-600 bg-green-500/10 border-green-500/20',
  UTILITY: 'text-yellow-600 bg-yellow-500/10 border-yellow-500/20',
  OTHER: 'text-gray-600 bg-gray-500/10 border-gray-500/20',
};

export default function ReportsPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const supabase = createClient();
  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [fetching, setFetching] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [filterYear, setFilterYear] = React.useState(new Date().getFullYear().toString());
  const [filterMonth, setFilterMonth] = React.useState('ALL');
  const [form, setForm] = React.useState({ description: '', amount: '', expense_date: '', category: 'GENERAL' });

  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'SECRETARY';

  const fetchExpenses = React.useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('society_id', profile.society_id)
      .order('expense_date', { ascending: false });
    setExpenses(data || []);
    setFetching(false);
  }, [supabase, profile]);

  React.useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const handleAdd = () => {
    startTransition(async () => {
      const result = await createExpense({
        society_id: profile?.society_id!,
        description: form.description,
        amount: parseFloat(form.amount),
        expense_date: form.expense_date,
        category: form.category,
      });
      if (result.error) {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      } else {
        toast({ title: '✅ Expense Recorded' });
        setForm({ description: '', amount: '', expense_date: '', category: 'GENERAL' });
        setShowForm(false);
        fetchExpenses();
      }
    });
  };

  const handleDelete = async (id: string) => {
    await deleteExpense(id);
    toast({ title: 'Expense removed.' });
    fetchExpenses();
  };

  const filteredExpenses = expenses.filter(e => {
    const isYearMatch = e.expense_date.startsWith(filterYear);
    if (filterMonth === 'ALL') return isYearMatch;
    return isYearMatch && e.expense_date.split('-')[1] === filterMonth;
  });
  const totalExpense = filteredExpenses.reduce((acc, e) => acc + Number(e.amount), 0);

  // Group by category
  const byCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = filteredExpenses.filter(e => e.category === cat).reduce((a, e) => a + Number(e.amount), 0);
    return acc;
  }, {} as Record<string, number>);

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(99, 102, 241);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    const periodName = filterMonth === 'ALL' ? filterYear : `${filterMonth}/${filterYear}`;
    doc.text(`Expense Report - ${periodName}`, pageWidth / 2, 18, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Society Management System', pageWidth / 2, 30, { align: 'center' });

    doc.setTextColor(30, 30, 30);
    let y = 55;

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Expense Summary by Category', 20, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    CATEGORIES.forEach(cat => {
      const amt = byCategory[cat];
      if (amt > 0) {
        doc.text(`${cat}:`, 25, y);
        doc.text(`₹${amt.toLocaleString('en-IN')}`, 100, y);
        y += 7;
      }
    });

    y += 5;
    doc.setDrawColor(200);
    doc.line(20, y, pageWidth - 20, y);
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL EXPENSES:', 25, y);
    doc.text(`₹${totalExpense.toLocaleString('en-IN')}`, 100, y);

    y += 15;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Detailed Expense Log', 20, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    filteredExpenses.forEach(e => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(e.expense_date, 20, y);
      doc.text(e.description.substring(0, 40), 48, y);
      doc.text(e.category, 140, y);
      doc.text(`₹${Number(e.amount).toLocaleString('en-IN')}`, 175, y);
      y += 6;
    });

    doc.save(`annual_report_${filterYear}.pdf`);
  };

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Annual Report</h1>
          <p className="text-muted-foreground mt-1">Track society expenses and generate financial reports.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-24 bg-background/50"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-28 bg-background/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Year</SelectItem>
              <SelectItem value="01">Jan</SelectItem>
              <SelectItem value="02">Feb</SelectItem>
              <SelectItem value="03">Mar</SelectItem>
              <SelectItem value="04">Apr</SelectItem>
              <SelectItem value="05">May</SelectItem>
              <SelectItem value="06">Jun</SelectItem>
              <SelectItem value="07">Jul</SelectItem>
              <SelectItem value="08">Aug</SelectItem>
              <SelectItem value="09">Sep</SelectItem>
              <SelectItem value="10">Oct</SelectItem>
              <SelectItem value="11">Nov</SelectItem>
              <SelectItem value="12">Dec</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleDownloadPDF} className="gap-2">
            <Download className="h-4 w-4" /> PDF Report
          </Button>
          {isAdmin && (
            <Button onClick={() => setShowForm(!showForm)} className="gap-2">
              <PlusCircle className="h-4 w-4" />
              {showForm ? 'Cancel' : 'Add Expense'}
            </Button>
          )}
        </div>
      </div>

      {showForm && isAdmin && (
        <Card className="bg-card/80 backdrop-blur border-primary/30 animate-fade-in">
          <CardHeader><CardTitle>Record Expense</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Lift AMC Contract" className="bg-background/50" />
              </div>
              <div className="space-y-2">
                <Label>Amount (₹)</Label>
                <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="5000" className="bg-background/50" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} className="bg-background/50" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleAdd} disabled={!form.description || !form.amount || !form.expense_date || isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Expense
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {CATEGORIES.map(cat => (
          <Card key={cat} className="bg-card/80 backdrop-blur border-border/50">
            <CardContent className="pt-4 pb-4">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border block w-fit mb-2 ${CATEGORY_COLORS[cat]}`}>{cat}</span>
              <p className="text-lg font-bold">₹{byCategory[cat].toLocaleString('en-IN')}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card/80 backdrop-blur border-primary/20">
        <CardContent className="pt-5 flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Expenses in {filterMonth === 'ALL' ? filterYear : `${filterMonth}/${filterYear}`}</p>
            <p className="text-3xl font-bold">₹{totalExpense.toLocaleString('en-IN')}</p>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      {fetching && <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}
      {!fetching && filteredExpenses.length === 0 && (
        <Card className="bg-card/80 backdrop-blur border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-muted-foreground">
            <FileBarChart className="h-12 w-12 mb-3 opacity-20" />
            <p className="font-medium">No expenses recorded for {filterMonth === 'ALL' ? filterYear : `${filterMonth}/${filterYear}`}</p>
          </CardContent>
        </Card>
      )}
      <div className="space-y-2">
        {filteredExpenses.map(e => (
          <Card key={e.id} className="bg-card/80 backdrop-blur border-border/50 hover:border-primary/20 transition-colors group">
            <CardContent className="py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${CATEGORY_COLORS[e.category]}`}>{e.category}</span>
                  <span className="text-sm font-medium flex-1">{e.description}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{new Date(e.expense_date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-primary">₹{Number(e.amount).toLocaleString('en-IN')}</span>
                  {isAdmin && (
                    <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(e.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
