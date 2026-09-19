'use server';

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { sendSocietyEmail } from '@/lib/email';

// ─────────────────────────────────────────────────────────────
// Service-role client: bypasses ALL RLS policies.
// Only used inside trusted server actions.
// ─────────────────────────────────────────────────────────────
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ─────────────────────────────────────────────────────────────
// Helper: get the currently logged-in user from session cookie
// ─────────────────────────────────────────────────────────────
async function getCurrentUser() {
  const cookieStore = await cookies();
  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );
  const { data: { user } } = await anonClient.auth.getUser();
  return user;
}

// ─────────────────────────────────────────────────────────────
// REGISTRATION: Register a brand-new society + admin user
// ─────────────────────────────────────────────────────────────
export async function registerNewSociety(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  societyName: string;
}) {
  const service = getServiceClient();

  try {
    // 1. Create auth user (email_confirm = true skips email verification)
    const { data: authData, error: authErr } = await service.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (authErr) throw authErr;
    const userId = authData.user.id;

    // 2. Create society with PENDING status
    const { data: society, error: socErr } = await service
      .from('societies')
      .insert({
        name: data.societyName,
        status: 'PENDING',
        admin_email: data.email,
        onboarding_completed: false,
        society_balance: 0,
        mode: 'COMMUNITY',
      })
      .select('id')
      .single();
    if (socErr) throw socErr;

    // 3. Create ACTIVE admin profile (admin is trusted, society itself is pending)
    const { error: profErr } = await service.from('profiles').insert({
      id: userId,
      society_id: society.id,
      role: 'ADMIN',
      status: 'ACTIVE',
      first_name: data.firstName,
      last_name: data.lastName,
    });
    if (profErr) throw profErr;

    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Registration failed.' };
  }
}

// ─────────────────────────────────────────────────────────────
// REGISTRATION: User joins an existing society (pending approval)
// ─────────────────────────────────────────────────────────────
export async function joinExistingSociety(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  flatNumber: string;
  societyId: string;
}) {
  const service = getServiceClient();

  try {
    // 1. Create auth user (auto-confirm so they can sign in)
    const { data: authData, error: authErr } = await service.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (authErr) throw authErr;
    const userId = authData.user.id;

    // 2. Create PENDING profile (blocked from dashboard until admin approves)
    const { error: profErr } = await service.from('profiles').insert({
      id: userId,
      society_id: data.societyId,
      role: 'RESIDENT',
      status: 'PENDING',
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone,
      flat_number: data.flatNumber,
    });
    if (profErr) throw profErr;

    // 3. Create join request so admin can see & approve
    const { error: reqErr } = await service.from('join_requests').insert({
      user_id: userId,
      society_id: data.societyId,
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone,
      flat_number: data.flatNumber,
      status: 'PENDING',
    });
    if (reqErr) throw reqErr;

    // Send email to society admins
    const { data: admins } = await service
      .from('profiles')
      .select('id')
      .eq('society_id', data.societyId)
      .eq('role', 'ADMIN');
    
    if (admins && admins.length > 0) {
      const adminIds = admins.map(a => a.id);
      const { data: authAdmins } = await service.auth.admin.listUsers();
      const adminEmails = authAdmins.users
        .filter(u => adminIds.includes(u.id) && u.email)
        .map(u => u.email as string);

      if (adminEmails.length > 0) {
        await sendSocietyEmail({
          to: adminEmails,
          subject: 'New Member Request',
          html: `<p><strong>${data.firstName} ${data.lastName}</strong> (Flat: ${data.flatNumber}) has requested to join your society.</p><p>Please log in to the dashboard to approve or reject their request.</p>`,
        });
      }
    }

    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Registration failed.' };
  }
}

