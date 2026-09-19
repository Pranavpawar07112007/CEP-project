'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { getReceiptByToken } from '@/app/actions/modules';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, Download, Building2, AlertCircle } from 'lucide-react';
import jsPDF from 'jspdf';

export default function PublicReceiptPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = React.useState(true);
  const [receipt, setReceipt] = React.useState<any>(null);
  const [transaction, setTransaction] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!token) return;
    const fetchReceipt = async () => {
      const result = await getReceiptByToken(token);
      if (result.error) {
        setError(result.error);
      } else {
        setReceipt(result.bill);
        setTransaction(result.transaction);
      }
      setLoading(false);
    };
    fetchReceipt();
  }, [token]);

  const handleDownloadPDF = () => {
    if (!receipt) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(99, 102, 241);
    doc.rect(0, 0, pageWidth, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('MAINTENANCE PAYMENT RECEIPT', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(receipt.societies?.name || 'Society Management System', pageWidth / 2, 33, { align: 'center' });

    // Body
    doc.setTextColor(30, 30, 30);
    const lineY = 65;
    const addRow = (label: string, value: string, y: number) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(label, 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 100, y);
    };

    addRow('Receipt ID:', receipt.id?.slice(0, 22) + '...', lineY);
    if (transaction?.razorpay_payment_id) {
      addRow('Payment ID:', transaction.razorpay_payment_id, lineY + 12);
    }
    addRow('Member Name:', `${receipt.profiles?.first_name || ''} ${receipt.profiles?.last_name || ''}`, lineY + 24);
    addRow('Flat No.:', receipt.profiles?.flat_number || 'N/A', lineY + 36);
    addRow('Society:', receipt.societies?.name || 'N/A', lineY + 48);
    addRow('Month:', receipt.month, lineY + 60);
    addRow('Amount Paid:', `Rs.${Number(receipt.amount).toLocaleString('en-IN')}`, lineY + 72);
    addRow('Payment Mode:', receipt.payment_mode || 'N/A', lineY + 84);
    addRow('Payment Date:', receipt.paid_at
      ? new Date(receipt.paid_at).toLocaleDateString('en-IN', { dateStyle: 'long' })
      : new Date().toLocaleDateString('en-IN', { dateStyle: 'long' }), lineY + 96);
    addRow('Status:', 'PAID', lineY + 108);

    // Footer
    doc.setDrawColor(200, 200, 200);
    doc.line(20, lineY + 120, pageWidth - 20, lineY + 120);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('This is a computer-generated receipt. No signature required.', pageWidth / 2, lineY + 133, { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageWidth / 2, lineY + 143, { align: 'center' });

    doc.save(`receipt_${receipt.month}_${receipt.profiles?.flat_number || 'flat'}.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <div className="text-center max-w-sm">
          <div className="p-4 bg-red-500/10 rounded-full w-fit mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Receipt Not Found</h1>
          <p className="text-muted-foreground text-sm">
            This receipt link may be invalid or has expired. Please contact your society admin for a new link.
          </p>
        </div>
      </div>
    );
  }

  const societyName = receipt.societies?.name || 'Society';
  const memberName = `${receipt.profiles?.first_name || ''} ${receipt.profiles?.last_name || ''}`.trim();
  const flatNumber = receipt.profiles?.flat_number || 'N/A';
  const paidDate = receipt.paid_at
    ? new Date(receipt.paid_at).toLocaleDateString('en-IN', { dateStyle: 'long' })
    : 'N/A';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      {/* Ambient Background */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-green-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Receipt Card */}
        <div className="rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-violet-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-full">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium opacity-80">Society Receipt</p>
                  <p className="font-bold text-lg leading-tight">{societyName}</p>
                </div>
              </div>
              <div className="p-2.5 bg-white/20 rounded-full">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-5 text-center">
              <p className="text-4xl font-bold">₹{Number(receipt.amount).toLocaleString('en-IN')}</p>
              <p className="text-sm opacity-80 mt-1">Maintenance — {receipt.month}</p>
            </div>
          </div>

          {/* Paid Badge */}
          <div className="flex justify-center -mt-4">
            <span className="px-4 py-1 bg-green-500 text-white text-xs font-bold rounded-full shadow-lg uppercase tracking-wider">
              PAID ✓
            </span>
          </div>

          {/* Details */}
          <div className="p-6 space-y-0 mt-2">
            {[
              { label: 'Member Name', value: memberName || 'N/A' },
              { label: 'Flat / Unit', value: flatNumber },
              { label: 'Month', value: receipt.month },
              { label: 'Amount', value: `₹${Number(receipt.amount).toLocaleString('en-IN')}` },
              { label: 'Payment Mode', value: receipt.payment_mode || 'N/A' },
              { label: 'Payment Date', value: paidDate },
              ...(transaction?.razorpay_payment_id ? [{ label: 'Transaction ID', value: transaction.razorpay_payment_id }] : []),
              ...(receipt.societies?.city ? [{ label: 'Location', value: `${receipt.societies.city}${receipt.societies.state ? ', ' + receipt.societies.state : ''}` }] : []),
            ].map((row, idx) => (
              <div key={idx} className={`flex justify-between py-3 ${idx > 0 ? 'border-t border-border/50' : ''}`}>
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className="text-sm font-semibold text-right max-w-[60%] truncate">{row.value}</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 space-y-3">
            <Button onClick={handleDownloadPDF} className="w-full gap-2">
              <Download className="h-4 w-4" />
              Download Receipt PDF
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              This is a computer-generated receipt. No signature required.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Powered by Society Management Platform
        </p>
      </div>
    </div>
  );
}
