'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Users, UserCog, Loader2, CheckCircle2, Building2, Phone, 
  MapPin, IndianRupee, ChevronRight, ChevronLeft, Home
} from 'lucide-react';
import { completeAdminSetup } from '@/app/actions/admin';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

type Step = 1 | 2 | 3;

export default function SetupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { profile, refreshSociety } = useAuth();
  const [currentStep, setCurrentStep] = React.useState<Step>(1);
  const [isPending, startTransition] = React.useTransition();

  // Step 1: Mode
  const [selectedMode, setSelectedMode] = React.useState<'COMMUNITY' | 'ADMIN_ONLY' | null>(null);

  // Step 2: Society & Admin Details
  const [address, setAddress] = React.useState('');
  const [city, setCity] = React.useState('');
  const [state, setState] = React.useState('');
  const [zipCode, setZipCode] = React.useState('');
  const [adminPhone, setAdminPhone] = React.useState('');
  const [adminFlat, setAdminFlat] = React.useState('');

  // Step 3: Opening Balance
  const [balance, setBalance] = React.useState('0');

  // If not admin, push away
  React.useEffect(() => {
    if (profile && profile.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [profile, router]);

  const handleComplete = () => {
    if (!selectedMode) {
      toast({ variant: 'destructive', title: 'Please select a mode first.' });
      return;
    }

    startTransition(async () => {
      const result = await completeAdminSetup({
        mode: selectedMode,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        zipCode: zipCode.trim() || undefined,
        phone: adminPhone.trim() || undefined,
        flatNumber: adminFlat.trim() || undefined,
        societyBalance: parseFloat(balance) || 0,
      });

      if (result.error) {
        toast({ variant: 'destructive', title: 'Setup Failed', description: result.error });
        return;
      }

      toast({ title: '🎉 Setup Complete!', description: 'Your society is ready to go!' });

      // Refresh the auth context so society.onboarding_completed becomes true
      // This prevents the layout from redirecting back to setup
      await refreshSociety();

      // Navigate to dashboard
      router.push('/dashboard');
    });
  };

  const steps = [
    { label: 'Society Mode', icon: Building2 },
    { label: 'Details', icon: MapPin },
    { label: 'Balance', icon: IndianRupee },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-8 pt-6 pb-16 animate-fade-in px-4">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-3">
          <Building2 className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Society Setup</h1>
        <p className="text-muted-foreground text-lg">Let&apos;s configure your society workspace in just 3 steps.</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-0">
        {steps.map((step, idx) => {
          const stepNum = (idx + 1) as Step;
          const isCompleted = currentStep > stepNum;
          const isCurrent = currentStep === stepNum;
          const Icon = step.icon;
          return (
            <React.Fragment key={step.label}>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  isCompleted ? 'bg-primary border-primary text-primary-foreground' :
                  isCurrent ? 'border-primary text-primary bg-primary/10' :
                  'border-border text-muted-foreground'
                }`}>
                  {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                <span className={`text-xs font-medium ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`h-0.5 w-16 mx-2 mb-5 transition-all ${currentStep > stepNum ? 'bg-primary' : 'bg-border'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step 1: Mode Selection */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold">How would you like to run your society?</h2>
            <p className="text-muted-foreground mt-1">You can change this later from Settings.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            <Card
              className={`cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5 ${
                selectedMode === 'COMMUNITY' ? 'border-primary ring-2 ring-primary/20 bg-primary/10' : ''
              }`}
              onClick={() => setSelectedMode('COMMUNITY')}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-blue-500/10 text-blue-500 rounded-lg">
                    <Users className="h-8 w-8" />
                  </div>
                  {selectedMode === 'COMMUNITY' && <CheckCircle2 className="h-6 w-6 text-primary" />}
                </div>
                <CardTitle className="text-xl mt-3">Community Mode</CardTitle>
                <CardDescription>The complete interactive platform for all members.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm text-muted-foreground">
                <p>✅ Residents can sign up and log in</p>
                <p>✅ Members pay maintenance online via Razorpay</p>
                <p>✅ Notice Board, Complaints, and Voting active</p>
                <p>✅ Hall Allocation and Property Tracker for all</p>
              </CardContent>
            </Card>

            <Card
              className={`cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5 ${
                selectedMode === 'ADMIN_ONLY' ? 'border-primary ring-2 ring-primary/20 bg-primary/10' : ''
              }`}
              onClick={() => setSelectedMode('ADMIN_ONLY')}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-yellow-500/10 text-yellow-500 rounded-lg">
                    <UserCog className="h-8 w-8" />
                  </div>
                  {selectedMode === 'ADMIN_ONLY' && <CheckCircle2 className="h-6 w-6 text-primary" />}
                </div>
                <CardTitle className="text-xl mt-3">Admin Only Mode</CardTitle>
                <CardDescription>A private ledger managed entirely by you.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm text-muted-foreground">
                <p>✅ Residents <strong>cannot</strong> log in</p>
                <p>✅ Manage offline members & manual cash payments</p>
                <p>✅ Interactive modules are hidden from members</p>
                <p>✅ Perfect for small societies moving from Excel</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Step 2: Society & Admin Details */}
      {currentStep === 2 && (
        <Card className="bg-card/80 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Society & Admin Details
            </CardTitle>
            <CardDescription>
              All fields are optional — you can edit these anytime from Settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Society Address</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="address">Street Address</Label>
                  <Input id="address" placeholder="123 Main Street, Near Park" value={address} onChange={e => setAddress(e.target.value)} className="bg-background/50 mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input id="city" placeholder="Mumbai" value={city} onChange={e => setCity(e.target.value)} className="bg-background/50 mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input id="state" placeholder="Maharashtra" value={state} onChange={e => setState(e.target.value)} className="bg-background/50 mt-1" />
                  </div>
                </div>
                <div className="w-1/2">
                  <Label htmlFor="zipCode">PIN Code</Label>
                  <Input id="zipCode" placeholder="400001" value={zipCode} onChange={e => setZipCode(e.target.value)} className="bg-background/50 mt-1" />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Your Details (Admin)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="adminFlat" className="flex items-center gap-1.5">
                    <Home className="h-3.5 w-3.5" /> Your Flat Number
                  </Label>
                  <Input id="adminFlat" placeholder="A-101" value={adminFlat} onChange={e => setAdminFlat(e.target.value)} className="bg-background/50 mt-1" />
                </div>
                <div>
                  <Label htmlFor="adminPhone" className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> Your Phone Number
                  </Label>
                  <Input id="adminPhone" placeholder="9876543210" type="tel" value={adminPhone} onChange={e => setAdminPhone(e.target.value)} className="bg-background/50 mt-1" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Opening Balance */}
      {currentStep === 3 && (
        <Card className="bg-card/80 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-primary" />
              Society Opening Balance
            </CardTitle>
            <CardDescription>
              Set your society&apos;s current bank/cash balance. Defaults to ₹0 — you can update it anytime from Settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                💡 <strong>How it works:</strong> The society balance starts at this opening amount. Every paid maintenance bill adds to it, and every logged expense deducts from it.
              </p>
            </div>
            <div>
              <Label htmlFor="balance">Current Society Balance (₹)</Label>
              <div className="relative mt-1">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="balance"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={balance}
                  onChange={e => setBalance(e.target.value)}
                  className="pl-9 bg-background/50 text-xl font-bold"
                />
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 border space-y-1.5">
              <p className="text-sm font-semibold">Summary</p>
              <p className="text-sm text-muted-foreground">
                Mode: <span className="text-foreground font-medium">{selectedMode === 'COMMUNITY' ? 'Community Mode' : 'Admin Only Mode'}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Opening Balance: <span className="text-foreground font-medium">₹{(parseFloat(balance) || 0).toLocaleString('en-IN')}</span>
              </p>
              {city && <p className="text-sm text-muted-foreground">Location: <span className="text-foreground font-medium">{city}{state ? `, ${state}` : ''}</span></p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(s => Math.max(1, s - 1) as Step)}
          disabled={currentStep === 1 || isPending}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>

        {currentStep < 3 ? (
          <Button
            onClick={() => {
              if (currentStep === 1 && !selectedMode) {
                toast({ variant: 'destructive', title: 'Please select a mode to continue.' });
                return;
              }
              setCurrentStep(s => (s + 1) as Step);
            }}
            className="gap-2"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleComplete}
            disabled={!selectedMode || isPending}
            className="gap-2 min-w-[140px]"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {isPending ? 'Saving...' : 'Complete Setup'}
          </Button>
        )}
      </div>
    </div>
  );
}
