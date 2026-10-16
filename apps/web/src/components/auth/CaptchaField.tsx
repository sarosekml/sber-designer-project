import { useEffect, useState } from 'react';
import { Loader2, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { captcha as fetchCaptcha, type CaptchaChallenge } from '@/lib/api/auth';

import { captchaImageSource } from './auth-view-model';

interface CaptchaFieldProps {
  challengeId: string;
  value: string;
  onChallengeIdChange: (challengeId: string) => void;
  onValueChange: (value: string) => void;
  refreshKey?: number;
  error?: string | null;
  disabled?: boolean;
}

export function CaptchaField({
  challengeId,
  value,
  onChallengeIdChange,
  onValueChange,
  refreshKey = 0,
  error,
  disabled = false,
}: CaptchaFieldProps) {
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null);
  const [requestKey, setRequestKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    setChallenge(null);
    onChallengeIdChange('');
    onValueChange('');
    fetchCaptcha(controller.signal)
      .then((next) => {
        setChallenge(next);
        onChallengeIdChange(next.challengeId);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setLoadError(reason instanceof Error ? reason.message : 'Could not load CAPTCHA.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [onChallengeIdChange, onValueChange, refreshKey, requestKey]);

  return (
    <div className="grid gap-2">
      <div className="flex min-h-20 items-center gap-2 rounded-md border border-border bg-background p-2">
        <div className="grid min-h-16 flex-1 place-items-center overflow-hidden rounded bg-white">
          {loading ? (
            <Loader2
              className="size-5 animate-spin text-muted-foreground"
              aria-label="Loading CAPTCHA"
            />
          ) : challenge ? (
            <img
              src={captchaImageSource(challenge.svg)}
              alt="CAPTCHA challenge"
              className="h-16 max-w-full object-contain"
            />
          ) : (
            <span className="px-3 text-center text-xs text-destructive">
              {loadError ?? 'Could not load CAPTCHA.'}
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setRequestKey((key) => key + 1)}
          disabled={disabled || loading}
          aria-label="Refresh CAPTCHA"
          title="Refresh CAPTCHA"
        >
          <RotateCw />
        </Button>
      </div>

      <Label htmlFor="auth-captcha">Enter the characters above</Label>
      <Input
        id="auth-captcha"
        name="captcha"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        required
        disabled={disabled || !challengeId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'auth-captcha-error' : undefined}
      />
      {error ? (
        <p id="auth-captcha-error" className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