// ─────────────────────────────────────────────────────────────
// ADMIN: Add a user directly to the society (already approved)
// ─────────────────────────────────────────────────────────────
export async function createSocietyUser(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: 'Not authenticated.' };

  const service = getServiceClient();

  // Verify requester is admin/secretary
  const { data: adminProfile } = await service
    .from('profiles')
    .select('society_id, role, status')
    .eq('id', user.id)
    .single();

  if (
    !adminProfile ||
    adminProfile.status !== 'ACTIVE' ||
    !['ADMIN', 'SECRETARY'].includes(adminProfile.role)
  ) {
    return { error: 'Unauthorized. Only Admin/Secretary can add users.' };
  }

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const firstName = formData.get('firstName') as string;
  const lastName = formData.get('lastName') as string;
  const role = (formData.get('role') as string) || 'RESIDENT';
  const flatNumber = formData.get('flatNumber') as string;
  const phone = (formData.get('phone') as string) || '';

  try {
    // Create auth user with email auto-confirmed
    const { data: authData, error: authError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authError) throw authError;

    // Create ACTIVE profile (admin-added users are pre-approved)
    const { error: profileError } = await service.from('profiles').insert({
      id: authData.user.id,
      society_id: adminProfile.society_id,
      role,
      status: 'ACTIVE',
      first_name: firstName,
      last_name: lastName,
      flat_number: flatNumber,
      phone,
    });
    if (profileError) throw profileError;

    // Send welcome email to the new user
    await sendSocietyEmail({
      to: email,
      subject: 'Welcome to your Society Dashboard',
      html: `<p>Hi ${firstName},</p>
             <p>Your society admin has created an account for you.</p>
             <p>You can now log in using this email address.</p>`,
    });

    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────
// SUPER ADMIN: Update society status (Approve / Suspend)
// ─────────────────────────────────────────────────────────────
export async function updateSocietyStatus(societyId: string, status: 'ACTIVE' | 'SUSPENDED') {
  const user = await getCurrentUser();
  const SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || 'pranav07112007@gmail.com';
  
  if (!user || user.email !== SUPER_ADMIN_EMAIL) {
    return { error: 'Unauthorized. Only Super Admin can perform this action.' };
  }

  const service = getServiceClient();
  
  try {
    // Get the admin_email before updating so we can notify them
    const { data: society } = await service.from('societies').select('admin_email, name').eq('id', societyId).single();

    const { error } = await service
      .from('societies')
      .update({ status })
      .eq('id', societyId);
      
    if (error) throw error;
    
    // Notify the society admin
    if (society && society.admin_email) {
      const isApproved = status === 'ACTIVE';
      await sendSocietyEmail({
        to: society.admin_email,
        subject: isApproved ? 'Your Society is Approved!' : 'Your Society has been Suspended',
        html: `<p>Hello,</p>
               <p>Your society workspace <strong>${society.name}</strong> has been ${isApproved ? 'approved and activated' : 'suspended'} by the platform Super Admin.</p>
               ${isApproved ? '<p>You can now log in to the dashboard.</p>' : ''}`,
      });
    }

    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to update society status.' };
  }
}

// ─────────────────────────────────────────────────────────────
// CANCEL REGISTRATION: User deletes their pending request
// ─────────────────────────────────────────────────────────────
export async function cancelRegistration() {
  const user = await getCurrentUser();
  if (!user) return { error: 'Not authenticated' };

  const service = getServiceClient();

  try {
    // Check if they are a society admin of a pending society
    const { data: society } = await service
      .from('societies')
      .select('id, status')
      .eq('admin_email', user.email)
      .single();

    if (society && society.status === 'PENDING') {
      // Delete join requests first
      await service.from('join_requests').delete().eq('society_id', society.id);
      // Delete the society
      await service.from('societies').delete().eq('id', society.id);
    } else {
      // If they are just a pending member, delete their join request
      await service.from('join_requests').delete().eq('user_id', user.id);
    }

    // Delete their profile
    await service.from('profiles').delete().eq('id', user.id);

    // Delete their auth record completely
    const { error: authErr } = await service.auth.admin.deleteUser(user.id);
    if (authErr) throw authErr;

    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to cancel registration.' };
  }
}

// ─────────────────────────────────────────────────────────────
// SETUP: Admin chooses the society mode
// ─────────────────────────────────────────────────────────────
export async function updateSocietyMode(mode: 'COMMUNITY' | 'ADMIN_ONLY') {
  const user = await getCurrentUser();
  if (!user) return { error: 'Not authenticated' };

  const service = getServiceClient();

  try {
    const { data: profile } = await service
      .from('profiles')
      .select('society_id, role')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.society_id || !['ADMIN', 'SECRETARY'].includes(profile.role)) {
      return { error: 'Only the society admin can set the mode.' };
    }

    const { error } = await service
      .from('societies')
      .update({ mode })
      .eq('id', profile.society_id);

    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to update society mode.' };
  }
}

