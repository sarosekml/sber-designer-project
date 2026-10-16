/** Empty state shown when no provider is configured. */
import { Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { openSettings } from '@/lib/settings-events';

export function ProviderRequiredBody() {
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5">
        <div className="mb-1 flex items-center gap-2 font-medium">
          <Terminal className="size-3.5 text-primary" />
          Choose an LLM provider
        </div>
        <p className="text-muted-foreground">
          Select an API provider or connect a local CLI provider in Settings before sending
          Assistant messages.
        </p>
        <Button size="sm" className="mt-3" onClick={() => openSettings('llm')}>
          <Terminal className="size-3.5" />
          Open LLM providers
        </Button>
      </div>
    </div>
  );
}
