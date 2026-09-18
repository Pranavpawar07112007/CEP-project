
"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, getYear, isSameMonth } from "date-fns";
import { CheckCircle2, XCircle, ReceiptText, MoreHorizontal, Pencil, UserPlus, Trash2, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Member, Payment } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { addMember, addPayment, deleteMember, getMembers, getPayments, getPaymentsForYear, updateMember, updatePayment } from "@/services/firestore";
import { useAuth } from "@/hooks/use-auth";

const paymentSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: "Please enter a valid amount." })
    .nonnegative({ message: "Amount cannot be negative." }),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Please enter a valid date in YYYY-MM-DD format.",
  }),
  paymentMode: z.literal('Online').default('Online'),
  transactionId: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.amount > 0 && (!data.transactionId || data.transactionId.trim() === '')) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['transactionId'],
            message: 'Transaction ID is required for payments greater than 0.',
        });
    }
});


const memberSchema = z.object({
  name: z.string().min(1, "Name is required."),
  flatNumber: z.string().min(1, "Flat number is required."),
  mobileNumber: z.string().min(10, "Enter a valid mobile number.").max(10, "Enter a valid mobile number."),
});

type MemberWithPayment = Member & { currentMonthPayment: Payment | null };

export default function PaymentTracker() {
  const { toast } = useToast();
  const { isEditor } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState("all");
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);


  const paymentForm = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
        paymentMode: "Online",
        transactionId: "",
        date: format(new Date(), 'yyyy-MM-dd'),
    }
  });

  const memberForm = useForm<z.infer<typeof memberSchema>>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      name: "",
      flatNumber: "",
      mobileNumber: "",
    },
  });

  useEffect(() => {
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [membersData, paymentsData] = await Promise.all([getMembers(), getPayments()]);
            setMembers(membersData);
            setPayments(paymentsData);
        } catch (error) {
            console.error("Failed to load data from Firestore", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Could not load data from the server."
            });
        } finally {
            setIsLoading(false);
        }
    };
    fetchData();
  }, [toast]);
  
  const membersWithPayments = useMemo(() => {
    const today = new Date();
    return members.map((member) => {
      const currentMonthPayment = payments.find(p => p.memberId === member.id && isSameMonth(new Date(p.date), today)) || null;
      return { ...member, currentMonthPayment };
    }).sort((a, b) => a.flatNumber.localeCompare(b.flatNumber));
  }, [members, payments]);


  useEffect(() => {
    if (isPaymentDialogOpen) {
      if (editingPayment) {
        paymentForm.reset({
          amount: editingPayment.amount,
          date: format(new Date(editingPayment.date), 'yyyy-MM-dd'),
          paymentMode: 'Online',
          transactionId: editingPayment.transactionId,
        });
      } else {
        paymentForm.reset({
            amount: '' as any, // Use empty string for controlled input
            date: format(new Date(), 'yyyy-MM-dd'),
            paymentMode: "Online",
            transactionId: "",
        });
      }
    }
    if (isMemberDialogOpen) {
        if(selectedMember) {
            memberForm.reset({
                name: selectedMember.name,
                flatNumber: selectedMember.flatNumber,
                mobileNumber: selectedMember.mobileNumber,
            })
        } else {
            memberForm.reset({
                name: "",
                flatNumber: "",
                mobileNumber: "",
            });
        }
    }
  }, [isPaymentDialogOpen, isMemberDialogOpen, editingPayment, selectedMember, paymentForm, memberForm]);

  const handleRecordPaymentClick = (member: MemberWithPayment) => {
    setSelectedMember(member);
    setEditingPayment(member.currentMonthPayment);
    setIsPaymentDialogOpen(true);
  };
  
  const handleEditMemberClick = (member: Member) => {
    setSelectedMember(member);
    setIsMemberDialogOpen(true);
  };
  
  const handleAddMemberClick = () => {
    setSelectedMember(null);
    setIsMemberDialogOpen(true);
  };

  const handleDeleteMember = () => {
    if (!memberToDelete || !isEditor) return;

    startTransition(async () => {
        try {
            await deleteMember(memberToDelete.id);
            setMembers(prev => prev.filter(m => m.id !== memberToDelete.id));
            setPayments(prev => prev.filter(p => p.memberId !== memberToDelete.id));
            toast({
                title: "Member Deleted",
                description: `Member ${memberToDelete.name} and all their payment records have been deleted.`
            });
        } catch (error) {
            console.error("Failed to delete member", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Could not delete member. Please try again."
            });
        } finally {
            setMemberToDelete(null);
        }
    });
  };

  const handleSendReminder = (member: Member) => {
    const currentMonth = format(new Date(), 'MMMM');
    const message = `Dear ${member.name}, this is a friendly reminder that your society maintenance payment for ${currentMonth} is due. Thank you, Shobha Pawar, Secretary, Aroma Residency.`;
    const whatsappUrl = `https://wa.me/91${member.mobileNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  }

  const onPaymentSubmit = (values: z.infer<typeof paymentSchema>) => {
    if (!selectedMember || !isEditor) return;

    startTransition(async () => {
        try {
            const paymentData: Partial<Payment> = {
                amount: values.amount,
                date: new Date(values.date).toISOString(),
                paymentMode: 'Online',
                transactionId: values.transactionId,
            };

            if (editingPayment) {
                await updatePayment(editingPayment.id, paymentData);
                setPayments(prev => prev.map(p => p.id === editingPayment.id ? { ...p, ...paymentData } as Payment : p));
                toast({
                    title: "Payment Updated",
                    description: `Payment for ${selectedMember.name} has been updated.`,
                });
            } else {
                 const paymentDate = new Date(values.date);
                 const paymentYear = getYear(paymentDate);
                 const paymentsInYear = await getPaymentsForYear(paymentYear);
                 const nextReceiptNumber = paymentsInYear.length + 1;
                 const receiptNumber = `${nextReceiptNumber}/${paymentYear}`;

                 const newPaymentData = {
                    memberId: selectedMember.id,
                    amount: values.amount,
                    date: paymentDate.toISOString(),
                    receiptNumber: receiptNumber,
                    paymentMode: 'Online' as const,
                    transactionId: values.transactionId || "",
                };
                const newPayment = await addPayment(newPaymentData);
                setPayments(prev => [...prev, newPayment]);
                toast({
                    title: "Payment Recorded",
                    description: `Payment for ${selectedMember.name} has been recorded.`,
                });
            }
        } catch (error) {
             console.error("Failed to save payment", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Could not save payment. Please try again."
            });
        } finally {
            setIsPaymentDialogOpen(false);
            setSelectedMember(null);
            setEditingPayment(null);
        }
    });
  };

  const onMemberSubmit = (values: z.infer<typeof memberSchema>) => {
    if (!isEditor) return;
    startTransition(async () => {
        try {
            if (selectedMember) {
                await updateMember(selectedMember.id, values);
                setMembers(prev => prev.map(m => m.id === selectedMember.id ? { ...m, ...values } : m));
                toast({
                    title: "Member Updated",
                    description: `Details for ${values.name} have been updated.`,
                });
            } else {
                const newMember = await addMember(values);
                setMembers(prev => [...prev, newMember]);
                toast({
                    title: "Member Added",
                    description: `${values.name} has been added to the society.`
                });
            }
        } catch(error) {
            console.error("Failed to save member", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Could not save member details. Please try again."
            });
        } finally {
            setIsMemberDialogOpen(false);
            setSelectedMember(null);
        }
    });
  };

  const filteredMembers = useMemo(() => {
    if (filter === "paid") {
      return membersWithPayments.filter((member) => member.currentMonthPayment !== null);
    }
    if (filter === "unpaid") {
      return membersWithPayments.filter((member) => member.currentMonthPayment === null);
    }
    return membersWithPayments;
  }, [membersWithPayments, filter]);

  const renderTable = (memberList: MemberWithPayment[]) => (
    <div className="rounded-md border overflow-x-auto">
        <Table>
        <TableHeader>
            <TableRow>
            <TableHead className="w-1/4">Member Name</TableHead>
            <TableHead>Flat No.</TableHead>
            <TableHead className="hidden sm:table-cell">Mobile No.</TableHead>
            <TableHead>Amount Paid</TableHead>
            <TableHead className="hidden md:table-cell">Payment Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
            ))
            ) : memberList.length > 0 ? (
                memberList.map((member) => (
                <TableRow key={member.id}>
                <TableCell className="font-medium min-w-[150px]">{member.name}</TableCell>
                <TableCell>{member.flatNumber}</TableCell>
                <TableCell className="hidden sm:table-cell">{member.mobileNumber}</TableCell>
                <TableCell>
                    {member.currentMonthPayment ? `₹${member.currentMonthPayment.amount.toFixed(2)}` : "N/A"}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                    {member.currentMonthPayment
                    ? format(new Date(member.currentMonthPayment.date), "PPP")
                    : "N/A"}
                </TableCell>
                <TableCell>
                    {member.currentMonthPayment ? (
                    <Badge className="bg-accent text-accent-foreground hover:bg-accent/80 whitespace-nowrap">
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Paid
                    </Badge>
                    ) : (
                    <Badge variant="destructive" className="whitespace-nowrap">
                        <XCircle className="mr-2 h-4 w-4" />
                        Unpaid
                    </Badge>
                    )}
                </TableCell>
                <TableCell className="text-right">
                    <AlertDialog open={memberToDelete?.id === member.id} onOpenChange={(open) => !open && setMemberToDelete(null)}>
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" disabled={isPending}>
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {isEditor && (
                                <DropdownMenuItem onClick={() => handleRecordPaymentClick(member)} disabled={isPending}>
                                    <ReceiptText className="mr-2 h-4 w-4" />
                                    <span>{member.currentMonthPayment ? "Edit Payment" : "Record Payment"}</span>
                                </DropdownMenuItem>
                            )}
                             {!member.currentMonthPayment && isEditor && (
                                <DropdownMenuItem onClick={() => handleSendReminder(member)} disabled={isPending}>
                                    <MessageSquare className="mr-2 h-4 w-4" />
                                    <span>Send Reminder</span>
                                </DropdownMenuItem>
                            )}
                            {isEditor && <DropdownMenuSeparator />}
                            {isEditor && (
                                <DropdownMenuItem onClick={() => handleEditMemberClick(member)} disabled={isPending}>
                                <Pencil className="mr-2 h-4 w-4" />
                                <span>Edit Member</span>
                                </DropdownMenuItem>
                            )}
                            {isEditor && <DropdownMenuSeparator />}
                            {isEditor && (
                                <DropdownMenuItem className="text-red-600" onSelect={(e) => { e.preventDefault(); setMemberToDelete(member); }} disabled={isPending}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Member
                                </DropdownMenuItem>
                            )}
                            {!isEditor && <DropdownMenuItem disabled>Read-only access</DropdownMenuItem>}
                        </DropdownMenuContent>
                        </DropdownMenu>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete {memberToDelete?.name} and all their payment records.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setMemberToDelete(null)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteMember}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </TableCell>
                </TableRow>
            ))
            ) : (
            <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                    {filter === 'all' ? 'No members added yet.' : 
                     filter === 'paid' ? 'No members have paid yet for this month.' :
                     filter === 'unpaid' ? 'All members have paid for this month.' :
                     'No members found for this filter.'}
                </TableCell>
            </TableRow>
            )}
        </TableBody>
        </Table>
    </div>
  );

  return (
    <>
      <Card className="w-full max-w-5xl shadow-lg glass-card">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <ReceiptText className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
              <div>
                <CardTitle className="font-headline text-xl sm:text-3xl">
                  Aroma Residency Co-operative Housing Society Limited
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Track and manage monthly maintenance payments for society members.
                </CardDescription>
              </div>
            </div>
            <div className="text-right flex flex-col items-end gap-2 self-start sm:self-center">
                <div>
                    <p className="text-base sm:text-lg font-semibold text-muted-foreground">{format(new Date(), 'MMMM')}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">{format(new Date(), 'yyyy')}</p>
                </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
            <Tabs value={filter} onValueChange={setFilter}>
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center mb-4 gap-4">
                    <TabsList className="grid grid-cols-3 w-full sm:w-auto">
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="paid">Paid</TabsTrigger>
                        <TabsTrigger value="unpaid">Unpaid</TabsTrigger>
                    </TabsList>
                    {isEditor && (
                        <Button onClick={handleAddMemberClick} disabled={isPending}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Add Member
                        </Button>
                    )}
                </div>
                <TabsContent value="all" className="mt-0">
                    {renderTable(filteredMembers)}
                </TabsContent>
                <TabsContent value="paid" className="mt-0">
                    {renderTable(filteredMembers)}
                </TabsContent>
                <TabsContent value="unpaid" className="mt-0">
                    {renderTable(filteredMembers)}
                </TabsContent>
            </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isPaymentDialogOpen} onOpenChange={(isOpen) => {
          setIsPaymentDialogOpen(isOpen);
          if (!isOpen) {
              setSelectedMember(null);
              setEditingPayment(null);
          }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(onPaymentSubmit)} className="space-y-8">
              <DialogHeader>
                <DialogTitle>{editingPayment ? 'Edit' : 'Record'} Payment for {selectedMember?.name}</DialogTitle>
                <DialogDescription>
                  Enter the amount and date of the maintenance payment.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <FormField
                  control={paymentForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount(₹)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 2500" type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={paymentForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Date</FormLabel>
                       <FormControl>
                        <Input placeholder="YYYY-MM-DD" type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={paymentForm.control}
                  name="transactionId"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>Transaction ID</FormLabel>
                      <FormControl>
                          <Input placeholder="Enter transaction ID" {...field} />
                      </FormControl>
                      <FormMessage />
                      </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsPaymentDialogOpen(false)} disabled={isPending}>Cancel</Button>
                <Button type="submit" disabled={isPending || !isEditor}>Save Payment</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isMemberDialogOpen} onOpenChange={(isOpen) => {
          setIsMemberDialogOpen(isOpen);
          if (!isOpen) {
              setSelectedMember(null);
          }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <Form {...memberForm}>
            <form onSubmit={memberForm.handleSubmit(onMemberSubmit)} className="space-y-8">
              <DialogHeader>
                <DialogTitle>{selectedMember ? 'Edit' : 'Add'} Member Details</DialogTitle>
                <DialogDescription>
                  {selectedMember ? "Update the member's details." : "Enter the details for the new member."}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <FormField
                  control={memberForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Ramesh Kumar" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={memberForm.control}
                  name="flatNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Flat No.</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. A-101" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={memberForm.control}
                  name="mobileNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 9876543210" type="tel" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsMemberDialogOpen(false)} disabled={isPending}>Cancel</Button>
                <Button type="submit" disabled={isPending || !isEditor}>{selectedMember ? 'Save Changes' : 'Add Member'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
