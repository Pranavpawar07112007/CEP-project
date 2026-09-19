'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Building2, MapPin, Phone, Home, IndianRupee, Users, UserCog,
  Loader2, CheckCircle2, Save, Settings
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { updateSocietyBalance } from '@/app/actions/admin';
import SplashScreen from '@/components/splash-screen';
import { createClient } from '@/utils/supabase/client';

export default function SettingsPage() {
  const { profile, society, loading, refreshSociety } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const supabase = createClient();

  const isAdmin = profile?.role === 'ADMIN';

  // Society details form
  const [name, setName] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [city, setCity] = React.useState('');
  const [state, setState] = React.useState('');
  const [zipCode, setZipCode] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [mode, setMode] = React.useState<'COMMUNITY' | 'ADMIN_ONLY'>('COMMUNITY');

  // Admin personal details
  const [flatNumber, setFlatNumber] = React.useState('');
  const [adminPhone, setAdminPhone] = React.useState('');

  // Balance
  const [balance, setBalance] = React.useState('');

  const [savingDetails, setSavingDetails] = React.useState(false);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [savingBalance, setSavingBalance] = React.useState(false);

  // Populate form with current data
  React.useEffect(() => {
    if (society) {
      setName(society.name || '');
      setAddress(society.address || '');
      setCity(society.city || '');
      setState(society.state || '');
      setZipCode(society.zip_code || '');
      setPhone(society.phone || '');
      setMode(society.mode || 'COMMUNITY');
      setBalance(String(society.society_balance ?? 0));
    }
    if (profile) {
      setFlatNumber(profile.flat_number || '');
      setAdminPhone(profile.phone || '');
    }
  }, [society, profile]);

  // Redirect non-admins
  React.useEffect(() => {
    if (!loading && profile && !isAdmin) {
      router.push('/dashboard');
    }
  }, [profile, loading, isAdmin, router]);

  const handleSaveSocietyDetails = async () => {
    setSavingDetails(true);
    try {
      const { error } = await supabase
        .from('societies')
        .update({
          name: name.trim(),
          address: address.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          zip_code: zipCode.trim() || null,
          phone: phone.trim() || null,
          mode,
        })
        .eq('id', society?.id);

      if (error) throw error;

      await refreshSociety();
      toast({ title: '✅ Society details updated.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setSavingDetails(false);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          flat_number: flatNumber.trim() || null,
          phone: adminPhone.trim() || null,
        })
        .eq('id', profile?.id);

      if (error) throw error;

      await refreshSociety();
      toast({ title: '✅ Your profile updated.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveBalance = async () => {
    const amount = parseFloat(balance);
    if (isNaN(amount) || amount < 0) {
      toast({ variant: 'destructive', title: 'Enter a valid balance amount.' });
      return;
    }
    setSavingBalance(true);
    const result = await updateSocietyBalance(amount);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    } else {
      await refreshSociety();
      toast({ title: '✅ Society balance updated.' });
    }
    setSavingBalance(false);
  };

  if (loading) return <SplashScreen />;
  if (!isAdmin) return null;

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 rounded-xl">
          <Settings className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Society Settings</h1>
          <p className="text-muted-foreground mt-0.5">Update your society details, mode, and financial settings.</p>
        </div>
      </div>

      {/* Society Details */}
      <Card className="bg-card/80 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-primary" />
            Society Information
          </CardTitle>
          <CardDescription>Update your society name, address, and contact details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="soc-name">Society Name *</Label>
            <Input
              id="soc-name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="bg-background/50 mt-1"
              placeholder="Green Valley Apartments"
            />
          </div>

          <div>
            <Label htmlFor="soc-address" className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Street Address
            </Label>
            <Input
              id="soc-address"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="bg-background/50 mt-1"
              placeholder="123 Main Street, Near Park"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="soc-city">City</Label>
              <Input id="soc-city" value={city} onChange={e => setCity(e.target.value)} className="bg-background/50 mt-1" placeholder="Mumbai" />
            </div>
            <div>
              <Label htmlFor="soc-state">State</Label>
              <Input id="soc-state" value={state} onChange={e => setState(e.target.value)} className="bg-background/50 mt-1" placeholder="Maharashtra" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="soc-zip">PIN Code</Label>
              <Input id="soc-zip" value={zipCode} onChange={e => setZipCode(e.target.value)} className="bg-background/50 mt-1" placeholder="400001" />
            </div>
            <div>
              <Label htmlFor="soc-phone" className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Society Phone
              </Label>
              <Input id="soc-phone" value={phone} onChange={e => setPhone(e.target.value)} className="bg-background/50 mt-1" placeholder="022-12345678" />
            </div>
          </div>

          {/* Society Mode */}
          <div className="pt-2 border-t">
            <Label className="text-sm font-semibold block mb-3">Society Mode</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode('COMMUNITY')}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 text-left transition-all ${
                  mode === 'COMMUNITY'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/40 hover:bg-muted/50'
                }`}
              >
                <div className={`p-2 rounded-lg ${mode === 'COMMUNITY' ? 'bg-primary/20' : 'bg-blue-500/10'}`}>
                  <Users className={`h-5 w-5 ${mode === 'COMMUNITY' ? 'text-primary' : 'text-blue-500'}`} />
                </div>
                <div>
                  <p className="font-semibold text-sm">Community</p>
                  <p className="text-xs text-muted-foreground">Members can log in</p>
                </div>
                {mode === 'COMMUNITY' && <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />}
              </button>

              <button
                onClick={() => setMode('ADMIN_ONLY')}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 text-left transition-all ${
                  mode === 'ADMIN_ONLY'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/40 hover:bg-muted/50'
                }`}
              >
                <div className={`p-2 rounded-lg ${mode === 'ADMIN_ONLY' ? 'bg-primary/20' : 'bg-yellow-500/10'}`}>
                  <UserCog className={`h-5 w-5 ${mode === 'ADMIN_ONLY' ? 'text-primary' : 'text-yellow-500'}`} />
                </div>
                <div>
                  <p className="font-semibold text-sm">Admin Only</p>
                  <p className="text-xs text-muted-foreground">Private ledger mode</p>
                </div>
                {mode === 'ADMIN_ONLY' && <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />}
              </button>
            </div>
            {mode === 'ADMIN_ONLY' && (
              <div className="mt-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  ⚠️ Switching to Admin Only will hide interactive modules (Complaints, Voting, Notices, Hall Allocation) from member view. Members who have accounts won&apos;t lose their data.
                </p>
              </div>
            )}
          </div>

          <Button
            onClick={handleSaveSocietyDetails}
            disabled={savingDetails || !name.trim()}
            className="w-full gap-2"
          >
            {savingDetails ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {savingDetails ? 'Saving...' : 'Save Society Details'}
          </Button>
        </CardContent>
      </Card>

      {/* Admin Profile */}
      <Card className="bg-card/80 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Home className="h-5 w-5 text-primary" />
            Your Admin Profile
          </CardTitle>
          <CardDescription>Update your flat number and phone number.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="admin-flat">Your Flat Number</Label>
              <Input
                id="admin-flat"
                value={flatNumber}
                onChange={e => setFlatNumber(e.target.value)}
                className="bg-background/50 mt-1"
                placeholder="A-101"
              />
            </div>
            <div>
              <Label htmlFor="admin-phone">Your Phone Number</Label>
              <Input
                id="admin-phone"
                value={adminPhone}
                onChange={e => setAdminPhone(e.target.value)}
                className="bg-background/50 mt-1"
                placeholder="9876543210"
                type="tel"
              />
            </div>
          </div>
          <Button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="w-full gap-2"
          >
            {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {savingProfile ? 'Saving...' : 'Save Profile'}
          </Button>
        </CardContent>
      </Card>

      {/* Opening Balance */}
      <Card className="bg-card/80 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <IndianRupee className="h-5 w-5 text-primary" />
            Society Opening Balance
          </CardTitle>
          <CardDescription>
            Update the base/opening balance used for financial calculations.
            Net Balance = Opening Balance + Maintenance Collected − Expenses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 border flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current Opening Balance</span>
            <Badge variant="outline" className="font-mono text-base">
              ₹{Number(society?.society_balance ?? 0).toLocaleString('en-IN')}
            </Badge>
          </div>
          <div>
            <Label htmlFor="balance">New Opening Balance (₹)</Label>
            <div className="relative mt-1">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="balance"
                type="number"
                min="0"
                value={balance}
                onChange={e => setBalance(e.target.value)}
                className="pl-9 bg-background/50"
                placeholder="0"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              This does not affect transaction history — it only changes the base amount used in balance calculations.
            </p>
          </div>
          <Button
            onClick={handleSaveBalance}
            disabled={savingBalance}
            className="w-full gap-2"
          >
            {savingBalance ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {savingBalance ? 'Saving...' : 'Update Balance'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
