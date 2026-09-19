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
import { PlusCircle, CreditCard, CheckCircle2, Clock, Loader2, IndianRupee, HandCoins } from 'lucide-react';
import { createRazorpayOrder, verifyAndRecordPayment } from '@/app/actions/payments';
import { createMaintenanceBills, markBillAsPaidManually } from '@/app/actions/modules';
import jsPDF from 'jspdf';

type Bill = {
  id: string;
  month: string;
  amount: number;
  status: string;
  due_date: string;
  user_id: string;
  profiles?: { first_name: string; last_name: string; flat_number: string };
};

declare global {
  interface Window { Razorpay: any; }
}

export default function MaintenancePage() {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const supabase = createClient();
  
  const [bills, setBills] = React.useState<Bill[]>([]);
  const [fetching, setFetching] = React.useState(true);
  const [payingBillId, setPayingBillId] = React.useState<string | null>(null);
  
  // Billing Generation State
  const [showAddBill, setShowAddBill] = React.useState(false);
  const [members, setMembers] = React.useState<any[]>([]);
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
      profiles:user_id (first_name, last_name, flat_number)
    `);
    
    if (isAdmin) {
      query.eq('society_id', profile.society_id);
    } else {
      query.eq('user_id', profile.id);
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

  // Fetch active members when admin opens the Add Bill modal
  const handleOpenAddBill = async () => {
    if (showAddBill) {
      setShowAddBill(false);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, flat_number')
      .eq('society_id', profile?.society_id)
      .eq('status', 'ACTIVE')
      .order('flat_number');
      
    if (data) {
      setMembers(data);
      // Initialize amounts map
      const initialAmounts: Record<string, string> = {};
      data.forEach(m => initialAmounts[m.id] = '');
      setBillAmounts(initialAmounts);
    }
    setShowAddBill(true);
  };

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
        setShowAddBill(false);
        fetchBills();
      }
    });
  };

  const handleManualMarkPaid = (billId: string) => {
    startTransition(async () => {
      setPayingBillId(billId); // Reuse loading state for the specific bill
      const result = await markBillAsPaidManually(billId);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      } else {
        toast({ title: '✅ Bill marked as PAID (Manual/Cash)' });
        fetchBills();
      }
      setPayingBillId(null);
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
      name: 'Society Maintenance',
      description: `Maintenance for ${bill.month}`,
      order_id: result.orderId,
      prefill: { email: user?.email },
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
          generateReceipt(bill, response.razorpay_payment_id);
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

  const generateReceipt = (bill: Bill, paymentId: string) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(99, 102, 241);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('MAINTENANCE PAYMENT RECEIPT', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Society Management System', pageWidth / 2, 30, { align: 'center' });

    doc.setTextColor(30, 30, 30);
    const lineY = 60;
    const addRow = (label: string, value: string, y: number) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(label, 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 100, y);
    };

    addRow('Bill ID:', bill.id.slice(0, 18) + '...', lineY);
    addRow('Payment ID:', paymentId, lineY + 10);
    // Use the bill's nested profile data if available, otherwise fallback to current user
    const fname = bill.profiles?.first_name || profile?.first_name;
    const lname = bill.profiles?.last_name || profile?.last_name;
    const flat = bill.profiles?.flat_number || profile?.flat_number || 'N/A';
    
    addRow('Member:', `${fname} ${lname}`, lineY + 20);
    addRow('Flat No.:', flat, lineY + 30);
    addRow('Month:', bill.month, lineY + 40);
    addRow('Amount Paid:', `₹${Number(bill.amount).toLocaleString('en-IN')}`, lineY + 50);
    addRow('Payment Date:', new Date().toLocaleDateString('en-IN', { dateStyle: 'long' }), lineY + 60);
    addRow('Status:', 'PAID ✓', lineY + 70);

    doc.setDrawColor(200, 200, 200);
    doc.line(20, lineY + 82, pageWidth - 20, lineY + 82);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('This is a computer-generated receipt. No signature required.', pageWidth / 2, lineY + 95, { align: 'center' });

    doc.save(`receipt_${bill.month}_${paymentId}.pdf`);
  };

  const pendingBills = bills.filter(b => b.status === 'PENDING');
  const paidBills = bills.filter(b => b.status === 'PAID');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Maintenance Payment</h1>
          <p className="text-muted-foreground mt-1">Manage society fees and secure payments.</p>
        </div>
        {isAdmin && (
          <Button onClick={handleOpenAddBill} className="gap-2">
            <PlusCircle className="h-4 w-4" />
            {showAddBill ? 'Cancel' : 'Generate Bills'}
          </Button>
        )}
      </div>

      {showAddBill && isAdmin && (
        <Card className="bg-card/80 backdrop-blur border-primary/30 animate-fade-in">
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
                  <Input type="number" placeholder="2500" value={defaultAmount} onChange={e => setDefaultAmount(e.target.value)} className="bg-background/50" />
                  <Button variant="secondary" onClick={applyDefaultAmount}>Apply</Button>
                </div>
              </div>
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
              {members.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border bg-background/50">
                  <div>
                    <p className="font-semibold">{m.first_name} {m.last_name}</p>
                    <p className="text-xs text-muted-foreground">Flat: {m.flat_number || 'N/A'}</p>
                  </div>
                  <div className="w-32">
                    <div className="relative">
                      <IndianRupee className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        className="pl-8"
                        placeholder="Amount"
                        value={billAmounts[m.id]}
                        onChange={e => setBillAmounts(prev => ({ ...prev, [m.id]: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={handleGenerateBills} disabled={!newBillMonth || isPending} className="w-full">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publish Bills
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card/80 backdrop-blur border-yellow-500/20">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 bg-yellow-500/10 rounded-full">
              <Clock className="h-6 w-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">₹{pendingBills.reduce((a, b) => a + Number(b.amount), 0).toLocaleString('en-IN')}</p>
              <p className="text-sm text-muted-foreground">{pendingBills.length} pending bill{pendingBills.length !== 1 ? 's' : ''}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur border-green-500/20">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-full">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">₹{paidBills.reduce((a, b) => a + Number(b.amount), 0).toLocaleString('en-IN')}</p>
              <p className="text-sm text-muted-foreground">{paidBills.length} paid bill{paidBills.length !== 1 ? 's' : ''}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bills List */}
      {fetching && <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}
      {!fetching && bills.length === 0 && (
        <Card className="bg-card/80 backdrop-blur border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-muted-foreground">
            <IndianRupee className="h-12 w-12 mb-3 opacity-20" />
            <p className="font-medium">No bills yet</p>
            <p className="text-sm">Bills will appear here once generated.</p>
          </CardContent>
        </Card>
      )}

      {pendingBills.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-yellow-600 dark:text-yellow-400 flex items-center gap-2"><Clock className="h-5 w-5" /> Pending Bills</h2>
          {pendingBills.map(bill => (
            <BillCard 
              key={bill.id} 
              bill={bill} 
              isAdmin={isAdmin}
              currentUserId={profile?.id}
              onPay={() => handlePayment(bill)} 
              onManualPay={() => handleManualMarkPaid(bill.id)}
              isPaying={payingBillId === bill.id} 
            />
          ))}
        </div>
      )}

      {paidBills.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-green-600 dark:text-green-400 flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> Paid Bills</h2>
          {paidBills.map(bill => (
            <BillCard 
              key={bill.id} 
              bill={bill} 
              isAdmin={isAdmin}
              currentUserId={profile?.id}
              isPaid 
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BillCard({ 
  bill, onPay, onManualPay, isPaying, isPaid, isAdmin, currentUserId 
}: {
  bill: Bill; onPay?: () => void; onManualPay?: () => void; isPaying?: boolean; isPaid?: boolean; isAdmin?: boolean; currentUserId?: string;
}) {
  const isMyBill = bill.user_id === currentUserId;
  const billName = bill.profiles ? `${bill.profiles.first_name} ${bill.profiles.last_name} (Flat: ${bill.profiles.flat_number || 'N/A'})` : 'Your Bill';

  return (
    <Card className={`bg-card/80 backdrop-blur border-border/50 transition-all ${!isPaid ? 'hover:border-primary/30' : ''}`}>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-lg ${isPaid ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}>
              {isPaid ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Clock className="h-5 w-5 text-yellow-500" />}
            </div>
            <div>
              <p className="font-semibold">Maintenance — {bill.month}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                {isAdmin && !isMyBill && <Badge variant="secondary" className="text-[10px] py-0">{billName}</Badge>}
                {bill.due_date && <span>Due: {new Date(bill.due_date).toLocaleDateString('en-IN')}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-xl font-bold text-primary">₹{Number(bill.amount).toLocaleString('en-IN')}</p>
            
            {!isPaid && (
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <Button variant="outline" size="sm" onClick={onManualPay} disabled={isPaying} className="gap-2 border-green-500/20 text-green-600 hover:bg-green-500/10">
                    <HandCoins className="h-4 w-4" />
                    <span className="hidden sm:inline">Mark Paid (Cash)</span>
                  </Button>
                )}
                {isMyBill && (
                  <Button onClick={onPay} disabled={isPaying} size="sm" className="gap-2">
                    {isPaying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    Pay Now
                  </Button>
                )}
              </div>
            )}
            
            {isPaid && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 border border-green-500/20">PAID</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
