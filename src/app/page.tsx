
"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Bot, Feather, FileCheck, FileText, Lock, Moon, Sun, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import FormFillerApp from "@/app/form-filler-app";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const FeatureCard = ({ icon, title, description }) => (
  <div className="flex flex-col items-start p-6 bg-card rounded-lg border border-border hover:border-primary/20 transition-colors">
    <div className="mb-4 p-3 bg-primary/10 text-primary rounded-lg border border-primary/20">
      {icon}
    </div>
    <h3 className="font-bold text-lg text-card-foreground mb-2">{title}</h3>
    <p className="text-muted-foreground leading-relaxed">{description}</p>
  </div>
);

const HowItWorksStep = ({ icon, title, description }) => (
    <div className="flex flex-col items-center text-center p-6 bg-card rounded-lg border border-border">
        <div className="mb-4 p-3 bg-primary/10 text-primary rounded-lg border border-primary/20">
            {icon}
        </div>
        <h3 className="font-semibold text-lg text-card-foreground">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
    </div>
);

const TestimonialCard = ({ quote, author, role }) => (
    <div className="p-6 bg-card rounded-lg border border-border">
        <blockquote className="text-foreground italic mb-4">“{quote}”</blockquote>
        <div className="text-right">
            <p className="font-semibold text-card-foreground">{author}</p>
            <p className="text-sm text-primary">{role}</p>
        </div>
    </div>
)

const ThemeToggle = () => {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-secondary">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background border-border text-foreground">
        <DropdownMenuItem onClick={() => setTheme("light")} className="hover:!bg-secondary">
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")} className="hover:!bg-secondary">
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")} className="hover:!bg-secondary">
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function LandingPage() {
  return (
    <main className="bg-background text-foreground font-body antialiased">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Bot className="h-7 w-7 text-primary" />
            <span className="font-bold text-xl text-foreground">Form AutoFill AI</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" passHref>
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-secondary">Login</Button>
            </Link>
            <Link href="/login" passHref>
              <Button variant="default" className="bg-primary text-primary-foreground hover:bg-primary/90">
                Sign Up <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 text-center container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[linear-gradient(to_right,hsl(var(--border)_/_0.1)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)_/_0.1)_1px,transparent_1px)] bg-[size:14px_24px]"></div>
        <div className="absolute left-0 top-0 -z-10 h-1/3 w-full bg-gradient-to-b from-primary/10 to-transparent"></div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground mb-4">
          Fill Complex Forms in Seconds with AI
        </h1>
        <p className="max-w-2xl mx-auto text-lg text-muted-foreground mb-8">
          Upload any supplier or vendor form - Excel or PDF - and get it filled instantly using your saved company data.
        </p>
        <div className="flex justify-center">
            <Link href="#app" passHref>
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 text-base font-semibold px-8 py-6">
                Try It Now <Zap className="ml-2 h-5 w-5"/>
              </Button>
            </Link>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-secondary/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center text-foreground mb-12">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <HowItWorksStep icon={<Feather className="h-7 w-7"/>} title="1. Add Master Data" description="Securely enter or upload your company's master data just once." />
                <HowItWorksStep icon={<FileText className="h-7 w-7"/>} title="2. Upload Any Form" description="Drag and drop any structured supplier form, in Excel or PDF format." />
                <HowItWorksStep icon={<FileCheck className="h-7 w-7"/>} title="3. Download Instantly" description="Review, correct, and download the auto-filled version in seconds." />
            </div>
        </div>
      </section>

      {/* App Section */}
      <section id="app" className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <FormFillerApp />
        </div>
      </section>
      
      {/* Features Section */}
      <section className="py-20 bg-secondary/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">Powerful Features, Simple Interface</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Bot className="h-7 w-7"/>}
              title="Smart AI Autofill"
              description="Our AI intelligently maps your data to the correct form fields, even with varied labels."
            />
            <FeatureCard
              icon={<FileText className="h-7 w-7"/>}
              title="Supports Excel & PDF"
              description="Handle both modern fillable PDFs and traditional Excel spreadsheets with ease."
            />
            <FeatureCard
              icon={<Zap className="h-7 w-7"/>}
              title="Works on Unstructured Forms"
              description="Our AI can identify fields and fill flat, non-fillable PDFs and unstructured Excel files."
            />
            <FeatureCard
              icon={<Lock className="h-7 w-7"/>}
              title="Privacy-Focused"
              description="Your master data is stored securely and is never used for any other purpose."
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="max-w-2xl mx-auto text-center">
                 <h2 className="text-3xl font-bold text-foreground mb-4">Get Started for Free</h2>
                 <p className="text-muted-foreground mb-8">
                    Try out the full power of the app with a generous free plan. Upgrade when you need more.
                 </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                <div className="p-8 bg-card rounded-lg border border-border text-center">
                    <h3 className="text-2xl font-bold text-card-foreground mb-2">Free</h3>
                    <p className="text-muted-foreground mb-6">For individuals and small-scale use</p>
                    <p className="text-4xl font-bold text-card-foreground mb-6">1 <span className="text-lg font-medium text-muted-foreground">form fill / day</span></p>
                    <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground">Start for Free</Button>
                </div>
                 <div className="p-8 bg-card rounded-lg border border-primary text-center ring-2 ring-primary/50">
                    <h3 className="text-2xl font-bold text-card-foreground mb-2">Pro</h3>
                    <p className="text-muted-foreground mb-6">For teams and frequent users</p>
                    <p className="text-4xl font-bold text-card-foreground mb-6">Unlimited <span className="text-lg font-medium text-muted-foreground">form fills</span></p>
                    <Button variant="default" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">Subscribe to Pro</Button>
                </div>
              </div>
          </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-secondary/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">Loved by Teams Everywhere</h2>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <TestimonialCard quote="This tool saved our admin team hours every week. What used to be a manual copy-paste marathon is now a one-click process." author="Sarah J." role="Procurement Manager" />
              <TestimonialCard quote="As a small business owner, I wear many hats. Form AutoFill AI took one of the most tedious tasks off my plate completely." author="Mike R." role="Founder, Creative Co." />
              <TestimonialCard quote="The AI is surprisingly accurate, even on some of the weirdly formatted forms we get. It's become an essential part of our vendor onboarding." author="David L." role="Operations Lead, TechCorp" />
           </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 text-center text-muted-foreground">
          <div className="flex justify-center gap-6 mb-4">
            <Link href="#" className="hover:text-foreground">About</Link>
            <Link href="#" className="hover:text-foreground">FAQ</Link>
            <Link href="#" className="hover:text-foreground">Contact</Link>
            <Link href="#" className="hover:text-foreground">Privacy Policy</Link>
          </div>
          <p>&copy; {new Date().getFullYear()} Form AutoFill AI. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
