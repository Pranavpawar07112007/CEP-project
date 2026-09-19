'use server';

import { createClient as createSupabaseServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { sendSocietyEmail } from '@/lib/email';

// ─────────────────────────────────────────────────────────────
// Service-role client – bypasses ALL RLS policies.
// All writes go through here after verifying the caller via getUser().
// ─────────────────────────────────────────────────────────────
function getServiceClient() {
  return createSupabaseServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getVerifiedUser() {
  const anonClient = await createClient();
  const { data: { user } } = await anonClient.auth.getUser();
  return user;
}

// ─────────────────────────────────────────────────────────────
// NOTICES
// ─────────────────────────────────────────────────────────────
export async function createNotice(data: {
  society_id: string;
  title: string;
  content: string;
  type: string;
}) {
  const user = await getVerifiedUser();
  if (!user) return { error: 'Unauthorized' };
  const service = getServiceClient();
  const { error } = await service.from('notices').insert({ ...data, created_by: user.id });
  
  if (!error) {
    // Notify all active members
    const { data: members } = await service.from('profiles').select('id').eq('society_id', data.society_id).eq('status', 'ACTIVE');
    if (members && members.length > 0) {
      const memberIds = members.map(m => m.id);
      const { data: authData } = await service.auth.admin.listUsers();
      const emails = authData.users.filter(u => memberIds.includes(u.id) && u.email).map(u => u.email as string);
      
      if (emails.length > 0) {
        await sendSocietyEmail({
          to: emails,
          subject: `New Notice: ${data.title}`,
          html: `<p>A new ${data.type} has been posted on the notice board.</p><h3>${data.title}</h3><p>${data.content}</p>`,
        });
      }
    }
  }
  
  return error ? { error: error.message } : { success: true };
}

export async function deleteNotice(id: string) {
  const user = await getVerifiedUser();
  if (!user) return { error: 'Unauthorized' };
  const service = getServiceClient();
  const { error } = await service.from('notices').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ─────────────────────────────────────────────────────────────
// COMPLAINTS
// ─────────────────────────────────────────────────────────────
export async function createComplaint(data: {
  society_id: string;
  subject: string;
  description: string;
  type: string;
}) {
  const user = await getVerifiedUser();
  if (!user) return { error: 'Unauthorized' };
  const service = getServiceClient();
  const { error } = await service.from('complaints').insert({ ...data, user_id: user.id });
  
  if (!error) {
    // Notify admins
    const { data: admins } = await service.from('profiles').select('id').eq('society_id', data.society_id).eq('role', 'ADMIN');
    if (admins && admins.length > 0) {
      const adminIds = admins.map(a => a.id);
      const { data: authData } = await service.auth.admin.listUsers();
      const adminEmails = authData.users.filter(u => adminIds.includes(u.id) && u.email).map(u => u.email as string);
      if (adminEmails.length > 0) {
        await sendSocietyEmail({
          to: adminEmails,
          subject: `New ${data.type} Submitted`,
          html: `<p>A new ${data.type} has been submitted: <strong>${data.subject}</strong></p><p>Please review it in the dashboard.</p>`,
        });
      }
    }
  }
  
  return error ? { error: error.message } : { success: true };
}

export async function updateComplaint(id: string, data: { admin_reply: string; status: string }) {
  const user = await getVerifiedUser();
  if (!user) return { error: 'Unauthorized' };
  const service = getServiceClient();
  
  // Get user_id before update
  const { data: complaint } = await service.from('complaints').select('user_id, subject').eq('id', id).single();
  
  const { error } = await service.from('complaints').update(data).eq('id', id);
  
  if (!error && complaint) {
    // Notify user
    const { data: authUser } = await service.auth.admin.getUserById(complaint.user_id);
    if (authUser.user?.email) {
      await sendSocietyEmail({
        to: authUser.user.email,
        subject: `Update on your complaint: ${complaint.subject}`,
        html: `<p>The status of your complaint has been updated to <strong>${data.status}</strong>.</p>
               ${data.admin_reply ? `<p><strong>Admin Reply:</strong> ${data.admin_reply}</p>` : ''}`,
      });
    }
  }

  return error ? { error: error.message } : { success: true };
}

// ─────────────────────────────────────────────────────────────
// PROPERTIES
// ─────────────────────────────────────────────────────────────
export async function createProperty(data: {
  society_id: string;
  title: string;
  description: string;
  property_type: string;
  price: number;
  privacy: string;
  contact_name: string;
  contact_phone: string;
}) {
  const user = await getVerifiedUser();
  if (!user) return { error: 'Unauthorized' };
  const service = getServiceClient();
  const { error } = await service.from('properties').insert({ ...data, owner_id: user.id });
  return error ? { error: error.message } : { success: true };
}

// ─────────────────────────────────────────────────────────────
// MAINTENANCE BILLS
// ─────────────────────────────────────────────────────────────
export async function createMaintenanceBills(bills: {
  society_id: string;
  user_id: string;
  month: string;
  amount: number;
  due_date: string | null;
  status: string;
}[]) {
  const user = await getVerifiedUser();
  if (!user) return { error: 'Unauthorized' };
  const service = getServiceClient();
  const { error } = await service.from('maintenance_bills').insert(bills);
  
  if (!error && bills.length > 0) {
    // Notify users about new bill
    const userIds = bills.map(b => b.user_id);
    const { data: authData } = await service.auth.admin.listUsers();
    const emails = authData.users.filter(u => userIds.includes(u.id) && u.email).map(u => u.email as string);
    if (emails.length > 0) {
      await sendSocietyEmail({
        to: emails,
        subject: `New Maintenance Bill Generated - ${bills[0].month}`,
        html: `<p>A new maintenance bill has been generated for <strong>${bills[0].month}</strong>.</p><p>Please log in to the dashboard to view the exact amount and pay via Razorpay.</p>`,
      });
    }
  }

  return error ? { error: error.message } : { success: true };
}

export async function markBillAsPaidManually(billId: string) {
  const user = await getVerifiedUser();
  if (!user) return { error: 'Unauthorized' };
  
  const service = getServiceClient();
  
  // Verify caller is admin/secretary
  const { data: profile } = await service.from('profiles').select('role, society_id').eq('id', user.id).single();
  if (!profile || !['ADMIN', 'SECRETARY'].includes(profile.role)) {
    return { error: 'Only Admin or Secretary can manually mark bills as paid.' };
  }

  // Get bill details
  const { data: bill } = await service.from('maintenance_bills').select('*').eq('id', billId).single();
  if (!bill) return { error: 'Bill not found.' };

  // 1. Mark bill as paid
  const { error: billErr } = await service.from('maintenance_bills').update({ status: 'PAID' }).eq('id', billId);
  if (billErr) return { error: billErr.message };

  // 2. Create transaction record for audit
  const { error: txnErr } = await service.from('transactions').insert({
    bill_id: billId,
    user_id: bill.user_id,
    society_id: bill.society_id,
    amount: bill.amount,
    payment_mode: 'MANUAL/CASH',
    status: 'SUCCESS',
  });
  
  if (txnErr) return { error: txnErr.message };
  
  // Notify user of manual payment
  const { data: authUser } = await service.auth.admin.getUserById(bill.user_id);
  if (authUser.user?.email) {
    await sendSocietyEmail({
      to: authUser.user.email,
      subject: `Payment Receipt - ${bill.month}`,
      html: `<p>Your maintenance bill for <strong>${bill.month}</strong> (₹${bill.amount}) has been marked as PAID.</p>
             <p>Payment Mode: MANUAL/CASH</p>`,
    });
  }
  
  return { success: true };
}

// ─────────────────────────────────────────────────────────────
// HALL ALLOCATIONS
// ─────────────────────────────────────────────────────────────
export async function createHallAllocation(data: {
  society_id: string;
  event_name: string;
  description: string;
  start_time: string;
  end_time: string;
  attendees: number;
}) {
  const user = await getVerifiedUser();
  if (!user) return { error: 'Unauthorized' };
  const service = getServiceClient();

  // Check for time conflicts with already-approved bookings
  const { data: conflicts } = await service
    .from('hall_allocations')
    .select('id')
    .eq('society_id', data.society_id)
    .eq('status', 'APPROVED')
    .lt('start_time', data.end_time)
    .gt('end_time', data.start_time);

  if (conflicts && conflicts.length > 0) {
    return { error: 'The hall is already booked for this time slot. Please choose a different time.' };
  }

  const { error } = await service.from('hall_allocations').insert({ ...data, user_id: user.id });
  
  if (!error) {
    // Notify admins
    const { data: admins } = await service.from('profiles').select('id').eq('society_id', data.society_id).eq('role', 'ADMIN');
    if (admins && admins.length > 0) {
      const adminIds = admins.map(a => a.id);
      const { data: authData } = await service.auth.admin.listUsers();
      const adminEmails = authData.users.filter(u => adminIds.includes(u.id) && u.email).map(u => u.email as string);
      if (adminEmails.length > 0) {
        await sendSocietyEmail({
          to: adminEmails,
          subject: 'New Hall Booking Request',
          html: `<p>A new hall booking request for <strong>${data.event_name}</strong> has been submitted.</p><p>Please log in to approve or reject the request.</p>`,
        });
      }
    }
  }

  return error ? { error: error.message } : { success: true };
}

export async function updateHallAllocation(
  id: string,
  data: { status: string; rejection_reason?: string }
) {
  const user = await getVerifiedUser();
  if (!user) return { error: 'Unauthorized' };
  const service = getServiceClient();
  
  // Get allocation before updating
  const { data: allocation } = await service.from('hall_allocations').select('user_id, event_name').eq('id', id).single();
  
  const { error } = await service.from('hall_allocations').update(data).eq('id', id);
  
  if (!error && allocation) {
    // Notify user
    const { data: authUser } = await service.auth.admin.getUserById(allocation.user_id);
    if (authUser.user?.email) {
      await sendSocietyEmail({
        to: authUser.user.email,
        subject: `Hall Booking ${data.status}: ${allocation.event_name}`,
        html: `<p>Your hall booking request for <strong>${allocation.event_name}</strong> has been <strong>${data.status}</strong>.</p>
               ${data.rejection_reason ? `<p>Reason: ${data.rejection_reason}</p>` : ''}`,
      });
    }
  }
  
  return error ? { error: error.message } : { success: true };
}

// ─────────────────────────────────────────────────────────────
// VOTING
// ─────────────────────────────────────────────────────────────
export async function createElection(data: {
  society_id: string;
  title: string;
  position: string;
  ends_at: string | null;
}) {
  const user = await getVerifiedUser();
  if (!user) return { error: 'Unauthorized' };
  const service = getServiceClient();
  const { error } = await service.from('elections').insert({ ...data, created_by: user.id, status: 'ACTIVE' });
  
  if (!error) {
    // Notify all active members
    const { data: members } = await service.from('profiles').select('id').eq('society_id', data.society_id).eq('status', 'ACTIVE');
    if (members && members.length > 0) {
      const memberIds = members.map(m => m.id);
      const { data: authData } = await service.auth.admin.listUsers();
      const emails = authData.users.filter(u => memberIds.includes(u.id) && u.email).map(u => u.email as string);
      if (emails.length > 0) {
        await sendSocietyEmail({
          to: emails,
          subject: `New Election Started: ${data.title}`,
          html: `<p>A new election for <strong>${data.position}</strong> has started.</p><p>Please log in to nominate yourself or vote.</p>`,
        });
      }
    }
  }
  
  return error ? { error: error.message } : { success: true };
}

export async function nominateCandidate(electionId: string) {
  const user = await getVerifiedUser();
  if (!user) return { error: 'Unauthorized' };
  const service = getServiceClient();
  const { error } = await service.from('candidates').insert({ election_id: electionId, user_id: user.id });
  return error ? { error: error.message } : { success: true };
}

export async function castVote(electionId: string, candidateId: string) {
  const user = await getVerifiedUser();
  if (!user) return { error: 'Unauthorized' };
  const service = getServiceClient();

  // Enforce one vote per election per user
  const { data: existing } = await service
    .from('votes')
    .select('id')
    .eq('election_id', electionId)
    .eq('user_id', user.id)
    .single();

  if (existing) return { error: 'You have already voted in this election.' };

  const { error } = await service.from('votes').insert({
    election_id: electionId,
    candidate_id: candidateId,
    user_id: user.id,
  });
  return error ? { error: error.message } : { success: true };
}

export async function closeElection(id: string) {
  const user = await getVerifiedUser();
  if (!user) return { error: 'Unauthorized' };
  const service = getServiceClient();
  const { error } = await service.from('elections').update({ status: 'CLOSED' }).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ─────────────────────────────────────────────────────────────
// EXPENSES
// ─────────────────────────────────────────────────────────────
export async function createExpense(data: {
  society_id: string;
  description: string;
  amount: number;
  expense_date: string;
  category: string;
}) {
  const user = await getVerifiedUser();
  if (!user) return { error: 'Unauthorized' };
  const service = getServiceClient();
  const { error } = await service.from('expenses').insert({ ...data, created_by: user.id });
  return error ? { error: error.message } : { success: true };
}

export async function deleteExpense(id: string) {
  const user = await getVerifiedUser();
  if (!user) return { error: 'Unauthorized' };
  const service = getServiceClient();
  const { error } = await service.from('expenses').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}
