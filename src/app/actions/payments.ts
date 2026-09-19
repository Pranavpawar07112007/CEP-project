'use server';

import { createClient as createSupabaseServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { sendSocietyEmail } from '@/lib/email';

// Service role client - bypasses RLS for trusted payment writes
function getServiceClient() {
  return createSupabaseServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function createRazorpayOrder(billId: string, amount: number) {
  // Verify user is logged in via their session cookie
  const anonClient = await createClient();
  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  try {
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Razorpay works in paise
      currency: 'INR',
      receipt: `bill_${billId.slice(0, 30)}`,
      notes: { bill_id: billId, user_id: user.id },
    });
    return { orderId: order.id, amount: order.amount };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function verifyAndRecordPayment(data: {
  billId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  amount: number;
  paymentMode: string;
}) {
  // 1. Verify caller is authenticated
  const anonClient = await createClient();
  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  // 2. Verify Razorpay HMAC signature
  const body = `${data.razorpayOrderId}|${data.razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest('hex');

  if (expectedSignature !== data.razorpaySignature) {
    return { error: 'Payment verification failed. Invalid signature.' };
  }

  // 3. All DB writes use service role to bypass RLS
  const service = getServiceClient();

  const { data: profile } = await service
    .from('profiles')
    .select('society_id')
    .eq('id', user.id)
    .single();
  if (!profile) return { error: 'Profile not found' };

  // 4. Record the transaction
  const { error: txnErr } = await service.from('transactions').insert({
    bill_id: data.billId,
    user_id: user.id,
    society_id: profile.society_id,
    amount: data.amount,
    payment_mode: data.paymentMode,
    razorpay_order_id: data.razorpayOrderId,
    razorpay_payment_id: data.razorpayPaymentId,
    status: 'SUCCESS',
  });
  if (txnErr) return { error: txnErr.message };

  // 5. Mark bill as PAID with receipt token and timestamp
  const receiptToken = crypto.randomBytes(32).toString('hex');
  const { error: billErr } = await service
    .from('maintenance_bills')
    .update({ 
      status: 'PAID',
      receipt_token: receiptToken,
      paid_at: new Date().toISOString(),
      payment_mode: 'RAZORPAY',
    })
    .eq('id', data.billId);
  if (billErr) return { error: billErr.message };

  // 6. Send Receipt Email
  if (user.email) {
    const { data: bill } = await service.from('maintenance_bills').select('month').eq('id', data.billId).single();
    await sendSocietyEmail({
      to: user.email,
      subject: `Payment Receipt - ${bill?.month || 'Maintenance'}`,
      html: `<p>Your maintenance bill payment of <strong>₹${data.amount}</strong> was successful.</p>
             <p>Payment Mode: RAZORPAY</p>
             <p>Transaction ID: ${data.razorpayPaymentId}</p>`,
    });
  }

  return { success: true };
}
