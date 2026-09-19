'use client';

import * as React from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  PlusCircle, CreditCard, CheckCircle2, Clock, Loader2, IndianRupee,
  HandCoins, MessageSquare, Share2, History, FileText, Pencil, X, Check,
  ChevronDown, ChevronRight, Users, ClipboardList
} from 'lucide-react';
import { createRazorpayOrder, verifyAndRecordPayment } from '@/app/actions/payments';
import { createMaintenanceBills, markBillAsPaidManually, updateBillAmount, generateReceiptToken } from '@/app/actions/modules';
import jsPDF from 'jspdf';

type Bill = {
  id: string;
  month: string;
  amount: number;
  status: string;
  due_date: string;
  paid_at: string | null;
  payment_mode: string | null;
  receipt_token: string | null;
  user_id: string;
  profiles?: { first_name: string; last_name: string; flat_number: string; phone: string | null };
};

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  flat_number: string;
  phone: string | null;
};

type MonthSummary = {
  month: string;
  totalPaid: number;
  totalPending: number;
  paidCount: number;
  pendingCount: number;
  bills: Bill[];
};

declare global {
  interface Window { Razorpay: any; }
}

type Tab = 'overview' | 'generate' | 'history';

export default function MaintenancePage() {
  const { profile, user, society } = useAuth();
  const { toast } = useToast();
  const supabase = createClient();
  
  const [activeTab, setActiveTab] = React.useState<Tab>('overview');
  const [bills, setBills] = React.useState<Bill[]>([]);
  const [fetching, setFetching] = React.useState(true);
  const [payingBillId, setPayingBillId] = React.useState<string | null>(null);
  const [editingBillId, setEditingBillId] = React.useState<string | null>(null);
  const [editAmount, setEditAmount] = React.useState('');
  const [expandedMonth, setExpandedMonth] = React.useState<string | null>(null);
  
  // Filter state for overview
  const [filterMonth, setFilterMonth] = React.useState('');

  // Billing Generation State
  const [members, setMembers] = React.useState<Member[]>([]);
  const [newBillMonth, setNewBillMonth] = React.useState('');
  const [newBillDueDate, setNewBillDueDate] = React.useState('');
  const [defaultAmount, setDefaultAmount] = React.useState('');
  const [billAmounts, setBillAmounts] = React.useState<Record<string, string>>({});
  
  const [isPending, startTransition] = React.useTransition();

  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'SECRETARY';

  const fetchBills = React.useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    let query = supabase.from('maintenance_bills').select(`
      *,
      profiles:user_id (first_name, last_name, flat_number, phone)
    `);
    
    if (isAdmin) {
      query = query.eq('society_id', profile.society_id);
    } else {
      query = query.eq('user_id', profile.id);
    }
    
    const { data } = await query.order('created_at', { ascending: false });
    setBills(data || []);
    setFetching(false);
  }, [supabase, profile, isAdmin]);

  React.useEffect(() => { fetchBills(); }, [fetchBills]);

  // Load Razorpay script
  React.useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  // Fetch active members for bill generation
  const fetchMembers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, flat_number, phone')
      .eq('society_id', profile?.society_id)
      .eq('status', 'ACTIVE')
      .order('flat_number');
      
    if (data) {
      setMembers(data);
      const initialAmounts: Record<string, string> = {};
      data.forEach(m => initialAmounts[m.id] = '');
      setBillAmounts(initialAmounts);
    }
  };

  React.useEffect(() => {
    if (isAdmin && activeTab === 'generate') {
      fetchMembers();
    }
  }, [activeTab, isAdmin]);

  const applyDefaultAmount = () => {
    if (!defaultAmount) return;
    const newAmounts: Record<string, string> = {};
    members.forEach(m => newAmounts[m.id] = defaultAmount);
    setBillAmounts(newAmounts);
  };

  const handleGenerateBills = () => {
    startTransition(async () => {
      if (!newBillMonth) {
        toast({ variant: 'destructive', title: 'Month is required' });
        return;
      }
      
      const billsToInsert = members
        .filter(m => parseFloat(billAmounts[m.id]) > 0)
        .map(m => ({
          society_id: profile?.society_id!,
          user_id: m.id,
          month: newBillMonth,
          amount: parseFloat(billAmounts[m.id]),
          due_date: newBillDueDate || null,
          status: 'PENDING',
        }));

      if (billsToInsert.length === 0) {
        toast({ variant: 'destructive', title: 'No valid amounts entered.' });
        return;
      }

      const result = await createMaintenanceBills(billsToInsert);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      } else {
        toast({ title: '✅ Bills Generated', description: `${billsToInsert.length} bills created.` });
        setNewBillMonth('');
        setNewBillDueDate('');
        setDefaultAmount('');
        fetchBills();
        setActiveTab('overview');
      }
    });
  };

  const handleManualMarkPaid = (billId: string) => {
    startTransition(async () => {
      setPayingBillId(billId);
      const result = await markBillAsPaidManually(billId);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      } else {
        toast({ title: '✅ Bill marked as PAID (Cash)' });
        fetchBills();
      }
      setPayingBillId(null);
    });
  };

  const handleEditAmount = (bill: Bill) => {
    setEditingBillId(bill.id);
    setEditAmount(String(bill.amount));
  };

  const handleSaveAmount = (billId: string) => {
    startTransition(async () => {
      const amount = parseFloat(editAmount);
      if (!amount || amount <= 0) {
        toast({ variant: 'destructive', title: 'Enter a valid amount.' });
        return;
      }
      const result = await updateBillAmount(billId, amount);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      } else {
        toast({ title: '✅ Amount Updated' });
        setEditingBillId(null);
        fetchBills();
      }
    });
  };

  const handlePayment = async (bill: Bill) => {
    setPayingBillId(bill.id);
    const result = await createRazorpayOrder(bill.id, bill.amount);
    if (result.error || !result.orderId) {
      toast({ variant: 'destructive', title: 'Could not initiate payment', description: result.error });
      setPayingBillId(null);
      return;
    }

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: result.amount,
      currency: 'INR',
      name: society?.name || 'Society Maintenance',
      description: `Maintenance for ${bill.month}`,
      order_id: result.orderId,
      prefill: { email: user?.email, contact: profile?.phone },
      theme: { color: '#6366f1' },
      handler: async (response: any) => {
        const verify = await verifyAndRecordPayment({
          billId: bill.id,
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
          amount: bill.amount,
          paymentMode: 'RAZORPAY',
        });

        if (verify.error) {
          toast({ variant: 'destructive', title: 'Payment Verification Failed', description: verify.error });
        } else {
          toast({ title: '🎉 Payment Successful!', description: 'Your receipt has been generated.' });
          generateReceiptPDF(bill, response.razorpay_payment_id);
          fetchBills();
        }
        setPayingBillId(null);
      },
      modal: {
        ondismiss: () => setPayingBillId(null),
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  const generateReceiptPDF = (bill: Bill, paymentId: string) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(99, 102, 241);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('MAINTENANCE PAYMENT RECEIPT', pageWidth / 2, 18, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(society?.name || 'Society Management System', pageWidth / 2, 30, { align: 'center' });

    doc.setTextColor(30, 30, 30);
    const lineY = 60;
    const addRow = (label: string, value: string, y: number) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(label, 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 100, y);
    };

    addRow('Bill ID:', bill.id.slice(0, 20) + '...', lineY);
    addRow('Payment ID:', paymentId || 'MANUAL/CASH', lineY + 10);
    const fname = bill.profiles?.first_name || profile?.first_name || '';
    const lname = bill.profiles?.last_name || profile?.last_name || '';
    const flat = bill.profiles?.flat_number || profile?.flat_number || 'N/A';
    
    addRow('Member:', `${fname} ${lname}`, lineY + 20);
    addRow('Flat No.:', flat, lineY + 30);
    addRow('Society:', society?.name || 'N/A', lineY + 40);
    addRow('Month:', bill.month, lineY + 50);
    addRow('Amount Paid:', `Rs.${Number(bill.amount).toLocaleString('en-IN')}`, lineY + 60);
    addRow('Payment Date:', new Date().toLocaleDateString('en-IN', { dateStyle: 'long' }), lineY + 70);
    addRow('Status:', 'PAID', lineY + 80);

    doc.setDrawColor(200, 200, 200);
    doc.line(20, lineY + 92, pageWidth - 20, lineY + 92);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('This is a computer-generated receipt. No signature required.', pageWidth / 2, lineY + 105, { align: 'center' });

    doc.save(`receipt_${bill.month}_${flat}.pdf`);
  };

  const handleShareWhatsApp = async (bill: Bill) => {
    // Get or generate receipt token
    const result = await generateReceiptToken(bill.id);
    const phone = bill.profiles?.phone || '';
    
    const receiptUrl = result.token
      ? `${window.location.origin}/receipt/${result.token}`
      : '';
    
    const message = encodeURIComponent(
      `*Maintenance Receipt*\n` +
      `Society: ${society?.name}\n` +
      `Month: ${bill.month}\n` +
      `Amount: ₹${Number(bill.amount).toLocaleString('en-IN')}\n` +
      `Status: PAID ✅\n` +
      `Flat: ${bill.profiles?.flat_number || 'N/A'}\n` +
      (receiptUrl ? `\nView Receipt: ${receiptUrl}` : '')
    );

    const whatsappUrl = phone
      ? `https://wa.me/91${phone.replace(/\D/g, '')}?text=${message}`
      : `https://wa.me/?text=${message}`;

    window.open(whatsappUrl, '_blank');
  };

  const handleCopyReceiptLink = async (bill: Bill) => {
    const result = await generateReceiptToken(bill.id);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
      return;
    }
    const link = `${window.location.origin}/receipt/${result.token}`;
    await navigator.clipboard.writeText(link);
    toast({ title: '🔗 Link Copied!', description: 'Share this link to view the receipt without logging in.' });
  };

  // Compute month summaries for history
  const monthSummaries = React.useMemo((): MonthSummary[] => {
    const monthMap: Record<string, MonthSummary> = {};
    bills.forEach(bill => {
      if (!monthMap[bill.month]) {
        monthMap[bill.month] = { month: bill.month, totalPaid: 0, totalPending: 0, paidCount: 0, pendingCount: 0, bills: [] };
      }
      if (bill.status === 'PAID') {
        monthMap[bill.month].totalPaid += Number(bill.amount);
        monthMap[bill.month].paidCount++;
      } else {
        monthMap[bill.month].totalPending += Number(bill.amount);
        monthMap[bill.month].pendingCount++;
      }
      monthMap[bill.month].bills.push(bill);
    });
    return Object.values(monthMap).sort((a, b) => b.month.localeCompare(a.month));
  }, [bills]);

  // Current month bills for overview
  const currentMonth = filterMonth || (monthSummaries[0]?.month || '');
  const currentMonthBills = bills.filter(b => b.month === currentMonth);
  const pendingBills = currentMonthBills.filter(b => b.status === 'PENDING');
  const paidBills = currentMonthBills.filter(b => b.status === 'PAID');
  const allPendingCount = bills.filter(b => b.status === 'PENDING').length;
  const allPaidCount = bills.filter(b => b.status === 'PAID').length;

  const tabs: { id: Tab; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'overview', label: 'Bills Overview', icon: ClipboardList },
    ...(isAdmin ? [{ id: 'generate' as Tab, label: 'Generate Bills', icon: PlusCircle }] : []),
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Maintenance</h1>
        <p className="text-muted-foreground mt-1">Manage society fees, track payments, and share receipts.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Pending', value: bills.filter(b => b.status === 'PENDING').reduce((a, b) => a + Number(b.amount), 0), count: allPendingCount, color: 'yellow', icon: Clock },
          { label: 'Total Collected', value: bills.filter(b => b.status === 'PAID').reduce((a, b) => a + Number(b.amount), 0), count: allPaidCount, color: 'green', icon: CheckCircle2 },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className={`col-span-1 md:col-span-2 bg-card/80 backdrop-blur border-${stat.color}-500/20`}>
              <CardContent className="pt-5 flex items-center gap-4">
                <div className={`p-2.5 bg-${stat.color}-500/10 rounded-full`}>
                  <Icon className={`h-5 w-5 text-${stat.color}-500`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">₹{stat.value.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-muted-foreground">{stat.count} {stat.label.toLowerCase()}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB: Bills Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Month Filter */}
          {isAdmin && monthSummaries.length > 0 && (
            <div className="flex items-center gap-3">
              <Label className="text-sm shrink-0">View Month:</Label>
              <select
                value={filterMonth || currentMonth}
                onChange={e => setFilterMonth(e.target.value)}
                className="bg-background border border-input rounded-md px-3 py-1.5 text-sm"
              >
                {monthSummaries.map(s => (
                  <option key={s.month} value={s.month}>{s.month}</option>
                ))}
              </select>
              <Badge variant="outline" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                {currentMonthBills.length} members
              </Badge>
            </div>
          )}

          {fetching && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {!fetching && bills.length === 0 && (
            <Card className="bg-card/80 backdrop-blur border-dashed">
              <CardContent className="flex flex-col items-center py-16 text-muted-foreground">
                <IndianRupee className="h-12 w-12 mb-3 opacity-20" />
                <p className="font-medium">No bills yet</p>
                <p className="text-sm">Bills will appear here once generated.</p>
                {isAdmin && (
                  <Button className="mt-4 gap-2" onClick={() => setActiveTab('generate')}>
                    <PlusCircle className="h-4 w-4" /> Generate First Bill
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Unpaid / Pending Section */}
          {pendingBills.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-yellow-600 dark:text-yellow-400 flex items-center gap-2 uppercase tracking-wider">
                <Clock className="h-4 w-4" /> Pending ({pendingBills.length})
              </h2>
              {pendingBills.map(bill => (
                <BillCard
                  key={bill.id}
                  bill={bill}
                  isAdmin={isAdmin}
                  currentUserId={profile?.id}
                  editingBillId={editingBillId}
                  editAmount={editAmount}
                  onEditAmount={() => handleEditAmount(bill)}
                  onSaveAmount={() => handleSaveAmount(bill.id)}
                  onCancelEdit={() => setEditingBillId(null)}
                  onEditAmountChange={setEditAmount}
                  onPay={() => handlePayment(bill)}
                  onManualPay={() => handleManualMarkPaid(bill.id)}
                  isPaying={payingBillId === bill.id}
                  isPending={isPending}
                />
              ))}
            </div>
          )}

          {/* Paid Section */}
          {paidBills.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-green-600 dark:text-green-400 flex items-center gap-2 uppercase tracking-wider">
                <CheckCircle2 className="h-4 w-4" /> Paid ({paidBills.length})
              </h2>
              {paidBills.map(bill => (
                <BillCard
                  key={bill.id}
                  bill={bill}
                  isAdmin={isAdmin}
                  currentUserId={profile?.id}
                  isPaid
                  onShareWhatsApp={() => handleShareWhatsApp(bill)}
                  onCopyLink={() => handleCopyReceiptLink(bill)}
                  onDownloadPDF={() => generateReceiptPDF(bill, 'MANUAL/CASH')}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: Generate Bills */}
      {activeTab === 'generate' && isAdmin && (
        <Card className="bg-card/80 backdrop-blur border-primary/30">
          <CardHeader>
            <CardTitle>Generate Monthly Bills</CardTitle>
            <CardDescription>Assign specific or default maintenance fees to active members.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b">
              <div className="space-y-2">
                <Label>Bill Month (YYYY-MM) *</Label>
                <Input type="month" value={newBillMonth} onChange={e => setNewBillMonth(e.target.value)} className="bg-background/50" />
              </div>
              <div className="space-y-2">
                <Label>Global Due Date</Label>
                <Input type="date" value={newBillDueDate} onChange={e => setNewBillDueDate(e.target.value)} className="bg-background/50" />
              </div>
              <div className="space-y-2">
                <Label>Set Default Amount for All</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <IndianRupee className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="number" placeholder="2500" value={defaultAmount} onChange={e => setDefaultAmount(e.target.value)} className="bg-background/50 pl-8" />
                  </div>
                  <Button variant="secondary" onClick={applyDefaultAmount}>Apply</Button>
                </div>
              </div>
            </div>

            <div className="max-h-[350px] overflow-y-auto space-y-2 pr-2">
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No active members found.</p>
              ) : (
                members.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border bg-background/50">
                    <div>
                      <p className="font-semibold text-sm">{m.first_name} {m.last_name}</p>
                      <p className="text-xs text-muted-foreground">Flat: {m.flat_number || 'N/A'}</p>
                    </div>
                    <div className="w-32">
                      <div className="relative">
                        <IndianRupee className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          className="pl-8"
                          placeholder="Amount"
                          value={billAmounts[m.id] || ''}
                          onChange={e => setBillAmounts(prev => ({ ...prev, [m.id]: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <Button onClick={handleGenerateBills} disabled={!newBillMonth || isPending} className="w-full">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publish Bills for {newBillMonth || 'Selected Month'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* TAB: History */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {fetching && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {!fetching && monthSummaries.length === 0 && (
            <Card className="bg-card/80 backdrop-blur border-dashed">
              <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
                <History className="h-12 w-12 mb-3 opacity-20" />
                <p className="font-medium">No history yet</p>
                <p className="text-sm">Bill history will appear here once bills are generated.</p>
              </CardContent>
            </Card>
          )}
          {monthSummaries.map(summary => (
            <div key={summary.month} className="rounded-lg border bg-card/80 backdrop-blur overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedMonth(expandedMonth === summary.month ? null : summary.month)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">{summary.month}</p>
                    <p className="text-xs text-muted-foreground">
                      {summary.paidCount + summary.pendingCount} total bills
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden sm:flex items-center gap-3">
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                      {summary.paidCount} paid · ₹{summary.totalPaid.toLocaleString('en-IN')}
                    </Badge>
                    {summary.pendingCount > 0 && (
                      <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                        {summary.pendingCount} pending · ₹{summary.totalPending.toLocaleString('en-IN')}
                      </Badge>
                    )}
                  </div>
                  {expandedMonth === summary.month
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  }
                </div>
              </button>

              {expandedMonth === summary.month && (
                <div className="border-t px-4 pb-4 pt-3 space-y-2 bg-muted/10">
                  {/* Mobile summary */}
                  <div className="flex gap-2 sm:hidden mb-3">
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                      {summary.paidCount} paid · ₹{summary.totalPaid.toLocaleString('en-IN')}
                    </Badge>
                    {summary.pendingCount > 0 && (
                      <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                        {summary.pendingCount} pending
                      </Badge>
                    )}
                  </div>
                  {summary.bills.sort((a, b) => a.status.localeCompare(b.status)).map(bill => (
                    <div key={bill.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/70 border border-border/50">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${bill.status === 'PAID' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                        <div>
                          <p className="text-sm font-medium">
                            {bill.profiles ? `${bill.profiles.first_name} ${bill.profiles.last_name}` : 'You'}
                            {bill.profiles?.flat_number && <span className="text-xs text-muted-foreground ml-1">(Flat {bill.profiles.flat_number})</span>}
                          </p>
                          {bill.paid_at && (
                            <p className="text-xs text-muted-foreground">
                              Paid: {new Date(bill.paid_at).toLocaleDateString('en-IN')} · {bill.payment_mode}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">₹{Number(bill.amount).toLocaleString('en-IN')}</span>
                        {bill.status === 'PAID' && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-green-600 hover:bg-green-500/10"
                              title="Share via WhatsApp"
                              onClick={() => handleShareWhatsApp(bill)}
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-500/10"
                              title="Copy Receipt Link"
                              onClick={() => handleCopyReceiptLink(bill)}
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                        {bill.status === 'PENDING' && isAdmin && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-green-500/20 text-green-600 hover:bg-green-500/10"
                            onClick={() => handleManualMarkPaid(bill.id)}
                            disabled={payingBillId === bill.id}
                          >
                            {payingBillId === bill.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Mark Paid'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BillCard Component
// ─────────────────────────────────────────────────────────────
function BillCard({
  bill, onPay, onManualPay, isPaying, isPaid, isAdmin, currentUserId,
  editingBillId, editAmount, onEditAmount, onSaveAmount, onCancelEdit, onEditAmountChange,
  onShareWhatsApp, onCopyLink, onDownloadPDF, isPending,
}: {
  bill: Bill;
  onPay?: () => void;
  onManualPay?: () => void;
  isPaying?: boolean;
  isPaid?: boolean;
  isAdmin?: boolean;
  currentUserId?: string;
  editingBillId?: string | null;
  editAmount?: string;
  onEditAmount?: () => void;
  onSaveAmount?: () => void;
  onCancelEdit?: () => void;
  onEditAmountChange?: (val: string) => void;
  onShareWhatsApp?: () => void;
  onCopyLink?: () => void;
  onDownloadPDF?: () => void;
  isPending?: boolean;
}) {
  const isMyBill = bill.user_id === currentUserId;
  const billName = bill.profiles
    ? `${bill.profiles.first_name} ${bill.profiles.last_name} · Flat ${bill.profiles.flat_number || 'N/A'}`
    : 'Your Bill';
  const isEditing = editingBillId === bill.id;

  return (
    <Card className={`bg-card/80 backdrop-blur border-border/50 transition-all ${!isPaid ? 'hover:border-primary/30' : ''}`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isPaid ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}>
              {isPaid ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Clock className="h-4 w-4 text-yellow-500" />}
            </div>
            <div>
              <p className="font-semibold text-sm">{isAdmin && !isMyBill ? billName : 'Your Bill'}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>Month: {bill.month}</span>
                {bill.due_date && !isPaid && <span>· Due: {new Date(bill.due_date).toLocaleDateString('en-IN')}</span>}
                {isPaid && bill.paid_at && <span>· Paid: {new Date(bill.paid_at).toLocaleDateString('en-IN')}</span>}
                {isPaid && bill.payment_mode && <Badge variant="outline" className="text-[10px] py-0 px-1.5">{bill.payment_mode}</Badge>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Amount (with edit for admin) */}
            {isEditing ? (
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="number"
                    value={editAmount}
                    onChange={e => onEditAmountChange?.(e.target.value)}
                    className="pl-7 w-28 h-8 text-sm"
                    autoFocus
                  />
                </div>
                <Button size="sm" className="h-8 w-8 p-0 bg-green-500 hover:bg-green-600" onClick={onSaveAmount} disabled={isPending}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onCancelEdit}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <p className="text-lg font-bold text-primary">₹{Number(bill.amount).toLocaleString('en-IN')}</p>
                {!isPaid && isAdmin && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary" onClick={onEditAmount} title="Edit amount">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}

            {/* Actions for pending bills */}
            {!isPaid && !isEditing && (
              <div className="flex items-center gap-1.5">
                {isAdmin && (
                  <Button variant="outline" size="sm" onClick={onManualPay} disabled={isPaying} className="gap-1.5 border-green-500/20 text-green-600 hover:bg-green-500/10 h-8">
                    {isPaying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HandCoins className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline text-xs">Cash</span>
                  </Button>
                )}
                {isMyBill && (
                  <Button onClick={onPay} disabled={isPaying} size="sm" className="gap-1.5 h-8">
                    {isPaying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                    <span className="text-xs">Pay</span>
                  </Button>
                )}
              </div>
            )}

            {/* Actions for paid bills */}
            {isPaid && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-500/10 text-green-600 border border-green-500/20">PAID</span>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-600 hover:bg-green-500/10" title="Share via WhatsApp" onClick={onShareWhatsApp}>
                  <MessageSquare className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-500/10" title="Copy shareable link" onClick={onCopyLink}>
                  <Share2 className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" title="Download PDF" onClick={onDownloadPDF}>
                  <FileText className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
