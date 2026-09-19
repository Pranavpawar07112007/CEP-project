'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2, Info, CheckCircle2 } from 'lucide-react';

export type ConfirmVariant = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void;
  loading?: boolean;
}

const variantConfig: Record<ConfirmVariant, {
  icon: React.ComponentType<any>;
  iconBg: string;
  iconColor: string;
  confirmClass: string;
}> = {
  danger: {
    icon: Trash2,
    iconBg: 'bg-red-500/10',
    iconColor: 'text-red-500',
    confirmClass: 'bg-red-500 hover:bg-red-600 text-white border-0',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-yellow-500/10',
    iconColor: 'text-yellow-500',
    confirmClass: 'bg-yellow-500 hover:bg-yellow-600 text-white border-0',
  },
  info: {
    icon: Info,
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-500',
    confirmClass: '',
  },
  success: {
    icon: CheckCircle2,
    iconBg: 'bg-green-500/10',
    iconColor: 'text-green-500',
    confirmClass: 'bg-green-500 hover:bg-green-600 text-white border-0',
  },
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <Dialog open={open} onOpenChange={loading ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur border-border/50">
        <DialogHeader className="items-center text-center sm:text-center gap-3">
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${config.iconBg}`}>
            <Icon className={`h-7 w-7 ${config.iconColor}`} />
          </div>
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            className={`w-full sm:w-auto ${config.confirmClass}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && (
              <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// Hook for easy imperative usage
// Usage:
//   const { confirm, ConfirmDialogNode } = useConfirmDialog();
//   ...
//   const ok = await confirm({ title, description, variant })
//   if (ok) doTheThing();
//   ...
//   return <>{ConfirmDialogNode}</>
// ─────────────────────────────────────────────────────────────
interface UseConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

export function useConfirmDialog() {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [options, setOptions] = React.useState<UseConfirmOptions>({
    title: '',
    description: '',
  });
  const resolveRef = React.useRef<(value: boolean) => void>();

  const confirm = React.useCallback((opts: UseConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>(resolve => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleConfirm = React.useCallback(() => {
    resolveRef.current?.(true);
    setOpen(false);
  }, []);

  const handleCancel = React.useCallback(() => {
    resolveRef.current?.(false);
    setOpen(false);
  }, []);

  const ConfirmDialogNode = (
    <ConfirmDialog
      open={open}
      onOpenChange={val => { if (!val) handleCancel(); }}
      title={options.title}
      description={options.description}
      confirmLabel={options.confirmLabel}
      cancelLabel={options.cancelLabel}
      variant={options.variant}
      onConfirm={handleConfirm}
      loading={loading}
    />
  );

  return { confirm, ConfirmDialogNode, setLoading };
}
