
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { Printer, ArrowLeft, Loader2, AlertCircle, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Member, Payment } from '@/types';
import { getPaymentById, getMemberById } from '@/services/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const WhatsAppIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.894 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 4.315 1.919 6.066l-1.417 5.171 5.253-1.378z" />
    </svg>
)

export default function ReceiptPage() {
  const { toast } = useToast();
  const params = useParams();
  const paymentId = params.paymentId as string;
  const { user, isEditor, loading: authLoading } = useAuth();
  const router = useRouter();

  const [payment, setPayment] = React.useState<Payment | null>(null);
  const [member, setMember] = React.useState<Member | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const receiptRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!paymentId) return;

    const fetchReceiptData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const paymentData = await getPaymentById(paymentId);
        if (!paymentData) {
          throw new Error('Payment not found.');
        }
        const memberData = await getMemberById(paymentData.memberId);
        if (!memberData) {
            throw new Error('Associated member not found.');
        }
        setPayment(paymentData);
        setMember(memberData);
      } catch (e: any) {
        console.error('Failed to fetch receipt data', e);
        setError('Could not load receipt data. Please try again.');
        toast({
          variant: 'destructive',
          title: 'Error',
          description: e.message || 'An unknown error occurred.',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchReceiptData();
  }, [paymentId, toast]);
  
  const handlePrint = () => {
    window.print();
  };
  
  const handleSendWhatsApp = () => {
    if (!member || !payment) return;

    const receiptUrl = window.location.href;
    const message = `Dear ${member.name},\n\nPlease find your maintenance payment receipt for ${format(new Date(payment.date), 'MMMM yyyy')} here:\n${receiptUrl}\n\nThank you,\nAroma Residency`;
    
    const whatsappUrl = `https://wa.me/91${member.mobileNumber}?text=${encodeURIComponent(message)}`;
    
    window.open(whatsappUrl, '_blank');
  };

  const handleDownloadPdf = async () => {
    const receiptElement = receiptRef.current;
    if (!receiptElement || !payment || !member) return;

    // Temporarily remove box-shadow for PDF generation to avoid visual artifacts
    const originalShadow = receiptElement.style.boxShadow;
    receiptElement.style.boxShadow = 'none';

    const canvas = await html2canvas(receiptElement, {
      scale: 2, // Increase scale for better quality
      logging: false,
      useCORS: true,
    });
    
    // Restore original styles
    receiptElement.style.boxShadow = originalShadow;

    const imgData = canvas.toDataURL('image/png');
    
    // A4 size in points: 595.28 x 841.89
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const canvasAspectRatio = canvasWidth / canvasHeight;

    // Fit canvas to width of PDF
    const finalWidth = pdfWidth;
    const finalHeight = finalWidth / canvasAspectRatio;

    // Center the image on the page
    const x = 0;
    const y = (pdfHeight - finalHeight) / 2;

    pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
    pdf.save(`receipt-${member.name.replace(/\s+/g, '-')}-${payment.id.slice(0, 6)}.pdf`);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };
  
  const numberToWords = (num: number): string => {
    const a = ['','one ','two ','three ','four ', 'five ','six ','seven ','eight ','nine ','ten ','eleven ','twelve ','thirteen ','fourteen ','fifteen ','sixteen ','seventeen ','eighteen ','nineteen '];
    const b = ['', '', 'twenty','thirty','forty','fifty', 'sixty','seventy','eighty','ninety'];
    
    if ((num = num.toString()).length > 9) return 'overflow';
    const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    let str = '';
    str += (n[1] != '00') ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : '';
    str += (n[2] != '00') ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : '';
    str += (n[3] != '00') ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : '';
    str += (n[4] != '0') ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : '';
    str += (n[5] != '00') ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
    
    return str.trim().split(' ').map(s => s.charAt(0).toUpperCase() + s.substring(1)).join(' ') + ' Only';
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-2 sm:p-4 md:p-8 lg:p-12 bg-background">
        <div className="w-full max-w-2xl">
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center mb-4 print-hide gap-2">
                {user ? (
                    <>
                        <Button asChild variant="outline" className="w-full sm:w-auto">
                            <Link href="/history">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to History
                            </Link>
                        </Button>
                        <div className="flex flex-col sm:flex-row gap-2">
                            {isEditor && (
                                <>
                                    <Button onClick={handleSendWhatsApp} variant="outline" disabled={isLoading || !!error}>
                                        <WhatsAppIcon />
                                        <span className="ml-2 hidden sm:inline">Send on WhatsApp</span>
                                        <span className="ml-2 sm:hidden">Send</span>
                                    </Button>
                                    <Button onClick={handleDownloadPdf} variant="outline" disabled={isLoading || !!error}>
                                        <FileDown className="mr-2 h-4 w-4" />
                                        <span className='hidden sm:inline'>Download PDF</span>
                                        <span className='sm:hidden'>Download</span>
                                    </Button>
                                </>
                            )}
                            <Button onClick={handlePrint} disabled={isLoading || !!error}>
                                <Printer className="mr-2 h-4 w-4" />
                                <span className='hidden sm:inline'>Print Receipt</span>
                                <span className='sm:hidden'>Print</span>
                            </Button>
                        </div>
                    </>
                ) : (
                   <div className="w-full flex justify-end">
                     <Button onClick={handlePrint} variant="outline" disabled={isLoading || !!error}>
                        <Printer className="mr-2 h-4 w-4" />
                        Print
                    </Button>
                   </div>
                )}
            </div>

            <Card className="w-full card-print glass-card" ref={receiptRef}>
                <CardHeader className="border-b border-border text-center">
                    <div className="flex justify-center items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"/></svg>
                        <CardTitle className="font-headline text-2xl">
                            Maintenance Receipt
                        </CardTitle>
                    </div>
                     <p className="text-lg font-semibold text-muted-foreground pt-2">Aroma Residency Co-operative Housing Society Limited</p>
                     <p className="text-sm text-muted-foreground">Survey no. 26/2/1, Acolade Society Road, Kharadi, Pune-411014</p>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    {isLoading ? (
                        <div className="space-y-4">
                            <div className="flex justify-between"> <Skeleton className="h-5 w-24" /> <Skeleton className="h-5 w-32" /> </div>
                             <div className="flex justify-between"> <Skeleton className="h-5 w-24" /> <Skeleton className="h-5 w-32" /> </div>
                            <div className="space-y-2 pt-4">
                                <Skeleton className="h-6 w-full" />
                                <Skeleton className="h-6 w-3/4" />
                                <Skeleton className="h-6 w-4/5" />
                                <Skeleton className="h-6 w-1/2" />
                            </div>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center text-destructive p-8 text-center">
                            <AlertCircle className="h-10 w-10 mb-4" />
                            <p className="text-lg font-semibold">Error Loading Receipt</p>
                            <p>{error}</p>
                        </div>
                    ) : payment && member ? (
                        <>
                            <div className="flex justify-between items-center text-sm">
                                <div className="space-y-1">
                                    <p className="font-semibold text-muted-foreground">Receipt No.</p>
                                    <p className="font-mono">{payment.receiptNumber || payment.id.slice(0, 8).toUpperCase()}</p>
                                </div>
                                <div className="space-y-1 text-right">
                                    <p className="font-semibold text-muted-foreground">Payment Date</p>
                                    <p>{format(new Date(payment.date), 'PPP')}</p>
                                </div>
                            </div>
                            <div className="border-t border-b border-border py-4 my-4 space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="font-semibold text-muted-foreground">Received From:</span>
                                    <span>{member.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold text-muted-foreground">Flat No:</span>
                                    <span>{member.flatNumber}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold text-muted-foreground">Payment Mode:</span>
                                    <span>{payment.paymentMode}</span>
                                </div>
                                {payment.paymentMode === 'Online' && payment.transactionId && (
                                     <div className="flex justify-between">
                                        <span className="font-semibold text-muted-foreground">Transaction ID:</span>
                                        <span className="font-mono">{payment.transactionId}</span>
                                    </div>
                                )}
                            </div>
                             <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <p className="font-semibold">Description</p>
                                    <p className="font-semibold text-right">Amount</p>
                                </div>
                                <div className="flex justify-between items-center border-b border-border pb-2">
                                    <p className="text-muted-foreground">Society Maintenance for {format(new Date(payment.date), 'MMMM yyyy')}</p>
                                    <p>{formatCurrency(payment.amount)}</p>
                                </div>
                                <div className="flex justify-end pt-2">
                                    <div className="flex items-center gap-4">
                                        <p className="font-bold text-lg">Total</p>
                                        <p className="font-bold text-lg">{formatCurrency(payment.amount)}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="text-sm mt-4">
                                <p className="font-semibold">Amount in words:</p>
                                <p className="text-muted-foreground">{numberToWords(payment.amount)}</p>
                            </div>
                        </>
                    ) : null}
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row justify-between p-6 bg-muted/50 text-xs text-muted-foreground text-center sm:text-left">
                    <p>This is a computer-generated receipt and does not require a signature.</p>
                    <p>Secretary, Aroma Residency</p>
                </CardFooter>
            </Card>
        </div>
    </main>
  );
}