// ─────────────────────────────────────────────────────────────
// SETUP: Complete admin first-time onboarding
// ─────────────────────────────────────────────────────────────
export async function completeAdminSetup(data: {
  mode: 'COMMUNITY' | 'ADMIN_ONLY';
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  flatNumber?: string;
  societyBalance?: number;
}) {
  const user = await getCurrentUser();
  if (!user) return { error: 'Not authenticated' };

  const service = getServiceClient();

  try {
    const { data: profile } = await service
      .from('profiles')
      .select('society_id, role')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.society_id || !['ADMIN'].includes(profile.role)) {
      return { error: 'Only the society admin can complete setup.' };
    }

    // Update society
    const { error: socErr } = await service
      .from('societies')
      .update({
        mode: data.mode,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zip_code: data.zipCode || null,
        phone: data.phone || null,
        society_balance: data.societyBalance ?? 0,
        onboarding_completed: true,
      })
      .eq('id', profile.society_id);

    if (socErr) throw socErr;

    // Update admin profile with flat number and phone
    const { error: profErr } = await service
      .from('profiles')
      .update({
        flat_number: data.flatNumber || null,
        phone: data.phone || null,
      })
      .eq('id', user.id);

    if (profErr) throw profErr;

    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to complete setup.' };
  }
}

// ─────────────────────────────────────────────────────────────
// ADMIN: Update society balance (opening/current balance)
// ─────────────────────────────────────────────────────────────
export async function updateSocietyBalance(amount: number) {
  const user = await getCurrentUser();
  if (!user) return { error: 'Not authenticated' };

  const service = getServiceClient();

  try {
    const { data: profile } = await service
      .from('profiles')
      .select('society_id, role')
      .eq('id', user.id)
      .single();

    if (!profile || !['ADMIN', 'SECRETARY'].includes(profile.role)) {
      return { error: 'Unauthorized.' };
    }

    const { error } = await service
      .from('societies')
      .update({ society_balance: amount })
      .eq('id', profile.society_id);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to update balance.' };
  }
}

