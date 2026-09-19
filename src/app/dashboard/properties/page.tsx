'use client';

import * as React from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Home, Loader2, Phone, Tag } from 'lucide-react';
import { createProperty } from '@/app/actions/modules';

type Property = {
  id: string;
  title: string;
  description: string;
  property_type: string;
  price: number;
  privacy: string;
  status: string;
  contact_name: string;
  contact_phone: string;
  created_at: string;
  owner_id: string;
};

export default function PropertiesPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const supabase = createClient();
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [fetching, setFetching] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [form, setForm] = React.useState({
    title: '', description: '', property_type: 'SALE', price: '',
    privacy: 'RESIDENT_ONLY', contact_name: '', contact_phone: '',
  });

  const fetchProperties = React.useCallback(async () => {
    setFetching(true);
    const { data } = await supabase
      .from('properties')
      .select('*')
      .eq('society_id', profile?.society_id)
      .order('created_at', { ascending: false });
    setProperties(data || []);
    setFetching(false);
  }, [supabase, profile]);

  React.useEffect(() => { fetchProperties(); }, [fetchProperties]);

  const handleCreate = () => {
    startTransition(async () => {
      const result = await createProperty({
        society_id: profile?.society_id!,
        title: form.title,
        description: form.description,
        property_type: form.property_type,
        price: parseFloat(form.price),
        privacy: form.privacy,
        contact_name: form.contact_name || `${profile?.first_name} ${profile?.last_name}`,
        contact_phone: form.contact_phone,
      });
      if (result.error) {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      } else {
        toast({ title: '🏠 Property Listed!', description: 'Your listing is now live.' });
        setForm({ title: '', description: '', property_type: 'SALE', price: '', privacy: 'RESIDENT_ONLY', contact_name: '', contact_phone: '' });
        setShowForm(false);
        fetchProperties();
      }
    });
  };

  const typeColors: Record<string, string> = {
    SALE: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    RENT: 'bg-green-500/10 text-green-600 border-green-500/20',
  };
  const statusColors: Record<string, string> = {
    AVAILABLE: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    SOLD: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
    RENTED: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Property Tracker</h1>
          <p className="text-muted-foreground mt-1">Buy, sell, or rent properties within your society.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <PlusCircle className="h-4 w-4" />
          {showForm ? 'Cancel' : 'List Property'}
        </Button>
      </div>

      {showForm && (
        <Card className="bg-card/80 backdrop-blur border-primary/30 animate-fade-in">
          <CardHeader>
            <CardTitle>List a Property</CardTitle>
            <CardDescription>Set visibility to control who sees your listing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField label="Title"><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. 3BHK Spacious Flat - Block A" className="bg-background/50" /></FormField>
            <FormField label="Description"><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe your property..." rows={3} className="bg-background/50 resize-none" /></FormField>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Type">
                <Select value={form.property_type} onValueChange={v => setForm(f => ({ ...f, property_type: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SALE">For Sale</SelectItem>
                    <SelectItem value="RENT">For Rent</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label={form.property_type === 'RENT' ? 'Monthly Rent (₹)' : 'Asking Price (₹)'}>
                <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" className="bg-background/50" />
              </FormField>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Visibility">
                <Select value={form.privacy} onValueChange={v => setForm(f => ({ ...f, privacy: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RESIDENT_ONLY">Residents Only</SelectItem>
                    <SelectItem value="EVERYONE">Public</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Contact Phone">
                <Input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} placeholder="9876543210" className="bg-background/50" />
              </FormField>
            </div>
            <Button onClick={handleCreate} disabled={!form.title || !form.price || isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Post Listing
            </Button>
          </CardContent>
        </Card>
      )}

      {fetching && <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}
      {!fetching && properties.length === 0 && (
        <Card className="bg-card/80 backdrop-blur border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-muted-foreground">
            <Home className="h-12 w-12 mb-3 opacity-20" />
            <p className="font-medium">No listings yet</p>
            <p className="text-sm">Be the first to list a property in your society.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {properties.map(p => (
          <Card key={p.id} className="bg-card/80 backdrop-blur border-border/50 hover:border-primary/30 transition-all hover:shadow-lg group">
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Home className="h-5 w-5 text-primary" />
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${typeColors[p.property_type]}`}>{p.property_type}</span>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusColors[p.status]}`}>{p.status}</span>
              </div>
              <div>
                <h3 className="font-semibold">{p.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xl font-bold text-primary">₹{Number(p.price).toLocaleString('en-IN')}{p.property_type === 'RENT' ? '/mo' : ''}</span>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  {p.contact_phone || 'N/A'}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Tag className="h-3.5 w-3.5" />
                {p.privacy === 'RESIDENT_ONLY' ? 'Residents Only' : 'Public Listing'}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
