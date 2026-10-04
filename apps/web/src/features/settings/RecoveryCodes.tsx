// Shows freshly made recovery codes ONCE, with copy and download buttons.
import { useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';

export function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `StudyApp recovery codes (each works once)\n\n${codes.join('\n')}\n`;

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'studyapp-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Alert tone="warning">
        Save these recovery codes somewhere safe. If you lose your phone, each code lets you sign in once.
        This is the only time they are shown.
      </Alert>
      <ul className="grid grid-cols-2 gap-2 rounded-xl border-2 border-line bg-raised p-4 font-mono text-sm">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button variant="secondary" onClick={download}>
          Download
        </Button>
        <Button onClick={onDone}>I've saved them</Button>
      </div>
    </div>
  );
}