// ─────────────────────────────────────────────────────────────
// ADMIN: Update a member's role
// ─────────────────────────────────────────────────────────────
export async function updateMemberRole(memberId: string, role: 'ADMIN' | 'SECRETARY' | 'OWNER' | 'RESIDENT') {
  const user = await getCurrentUser();
  if (!user) return { error: 'Not authenticated' };

  const service = getServiceClient();

  try {
    // Only ADMIN can change roles
    const { data: adminProfile } = await service
      .from('profiles')
      .select('society_id, role')
      .eq('id', user.id)
      .single();

    if (!adminProfile || adminProfile.role !== 'ADMIN') {
      return { error: 'Only the society admin can change member roles.' };
    }

    // Ensure target member is in the same society
    const { data: targetProfile } = await service
      .from('profiles')
      .select('society_id, first_name, last_name')
      .eq('id', memberId)
      .single();

    if (!targetProfile || targetProfile.society_id !== adminProfile.society_id) {
      return { error: 'Member not found in your society.' };
    }

    const { error } = await service
      .from('profiles')
      .update({ role })
      .eq('id', memberId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to update member role.' };
  }
}

// ─────────────────────────────────────────────────────────────
// OFFLINE MEMBERS: Admin creates a member without sending email
// ─────────────────────────────────────────────────────────────
export async function createOfflineMember(data: {
  firstName: string;
  lastName: string;
  flatNumber: string;
  phone: string;
  email: string;
}) {
  const user = await getCurrentUser();
  if (!user) return { error: 'Not authenticated' };

  const service = getServiceClient();

  try {
    const { data: profile } = await service.from('profiles').select('society_id, role').eq('id', user.id).single();
    if (!profile || !profile.society_id || !['ADMIN', 'SECRETARY'].includes(profile.role)) return { error: 'Unauthorized' };

    // Create auth user (auto-confirm so they don't get verification emails from Supabase)
    const { data: authData, error: authErr } = await service.auth.admin.createUser({
      email: data.email,
      password: crypto.randomUUID(), // Random password they'll never use
      email_confirm: true,
    });
    if (authErr) throw authErr;
    const userId = authData.user.id;

    // Create profile
    const { error: profErr } = await service.from('profiles').insert({
      id: userId,
      society_id: profile.society_id,
      role: 'RESIDENT',
      status: 'ACTIVE',
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone,
      flat_number: data.flatNumber,
    });
    if (profErr) throw profErr;

    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to create member.' };
  }
}

// ─────────────────────────────────────────────────────────────
// SUPER ADMIN: Completely delete a society and all its users
// BUG FIX: Now correctly deletes all related records + auth users
// ─────────────────────────────────────────────────────────────
export async function deleteSocietyCompletely(societyId: string) {
  const SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || 'pranav07112007@gmail.com';
  const user = await getCurrentUser();
  if (!user || user.email !== SUPER_ADMIN_EMAIL) {
    return { error: 'Unauthorized: Super Admin only.' };
  }

  const service = getServiceClient();

  try {
    // 1. Get all user IDs in this society FIRST (before deleting anything)
    const { data: profiles } = await service
      .from('profiles')
      .select('id')
      .eq('society_id', societyId);

    const userIds = profiles?.map(p => p.id) || [];

    // 2. Delete join_requests (has FK to auth.users which gets deleted)
    //    Must delete before auth user deletion
    await service.from('join_requests').delete().eq('society_id', societyId);

    // 3. Delete all cascading data manually (in case of FK constraint issues)
    await service.from('transactions').delete().eq('society_id', societyId);
    await service.from('maintenance_bills').delete().eq('society_id', societyId);
    await service.from('expenses').delete().eq('society_id', societyId);
    await service.from('notices').delete().eq('society_id', societyId);
    await service.from('complaints').delete().eq('society_id', societyId);
    await service.from('hall_allocations').delete().eq('society_id', societyId);
    await service.from('properties').delete().eq('society_id', societyId);

    // 4. Delete elections & related (needs separate handling)
    const { data: elections } = await service.from('elections').select('id').eq('society_id', societyId);
    if (elections && elections.length > 0) {
      const electionIds = elections.map(e => e.id);
      await service.from('votes').delete().in('election_id', electionIds);
      await service.from('candidates').delete().in('election_id', electionIds);
      await service.from('elections').delete().eq('society_id', societyId);
    }

    // 5. Delete profiles (must happen before deleting auth users)
    await service.from('profiles').delete().eq('society_id', societyId);

    // 6. Delete the society itself
    const { error: delSocErr } = await service
      .from('societies')
      .delete()
      .eq('id', societyId);

    if (delSocErr) throw delSocErr;

    // 7. Delete all auth users (do this LAST after all FK references removed)
    for (const userId of userIds) {
      const { error: authDelErr } = await service.auth.admin.deleteUser(userId);
      if (authDelErr) {
        console.error(`Failed to delete auth user ${userId}:`, authDelErr.message);
        // Continue even if one user deletion fails
      }
    }

    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to completely delete the society.' };
  }
}
