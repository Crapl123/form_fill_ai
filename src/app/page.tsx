
"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Bot, Feather, FileCheck, FileText, Lock, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import FormFillerApp from "@/app/form-filler-app";

const FeatureCard = ({ icon, title, description }) => (
  <div className="flex flex-col items-start p-6 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors">
    <div className="mb-4 p-3 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
      {icon}
    </div>
    <h3 className="font-bold text-lg text-slate-100 mb-2">{title}</h3>
    <p className="text-slate-400 leading-relaxed">{description}</p>
  </div>
);

const HowItWorksStep = ({ icon, title, description }) => (
    <div className="flex flex-col items-center text-center p-6 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <div className="mb-4 p-3 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
            {icon}
        </div>
        <h3 className="font-semibold text-lg text-slate-100">{title}</h3>
        <p className="text-slate-400 text-sm">{description}</p>
    </div>
);

const TestimonialCard = ({ quote, author, role }) => (
    <div className="p-6 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <blockquote className="text-slate-300 italic mb-4">“{quote}”</blockquote>
        <div className="text-right">
            <p className="font-semibold text-slate-100">{author}</p>
            <p className="text-sm text-indigo-400">{role}</p>
        </div>
    </div>
)

export default function LandingPage() {
  return (
    <main className="bg-slate-900 text-slate-300 font-body antialiased">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Bot className="h-7 w-7 text-indigo-400" />
            <span className="font-bold text-xl text-white">Form AutoFill AI</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" passHref>
              <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-slate-800">Login</Button>
            </Link>
            <Link href="/login" passHref>
              <Button variant="default" className="bg-indigo-600 text-white hover:bg-indigo-500">
                Sign Up <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 text-center container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 -z-10 h-full w-full bg-slate-900 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
        <div className="absolute left-0 top-0 -z-10 h-1/3 w-full bg-gradient-to-b from-indigo-950/50 to-transparent"></div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-4">
          Fill Complex Forms in Seconds with AI
        </h1>
        <p className="max-w-2xl mx-auto text-lg text-slate-400 mb-8">
          Upload any supplier or vendor form (Excel or PDF) and get it filled instantly using your saved company data.
        </p>
        <div className="flex justify-center">
            <Link href="#app" passHref>
              <Button size="lg" className="bg-indigo-600 text-white hover:bg-indigo-500 text-base font-semibold px-8 py-6">
                Try It Now <Zap className="ml-2 h-5 w-5"/>
              </Button>
            </Link>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center text-white mb-12">How It Works</h2>
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
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-white mb-12">Powerful Features, Simple Interface</h2>
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
                 <h2 className="text-3xl font-bold text-white mb-4">Get Started for Free</h2>
                 <p className="text-slate-400 mb-8">
                    Try out the full power of the app with a generous free plan. Upgrade when you need more.
                 </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                <div className="p-8 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
                    <h3 className="text-2xl font-bold text-white mb-2">Free</h3>
                    <p className="text-slate-400 mb-6">For individuals and small-scale use</p>
                    <p className="text-4xl font-bold text-white mb-6">1 <span className="text-lg font-medium text-slate-400">form fill / day</span></p>
                    <Button variant="outline" className="w-full border-indigo-500 text-indigo-400 hover:bg-indigo-500 hover:text-white">Start for Free</Button>
                </div>
                 <div className="p-8 bg-slate-800/50 rounded-lg border border-indigo-500 text-center ring-2 ring-indigo-500/50">
                    <h3 className="text-2xl font-bold text-white mb-2">Pro</h3>
                    <p className="text-slate-400 mb-6">For teams and frequent users</p>
                    <p className="text-4xl font-bold text-white mb-6">Unlimited <span className="text-lg font-medium text-slate-400">form fills</span></p>
                    <Button variant="default" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">Subscribe to Pro</Button>
                </div>
              </div>
          </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-white mb-12">Loved by Teams Everywhere</h2>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <TestimonialCard quote="This tool saved our admin team hours every week. What used to be a manual copy-paste marathon is now a one-click process." author="Sarah J." role="Procurement Manager" />
              <TestimonialCard quote="As a small business owner, I wear many hats. Form AutoFill AI took one of the most tedious tasks off my plate completely." author="Mike R." role="Founder, Creative Co." />
              <TestimonialCard quote="The AI is surprisingly accurate, even on some of the weirdly formatted forms we get. It's become an essential part of our vendor onboarding." author="David L." role="Operations Lead, TechCorp" />
           </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800">
        <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 text-center text-slate-500">
          <div className="flex justify-center gap-6 mb-4">
            <Link href="#" className="hover:text-slate-300">About</Link>
            <Link href="#" className="hover:text-slate-300">FAQ</Link>
            <Link href="#" className="hover:text-slate-300">Contact</Link>
            <Link href="#" className="hover:text-slate-300">Privacy Policy</Link>
          </div>
          <p>&copy; {new Date().getFullYear()} Form AutoFill AI. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
