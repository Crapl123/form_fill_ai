
"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Loader, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const GoogleIcon = (props) => (
  <svg viewBox="0 0 48 48" {...props} className="h-5 w-5">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.088,5.571l6.19,5.238C42.022,36.21,44,30.551,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
  </svg>
);

export default function LoginPage() {
  const { signInWithGoogle, user, loading } = useAuth();
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // This effect redirects the user if they are already logged in.
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      // The signInWithGoogle function now handles the redirect logic internally.
      // It will return true if the user is new, false otherwise.
      const isNewUser = await signInWithGoogle();
      if (isNewUser) {
        router.push('/profile'); // New users go to profile to set up data
      } else {
        router.push('/'); // Existing users go to the main app
      }
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        // User intentionally closed the popup, so we just stop the loading spinner.
        setIsSigningIn(false);
        return; 
      }
      
      if (error.code === 'auth/unauthorized-domain') {
        setAuthError(
            `This app's domain is not authorized for login. Please go to your Firebase Console -> Authentication -> Settings -> Authorized domains, and add the domain from your browser's address bar.`
        );
      } else {
        setAuthError('An unexpected error occurred during sign-in. Please try again.');
      }
      console.error("Google Sign-In failed", error);
      setIsSigningIn(false);
    }
  };
  
  // While loading or if user is already logged in, show a loader.
  if (loading || user) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background">
            <Loader className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Redirecting...</p>
        </div>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-background">
      <Card className="w-full max-w-md shadow-2xl bg-card border-border text-foreground">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 text-primary rounded-full p-3 w-fit mb-4 border border-primary/20">
            <Bot className="h-8 w-8" />
          </div>
          <CardTitle className="text-3xl font-bold">Welcome to Form AutoFill AI</CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Sign in or create an account to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            {authError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Login Error</AlertTitle>
                <AlertDescription>{authError}</AlertDescription>
              </Alert>
            )}
            <Button onClick={handleGoogleSignIn} className="w-full bg-white text-slate-800 hover:bg-slate-200" size="lg" variant="outline" disabled={isSigningIn}>
                {isSigningIn ? (
                    <Loader className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                    <GoogleIcon className="mr-2"/>
                )}
                {isSigningIn ? 'Signing In...' : 'Sign In with Google'}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
                By signing in, you agree to our terms of service.
            </p>
        </CardContent>
      </Card>
    </main>
  );
}

    