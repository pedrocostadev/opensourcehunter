"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Mail, Bell, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

interface NotificationPreferences {
  emailEnabled: boolean;
  pushEnabled: boolean;
  newIssueEmail: boolean;
  draftReadyEmail: boolean;
  newIssuePush: boolean;
  draftReadyPush: boolean;
  hasPushSubscription: boolean;
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent 
        transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 
        focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
        disabled:cursor-not-allowed disabled:opacity-50
        ${checked ? "bg-primary" : "bg-input"}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg 
          ring-0 transition duration-200 ease-in-out
          ${checked ? "translate-x-5" : "translate-x-0"}
        `}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    emailEnabled: false,
    pushEnabled: false,
    newIssueEmail: true,
    draftReadyEmail: true,
    newIssuePush: true,
    draftReadyPush: true,
    hasPushSubscription: false,
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  useEffect(() => {
    async function fetchPreferences() {
      try {
        const res = await fetch("/api/settings/notifications");
        if (res.ok) {
          const data = await res.json();
          setPrefs(data);
        }
      } catch (error) {
        console.error("Failed to fetch preferences:", error);
      } finally {
        setLoading(false);
      }
    }

    if (session) {
      fetchPreferences();
    }
  }, [session]);

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setSaving(true);

    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });

      if (!res.ok) throw new Error("Failed to save");
      toast.success("Preferences saved");
    } catch {
      setPrefs((prev) => ({ ...prev, [key]: !value }));
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const subscribeToPush = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast.error("Push notifications not supported in this browser");
      return;
    }

    setSubscribing(true);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notification permission denied");
        return;
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        toast.error("Push notifications not configured");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription }),
      });

      if (!res.ok) throw new Error("Failed to save subscription");

      setPrefs((prev) => ({ ...prev, hasPushSubscription: true, pushEnabled: true }));
      toast.success("Push notifications enabled");
    } catch (error) {
      console.error("Push subscription error:", error);
      toast.error("Failed to enable push notifications");
    } finally {
      setSubscribing(false);
    }
  };

  const unsubscribeFromPush = async () => {
    setSubscribing(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }

      await fetch("/api/push/subscribe", { method: "DELETE" });

      setPrefs((prev) => ({ ...prev, hasPushSubscription: false, pushEnabled: false }));
      toast.success("Push notifications disabled");
    } catch (error) {
      console.error("Unsubscribe error:", error);
      toast.error("Failed to disable push notifications");
    } finally {
      setSubscribing(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="container max-w-2xl py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.push("/dashboard")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your notification preferences</p>
      </div>

      {/* Email Notifications */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <CardTitle>Email Notifications</CardTitle>
          </div>
          <CardDescription>
            Receive notifications via email at {session?.user?.email || "your registered email"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="email-enabled" className="flex flex-col gap-1">
              <span>Enable email notifications</span>
              <span className="font-normal text-sm text-muted-foreground">
                Master toggle for all email notifications
              </span>
            </Label>
            <Toggle
              checked={prefs.emailEnabled}
              onChange={(v) => updatePreference("emailEnabled", v)}
              disabled={saving}
            />
          </div>

          {prefs.emailEnabled && (
            <>
              <hr className="my-4" />
              <div className="flex items-center justify-between">
                <Label className="flex flex-col gap-1">
                  <span>New issue alerts</span>
                  <span className="font-normal text-sm text-muted-foreground">
                    When issues matching your filters are found
                  </span>
                </Label>
                <Toggle
                  checked={prefs.newIssueEmail}
                  onChange={(v) => updatePreference("newIssueEmail", v)}
                  disabled={saving}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="flex flex-col gap-1">
                  <span>Draft PR ready</span>
                  <span className="font-normal text-sm text-muted-foreground">
                    When a draft PR is ready for your review
                  </span>
                </Label>
                <Toggle
                  checked={prefs.draftReadyEmail}
                  onChange={(v) => updatePreference("draftReadyEmail", v)}
                  disabled={saving}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Push Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>Push Notifications</CardTitle>
          </div>
          <CardDescription>
            Receive browser push notifications even when the app is closed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!prefs.hasPushSubscription ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Enable push notifications to receive alerts directly in your browser.
              </p>
              <Button onClick={subscribeToPush} disabled={subscribing}>
                {subscribing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enable Push Notifications
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Label className="flex flex-col gap-1">
                  <span>Enable push notifications</span>
                  <span className="font-normal text-sm text-muted-foreground">
                    Master toggle for all push notifications
                  </span>
                </Label>
                <Toggle
                  checked={prefs.pushEnabled}
                  onChange={(v) => updatePreference("pushEnabled", v)}
                  disabled={saving}
                />
              </div>

              {prefs.pushEnabled && (
                <>
                  <hr className="my-4" />
                  <div className="flex items-center justify-between">
                    <Label className="flex flex-col gap-1">
                      <span>New issue alerts</span>
                      <span className="font-normal text-sm text-muted-foreground">
                        When issues matching your filters are found
                      </span>
                    </Label>
                    <Toggle
                      checked={prefs.newIssuePush}
                      onChange={(v) => updatePreference("newIssuePush", v)}
                      disabled={saving}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="flex flex-col gap-1">
                      <span>Draft PR ready</span>
                      <span className="font-normal text-sm text-muted-foreground">
                        When a draft PR is ready for your review
                      </span>
                    </Label>
                    <Toggle
                      checked={prefs.draftReadyPush}
                      onChange={(v) => updatePreference("draftReadyPush", v)}
                      disabled={saving}
                    />
                  </div>
                </>
              )}

              <hr className="my-4" />
              <Button
                variant="outline"
                onClick={unsubscribeFromPush}
                disabled={subscribing}
                className="text-destructive"
              >
                {subscribing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Disable Push Notifications
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length) as Uint8Array<ArrayBuffer>;
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
