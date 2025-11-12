"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { UserMetadata } from "@/lib/models";

interface Props {
  initialUsername?: UserMetadata["username"];
  email?: string;
}

export function AccountSettings({ initialUsername, email }: Props) {
  const [username, setUsername] = useState(initialUsername ?? "");
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const isUsernameSet = Boolean(initialUsername?.trim());

  const [password, setPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleUsernameSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isUsernameSet) {
      setUsernameMessage("Username cannot be changed once set.");
      return;
    }

    setIsSavingUsername(true);
    setUsernameError(null);
    setUsernameMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: {
        username,
      },
    });

    if (error) {
      setUsernameError(error.message);
    } else {
      setUsernameMessage("Username saved.");
    }

    setIsSavingUsername(false);
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSavingPassword(true);
    setPasswordError(null);
    setPasswordMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordMessage("Password updated.");
      setPassword("");
    }

    setIsSavingPassword(false);
  };

  return (
    <div className="w-full max-w-2xl">
      <Card id="account-settings">
        <CardHeader>
          <CardTitle className="text-2xl">Account settings</CardTitle>
          <CardDescription>
            Update your username and password for InvoxAI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Signed in as{" "}
            <span className="font-medium text-foreground">{email ?? "unknown"}</span>
          </p>
          <form onSubmit={handleUsernameSubmit} className="space-y-2">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[220px]">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Your workspace name"
                  disabled={isUsernameSet}
                />
              </div>
              <Button
                type="submit"
                disabled={isSavingUsername || isUsernameSet}
                className="whitespace-nowrap"
              >
                {isSavingUsername
                  ? "Saving..."
                  : isUsernameSet
                    ? "Username locked"
                    : "Save username"}
              </Button>
            </div>
            <div className="space-y-1 text-sm">
              {usernameError && (
                <p className="text-red-600">{usernameError}</p>
              )}
              {usernameMessage && (
                <p className="text-foreground">{usernameMessage}</p>
              )}
              {isUsernameSet && !usernameMessage && (
                <p className="text-sm text-muted-foreground">
                  Username is fixed and cannot be changed.
                </p>
              )}
            </div>
          </form>

          <div className="h-[1px] w-full bg-muted-foreground/40" />

          <form onSubmit={handlePasswordSubmit} className="space-y-2">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[220px]">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button
                type="submit"
                disabled={isSavingPassword}
                className="whitespace-nowrap"
              >
                {isSavingPassword ? "Saving..." : "Update password"}
              </Button>
            </div>
            <div className="space-y-1 text-sm">
              {passwordError && (
                <p className="text-red-600">{passwordError}</p>
              )}
              {passwordMessage && (
                <p className="text-foreground">{passwordMessage}</p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
