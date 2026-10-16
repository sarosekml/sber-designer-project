import { SettingsDialog } from '@/components/editor/SettingsDialog';
import { useConfigLoader } from '@/hooks/useConfigLoader';

interface HomeSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HomeSettingsDialog({ open, onOpenChange }: HomeSettingsDialogProps) {
  useConfigLoader();
  return <SettingsDialog open={open} onOpenChange={onOpenChange} scope="system" />;
}
