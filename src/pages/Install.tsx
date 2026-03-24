import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="mx-auto max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Smartphone className="h-10 w-10" />
        </div>
        <h1 className="font-display text-3xl font-bold text-foreground">Install GradeAI</h1>
        <p className="text-muted-foreground">
          Install GradeAI on your device for quick access, offline support, and a native app experience.
        </p>

        {installed ? (
          <div className="flex items-center justify-center gap-2 text-secondary">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">App installed successfully!</span>
          </div>
        ) : deferredPrompt ? (
          <Button size="lg" className="gap-2" onClick={handleInstall}>
            <Download className="h-5 w-5" />
            Install App
          </Button>
        ) : (
          <div className="space-y-4 rounded-lg border bg-card p-4 text-left text-sm text-muted-foreground">
            <p className="font-medium text-foreground">To install on your device:</p>
            <div className="space-y-2">
              <p><strong>iPhone/iPad:</strong> Tap the Share button → "Add to Home Screen"</p>
              <p><strong>Android:</strong> Tap the browser menu (⋮) → "Add to Home Screen" or "Install app"</p>
              <p><strong>Desktop:</strong> Click the install icon in the address bar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Install;
